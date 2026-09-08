/**
 * Planteles por partido, desde Leverade — sin scraping y sin arusa.
 *
 * Hasta ahora las nóminas se cargaban a mano (transcritas de las imágenes de
 * formación que publican los clubes). Leverade las tiene, pero NO por la ruta del
 * torneo: hay que pedirlas al recurso `/matches` con la sintaxis `query=`, que
 * acepta includes que `/tournaments` no acepta.
 *
 *   /matches?query=id = "144047899"
 *     &include=attendances.participant.license.profile,attendances.participant.team
 *
 * Cada `attendance` trae número de camiseta, capitán y titular/suplente; el
 * `profile` trae nombre y apellido. En rugby el número 1-15 ES la posición, así
 * que de paso quedan las posiciones sin transcribir nada.
 *
 * OJO — DATOS PERSONALES: `profile` también trae fecha de nacimiento. NO se lee
 * ni se guarda acá. En el Top 10 son adultos, pero ARUSA corre doce torneos
 * juveniles (M13-M18) sobre la misma API y ahí son menores.
 */
import { LEVERADE_TEAMS } from "../lib/leverade";
import { readCache, writeCache } from "../lib/arusaCache";

const LEVERADE_BASE = "https://api.leverade.com";

/** El número de camiseta es la posición (numeración estándar del rugby XV). */
export const POSITION_BY_NUMBER: Record<number, string> = {
  1: "PROP", 2: "HOOKER", 3: "PROP",
  4: "LOCK", 5: "LOCK",
  6: "FLANKER", 7: "FLANKER", 8: "NUMBER_8",
  9: "SCRUM_HALF", 10: "FLY_HALF",
  11: "WING", 12: "CENTER", 13: "CENTER", 14: "WING", 15: "FULLBACK",
};

export interface LineupPlayer {
  name: string;
  number: number | null;
  position: string | null;   // solo para los 1-15; los suplentes cubren varias
  captain: boolean;
}
export interface MatchLineup {
  home: { team: string; starters: LineupPlayer[]; subs: LineupPlayer[] };
  away: { team: string; starters: LineupPlayer[]; subs: LineupPlayer[] };
}

function cleanName(first: string, last: string): string {
  // Los nombres vienen como los tipeó cada club: "cristobal  atenas parra",
  // "CARLOS  BUSCHMAN". Se normalizan espacios y capitalización.
  const raw = `${first ?? ""} ${last ?? ""}`.replace(/\s+/g, " ").trim();
  return raw
    .split(" ")
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(" ")
    .trim();
}

/** Nómina de UN partido. Los partidos jugados no cambian → caché permanente. */
export async function fetchLeveradeLineup(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
): Promise<MatchLineup | null> {
  const key = `lineup:${matchId}`;
  const cached = await readCache<MatchLineup>(key);
  if (cached) return cached;

  const query = encodeURIComponent(`id = "${matchId}"`);
  const include = "attendances.participant.license.profile,attendances.participant.team";
  let json: any;
  try {
    const res = await fetch(`${LEVERADE_BASE}/matches?query=${query}&include=${include}`, {
      headers: { Accept: "application/vnd.api+json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  }

  const inc: any[] = json?.included ?? [];
  const byKey = new Map<string, any>(inc.map((x) => [`${x.type}:${x.id}`, x]));

  const out: MatchLineup = {
    home: { team: homeTeam, starters: [], subs: [] },
    away: { team: awayTeam, starters: [], subs: [] },
  };

  for (const a of inc.filter((x) => x.type === "attendance")) {
    const pid = a.relationships?.participant?.data?.id;
    const p = pid ? byKey.get(`participant:${pid}`) : null;
    if (!p) continue;

    const teamId = String(p.relationships?.team?.data?.id ?? "");
    const teamName = LEVERADE_TEAMS[teamId];
    if (!teamName) continue;
    const side = teamName === homeTeam ? out.home : teamName === awayTeam ? out.away : null;
    if (!side) continue;

    const licId = p.relationships?.license?.data?.id;
    const lic = licId ? byKey.get(`license:${licId}`) : null;
    if (lic?.attributes?.type && lic.attributes.type !== "player") continue; // DT, delegado…
    const profId = lic?.relationships?.profile?.data?.id;
    const prof = profId ? byKey.get(`profile:${profId}`) : null;
    if (!prof) continue;

    const name = cleanName(prof.attributes?.first_name, prof.attributes?.last_name);
    if (!name) continue;
    const number = Number(a.attributes?.number);
    const n = Number.isFinite(number) ? number : null;
    const isStarter = a.attributes?.as !== "reserve" && n != null && n <= 15;

    (isStarter ? side.starters : side.subs).push({
      name,
      number: n,
      position: isStarter && n != null ? (POSITION_BY_NUMBER[n] ?? null) : null,
      captain: Boolean(a.attributes?.captain),
    });
  }

  const bySeat = (x: LineupPlayer, y: LineupPlayer) => (x.number ?? 99) - (y.number ?? 99);
  for (const s of [out.home, out.away]) { s.starters.sort(bySeat); s.subs.sort(bySeat); }

  // Sin nadie en ninguno de los dos lados: acta sin cerrar. No cachear el vacío.
  if (out.home.starters.length === 0 && out.away.starters.length === 0) return null;
  void writeCache(key, out);
  return out;
}
