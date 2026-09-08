/**
 * Censo de jugadores de un torneo, desde las planillas de Leverade.
 *
 * Recorre los partidos de un grupo (división) juntando todas las `attendance` y
 * arma, por jugador: club, presencias y el número de camiseta que más repite.
 * En rugby el número ES la posición, así que la moda de sus números da la
 * posición real sin que nadie transcriba nada — y con evidencia: "jugó 15 de 17
 * partidos con el 2" es un hooker, no una suposición.
 *
 * OJO — DATOS PERSONALES: el `profile` de Leverade trae fecha de nacimiento y
 * nacionalidad. Acá se leen SOLO nombre y apellido. ARUSA corre doce torneos
 * juveniles (M13-M18) sobre la misma API: ahí son menores.
 *
 * PRECAUCIÓN DE USO: `syncLeveradePlayers` es dry-run por defecto. El pool de
 * jugadores alimenta el fantasy (equipos armados, precios, ranking), así que
 * meter cientos de jugadores nuevos en mitad de la temporada puede romperlo.
 * Correr con { apply: true } solo a conciencia y fuera de una fecha en juego.
 */
import { LEVERADE_TEAMS } from "../lib/leverade";

const LEVERADE_BASE = "https://api.leverade.com";
const PAGE_SIZE = 15; // más que esto y la API devuelve 500 con este include

/** Titular: el número es la posición. Suplente: convención de banca del rugby. */
const POSITION_BY_NUMBER: Record<number, string> = {
  1: "PROP", 2: "HOOKER", 3: "PROP", 4: "LOCK", 5: "LOCK",
  6: "FLANKER", 7: "FLANKER", 8: "NUMBER_8", 9: "SCRUM_HALF", 10: "FLY_HALF",
  11: "WING", 12: "CENTER", 13: "CENTER", 14: "WING", 15: "FULLBACK",
  16: "HOOKER", 17: "PROP", 18: "PROP", 19: "LOCK", 20: "FLANKER",
  21: "SCRUM_HALF", 22: "FLY_HALF", 23: "CENTER",
};

export interface PlayerCensusRow {
  name: string;
  team: string | null;
  appearances: number;
  /** Número más repetido entre los 1-15; si nunca fue titular, el de banca. */
  number: number | null;
  position: string | null;
  numbers: Record<number, number>;
}

async function fetchPage(groupId: string, page: number): Promise<any | null> {
  const query = encodeURIComponent(`round.group.id = "${groupId}"`);
  const include = "attendances.participant.license.profile,attendances.participant.team";
  try {
    const res = await fetch(
      `${LEVERADE_BASE}/matches?query=${query}&include=${include}&page[size]=${PAGE_SIZE}&page[number]=${page}`,
      { headers: { Accept: "application/vnd.api+json" }, signal: AbortSignal.timeout(90_000) },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Censo completo de una división. `maxPages` acota el recorrido. */
export async function buildPlayerCensus(groupId: string, maxPages = 12): Promise<PlayerCensusRow[]> {
  const team = new Map<string, string | null>();
  const counts = new Map<string, Map<number, number>>();
  const apps = new Map<string, number>();

  for (let page = 1; page <= maxPages; page++) {
    const json = await fetchPage(groupId, page);
    const data: any[] = json?.data ?? [];
    if (data.length === 0) break;
    const inc: any[] = json?.included ?? [];
    const by = new Map<string, any>(inc.map((x) => [`${x.type}:${x.id}`, x]));
    const teamNames = new Map<string, string>(
      inc.filter((x) => x.type === "team").map((x) => [x.id, x.attributes?.name]),
    );

    for (const a of inc.filter((x) => x.type === "attendance")) {
      const pid = a.relationships?.participant?.data?.id;
      const p = pid ? by.get(`participant:${pid}`) : null;
      if (!p) continue;
      const licId = p.relationships?.license?.data?.id;
      const lic = licId ? by.get(`license:${licId}`) : null;
      if (lic?.attributes?.type && lic.attributes.type !== "player") continue;
      const profId = lic?.relationships?.profile?.data?.id;
      const prof = profId ? by.get(`profile:${profId}`) : null;
      if (!prof) continue;

      // Solo nombre y apellido: la fecha de nacimiento NO se toca (ver cabecera).
      const name = `${prof.attributes?.first_name ?? ""} ${prof.attributes?.last_name ?? ""}`
        .replace(/\s+/g, " ").trim();
      if (!name) continue;

      const tid = String(p.relationships?.team?.data?.id ?? "");
      team.set(name, LEVERADE_TEAMS[tid] ?? teamNames.get(tid) ?? null);
      apps.set(name, (apps.get(name) ?? 0) + 1);

      const n = Number(a.attributes?.number);
      if (Number.isFinite(n) && n > 0) {
        const c = counts.get(name) ?? new Map<number, number>();
        c.set(n, (c.get(n) ?? 0) + 1);
        counts.set(name, c);
      }
    }
  }

  const rows: PlayerCensusRow[] = [];
  for (const [name, appearances] of apps) {
    const c = counts.get(name) ?? new Map<number, number>();
    const entries = [...c.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    // Preferir la moda entre los 1-15 (titular): dice la posición sin ambigüedad.
    // Después la banca (16-23). Los números >23 son de plantel ampliado y no
    // mapean a ninguna posición, así que no se usan para deducirla —antes
    // ganaban por frecuencia y el jugador quedaba sin posición.
    const starter = entries.filter(([n]) => n <= 15);
    const bench = entries.filter(([n]) => n > 15 && n <= 23);
    const best = (starter.length ? starter : bench.length ? bench : entries)[0];
    const number = best ? best[0] : null;
    rows.push({
      name,
      team: team.get(name) ?? null,
      appearances,
      number,
      position: number != null ? (POSITION_BY_NUMBER[number] ?? null) : null,
      numbers: Object.fromEntries(entries),
    });
  }
  return rows.sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name));
}
