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
import { readCache, readCacheEntry, writeCache } from "../lib/arusaCache";

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

/** Las dos nóminas cargadas. Con una sola, el partido todavía está a medias. */
function completa(l: MatchLineup): boolean {
  return l.home.starters.length > 0 && l.away.starters.length > 0;
}

/** Cuánto se sirve del caché una nómina de un partido que aún no termina. */
const FRESCA_MS = 10 * 60 * 1000;

/**
 * Nómina de UN partido.
 *
 * El caché es permanente sólo para lo que ya no puede cambiar. Antes se
 * guardaba CUALQUIER resultado, y como los clubes suben su nómina por separado
 * (a veces con horas de diferencia), bastaba que alguien abriera el partido
 * entremedio para congelar la mitad: el rival quedaba vacío para siempre.
 * Pasó de verdad el 2026-09-12 con Old Reds-Old Macks de Primera, que se veía
 * sin visita aunque Leverade tenía las dos.
 *
 * Ahora: sólo se guarda lo completo, y mientras el partido no termine se
 * revalida cada FRESCA_MS por si un club corrige la nómina antes del pitazo.
 */
export async function fetchLeveradeLineup(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
  finished = false,
): Promise<MatchLineup | null> {
  const key = `lineup:${matchId}`;
  const entrada = await readCacheEntry<MatchLineup>(key);
  const cached = entrada?.data ?? null;
  if (cached && completa(cached) && (finished || entrada!.ageMs < FRESCA_MS)) return cached;

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

  const out = parseLineup(json?.included ?? [], homeTeam, awayTeam, matchId);
  // Nada nuevo arriba: mejor lo que ya teníamos que un vacío.
  if (!out) return cached;
  // Sólo lo completo se persiste; lo demás se vuelve a pedir la próxima vez.
  if (completa(out)) void writeCache(key, out);
  return out;
}

/**
 * Arma la nómina de UN partido a partir del `included` de una respuesta que
 * puede traer varios. `matchId` filtra las attendance cuando la respuesta es de
 * una página con muchos partidos (lo usa el backfill masivo).
 */
function parseLineup(
  inc: any[],
  homeTeam: string,
  awayTeam: string,
  matchId?: string,
): MatchLineup | null {
  const byKey = new Map<string, any>(inc.map((x) => [`${x.type}:${x.id}`, x]));

  const out: MatchLineup = {
    home: { team: homeTeam, starters: [], subs: [] },
    away: { team: awayTeam, starters: [], subs: [] },
  };

  for (const a of inc.filter((x) => x.type === "attendance")) {
    if (matchId && a.relationships?.match?.data?.id !== matchId) continue;
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

  // Sin nadie en ninguno de los dos lados: nómina sin cargar. No se cachea el
  // vacío, así se vuelve a intentar cuando el club la suba.
  if (out.home.starters.length === 0 && out.away.starters.length === 0) return null;
  return out;
}

/**
 * Backfill masivo: recorre los partidos de una división por páginas y persiste
 * la nómina de cada uno. Pide 15 partidos por request (con más, la API devuelve
 * 500 con este include), así que una división entera son ~6 requests en vez de
 * uno por partido. Idempotente: lo ya cacheado no se vuelve a pedir.
 */
export async function backfillLineups(
  groupId: string,
  meta: { matchId: string; homeTeam: string; awayTeam: string; finished: boolean }[],
  maxPages = 12,
): Promise<{ total: number; yaEstaban: number; guardados: number; sinNomina: number }> {
  const byId = new Map(meta.map((m) => [m.matchId, m]));
  let yaEstaban = 0, guardados = 0, sinNomina = 0;
  const vistos = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const query = encodeURIComponent(`round.group.id = "${groupId}"`);
    const include = "attendances.participant.license.profile,attendances.participant.team";
    let json: any;
    try {
      const res = await fetch(
        `${LEVERADE_BASE}/matches?query=${query}&include=${include}&page[size]=15&page[number]=${page}`,
        { headers: { Accept: "application/vnd.api+json" }, signal: AbortSignal.timeout(90_000) },
      );
      if (!res.ok) break;
      json = await res.json();
    } catch {
      break;
    }
    const data: any[] = json?.data ?? [];
    if (data.length === 0) break;
    const inc: any[] = json?.included ?? [];

    for (const m of data) {
      const id = String(m.id);
      const info = byId.get(id);
      if (!info || vistos.has(id)) continue;
      vistos.add(id);
      // Igual que arriba: una nómina a medias no cuenta como guardada, o el
      // backfill la daría por lista y el rival no aparecería nunca.
      const previo = await readCache<MatchLineup>(`lineup:${id}`);
      if (previo && completa(previo)) { yaEstaban += 1; continue; }
      const lu = parseLineup(inc, info.homeTeam, info.awayTeam, id);
      if (!lu || !completa(lu)) { sinNomina += 1; continue; }
      await writeCache(`lineup:${id}`, lu);
      guardados += 1;
    }
  }
  return { total: vistos.size, yaEstaban, guardados, sinNomina };
}
