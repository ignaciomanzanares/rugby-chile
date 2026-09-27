/**
 * Head-to-head history across every top-flight season on arusa/leverade.
 *
 * The competition's structure changed over the years — "TOP 8" (2021-2022, two
 * phases), "Primera Nacional / División" (2023+), with grades sometimes as
 * separate tournaments and sometimes as groups. Rather than hard-code that, we
 * DISCOVER the top-flight tournaments per season (those containing COBS + Old
 * Boys) and classify each match's grade from the tournament name + group name.
 *
 * Everything is cached: the tournament list and each tournament's structure are
 * immutable for past seasons, and scores are cached per match. So once warm, a
 * pair's H2H is served from cache.
 */
import { readCache, readCacheEntry, writeCache } from "../lib/arusaCache";
import { fetchAllMatchesMeta } from "../lib/leverade";
import { USER_AGENT } from "../config";
import { robotsAllows } from "../lib/robots";
import type { DivisionKey } from "./computeStandings";

const LEVERADE = "https://api.leverade.com";
const ARUSA = "https://arusa.cl/en/tournament";
const MANAGER = "532872";
const SEASON_YEAR: Record<string, number> = {
  "4966": 2021, "5591": 2022, "6376": 2023, "7171": 2024, "8128": 2025, "8826": 2026,
};

/**
 * Las temporadas pasadas son inmutables y se cachean para siempre. La que se
 * está jugando NO: al cachearla igual, el historial quedaba congelado en los
 * partidos que existían cuando se llenó la caché. El Old Reds 38-21 Old Boys
 * no aparecía nunca, y el registro decía 6-0 en vez de 6-1.
 */
const TEMPORADA_VIVA = new Date().getFullYear();
const TTL_VIVO_MS = 60 * 60_000;

const CLUB_MATCH: [string, RegExp][] = [
  ["COBS", /cobs|craighouse old boys/i],
  ["Old Boys", /old boys|grangonian|grange/i],
  ["PWCC", /pwcc|prince of wales/i],
  ["Old Macks", /old mack|mackay/i],
  ["Stade Francais", /stade/i],
  ["Sporting RC", /sporting/i],
  ["DOBS", /dobs|dunalastair/i],
  ["UC", /cat[oó]lica|universidad cat|\buc\b/i],
  ["Old Johns", /old john|saint john|st\.? john/i],
  ["Old Reds", /old red/i],
];
export function canonTeam(name: string | undefined): string | null {
  if (!name) return null;
  for (const [canon, re] of CLUB_MATCH) if (re.test(name)) return canon;
  return null;
}

export function nameDivision(s: string): DivisionKey | null {
  const t = s.toLowerCase();
  if (t.includes("pre")) return "PRE_INTERMEDIA";
  if (t.includes("intermedia")) return "INTERMEDIA";
  if (t.includes("titular") || t.includes("primera") || t.includes("top")) return "PRIMERA";
  return null;
}

async function leverade(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${LEVERADE}${path}`, { headers: { Accept: "application/vnd.api+json", "User-Agent": USER_AGENT } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// ── Tournament index: every league tournament (all tiers + grades) with its
// canonical teams, so any pair's H2H spans 1st AND 2nd division, etc. ──
interface Tourn { year: number; id: string; name: string; teams: string[] }

async function tournamentTeams(id: string): Promise<string[] | null> {
  const key = `h2h:teams:${id}`;
  const cached = await readCache<string[]>(key);
  if (cached) return cached;
  const td = await leverade(`/tournaments/${id}?include=teams`);
  if (!td) return null;
  const names: (string | null)[] = (td.included ?? [])
    .filter((x: any) => x.type === "team")
    .map((x: any) => canonTeam(x.attributes?.name));
  const teams: string[] = Array.from(new Set(names.filter((n): n is string => n !== null)));
  void writeCache(key, teams);
  return teams;
}

async function buildIndex(): Promise<Tourn[]> {
  const cached = await readCache<Tourn[]>("h2h:index:v1");
  if (cached && cached.length) return cached;

  const mgr = await leverade(`/managers/${MANAGER}?include=tournaments`);
  if (!mgr) return [];
  // Keep championship leagues (any tier/grade); drop youth, women, sevens,
  // masters, regional/sub-leagues, promotion playoffs, and 2022's Apertura phase.
  const SKIP = /festival|apertura|femenin|sevens|master|m1[3468]|desarrollo|universitario|ascenso|repechaje|regional|proyec|circuito|\bprimera [a-d]\b|\b[b-d]\s*-/i;

  const out: Tourn[] = [];
  let failed = 0;
  for (const t of (mgr.included ?? [])) {
    if (t.type !== "tournament") continue;
    const year = SEASON_YEAR[(t.relationships?.season?.data ?? {}).id];
    if (!year) continue;
    const name: string = t.attributes?.name ?? "";
    if (SKIP.test(name)) continue;
    const teams = await tournamentTeams(String(t.id));
    if (!teams) { failed++; continue; }
    out.push({ year, id: String(t.id), name, teams });
  }
  // Only persist a complete index — a flaky network may have dropped some.
  if (out.length && failed === 0) void writeCache("h2h:index:v1", out);
  return out;
}

// ── Per-tournament structure (matches with canonical teams + grade) ──
interface StructMatch {
  id: string; home: string; away: string; date: string | null; division: DivisionKey;
  /** Ids de Leverade: con ellos se lee el marcador de /results sin adivinar el lado. */
  homeId?: string; awayId?: string;
}
async function fetchStructure(t: Tourn): Promise<StructMatch[]> {
  const key = `h2h:struct:v2:${t.id}`;
  const viva = t.year >= TEMPORADA_VIVA;
  const entrada = await readCacheEntry<StructMatch[]>(key);
  if (entrada && (!viva || entrada.ageMs < TTL_VIVO_MS)) return entrada.data;

  const [structure, teamsDoc] = await Promise.all([
    leverade(`/tournaments/${t.id}?include=groups.rounds.matches`),
    leverade(`/tournaments/${t.id}?include=teams`),
  ]);
  // Si Leverade falla, lo viejo es mejor que nada: devolver [] borraba el
  // historial entero del par mientras durara la caída.
  if (!structure || !teamsDoc) return entrada?.data ?? [];

  const inc: any[] = structure.included ?? [];
  const teamName: Record<string, string> = {};
  for (const x of (teamsDoc.included ?? [])) if (x.type === "team") teamName[x.id] = x.attributes?.name;
  const groupName: Record<string, string> = {};
  for (const g of inc) if (g.type === "group") groupName[g.id] = g.attributes?.name ?? "";
  const roundGroup: Record<string, string> = {};
  for (const r of inc) if (r.type === "round") roundGroup[r.id] = String(r.relationships?.group?.data?.id ?? "");

  const base = nameDivision(t.name) ?? "PRIMERA";
  const out: StructMatch[] = [];
  for (const m of inc) {
    if (m.type !== "match" || !m.attributes?.finished) continue;
    const homeId = String(m.meta?.home_team ?? "");
    const awayId = String(m.meta?.away_team ?? "");
    const home = canonTeam(teamName[homeId]);
    const away = canonTeam(teamName[awayId]);
    if (!home || !away) continue;
    const gName = groupName[roundGroup[String(m.relationships?.round?.data?.id ?? "")]] ?? "";
    const division = nameDivision(gName) ?? base; // group grade wins; else the tournament's grade
    out.push({ id: String(m.id), home, away, date: m.attributes?.datetime ?? null, division, homeId, awayId });
  }
  void writeCache(key, out);
  return out;
}

/**
 * Marcador desde Leverade. Es la fuente buena y la que faltaba: no tiene muro
 * ni límite por IP, al revés que arusa —donde el segundo partido seguido ya
 * responde 429 y el historial perdía ese cruce en silencio—. La fila de tiempo
 * completo es la que NO cuelga de un período.
 */
export function parseFullTimeScore(included: any[], homeId: string, awayId: string): [number, number] | null {
  const porEquipo = new Map<string, number>();
  for (const r of included ?? []) {
    // `value` es el marcador; `score` son los puntos de liga con bonus, que NO
    // sirven acá. Y las filas con período son los parciales por tiempo: contarlas
    // pisaría el marcador final con el del primer tiempo.
    if (r?.type !== "result" || r?.relationships?.period?.data) continue;
    const tid = String(r.relationships?.team?.data?.id ?? "");
    // Sin planilla cargada `value` viene null, y Number(null) es 0: sin este
    // corte el partido entraba al historial como un 0-0 que nunca pasó.
    const bruto = r.attributes?.value;
    if (bruto == null) continue;
    const v = Number(bruto);
    if (tid && Number.isFinite(v)) porEquipo.set(tid, v);
  }
  const h = porEquipo.get(homeId), a = porEquipo.get(awayId);
  return h != null && a != null ? [h, a] : null;
}

async function scoreFromLeverade(m: StructMatch): Promise<[number, number] | null> {
  if (!m.homeId || !m.awayId) return null;
  const doc = await leverade(`/matches?query=${encodeURIComponent(`id = "${m.id}"`)}&include=results`);
  return parseFullTimeScore(doc?.included ?? [], m.homeId, m.awayId);
}

/** Leverade primero; el scrape de arusa sólo si Leverade no tiene el dato. */
async function matchScore(tournamentId: string, m: StructMatch): Promise<[number, number] | null> {
  const key = `h2h:score:${m.id}`;
  const cached = await readCache<[number, number]>(key);
  if (cached) return cached;
  const score = (await scoreFromLeverade(m)) ?? (await scrapeScore(tournamentId, m.id));
  // Un 0-0 casi siempre es una planilla sin cargar, no un partido: no se fija.
  if (score && (score[0] > 0 || score[1] > 0)) void writeCache(key, score);
  return score;
}

const POINTS_RE = /<span>Points<\/span>\s*<span>(\d+)<\/span>/g;
async function scrapeScore(tournamentId: string, matchId: string): Promise<[number, number] | null> {
  try {
    const matchUrl = `${ARUSA}/${tournamentId}/match/${matchId}/results`;
    if (!(await robotsAllows(matchUrl))) return null;
    const res = await fetch(matchUrl, { headers: { "Accept-Language": "en", "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const html = await res.text();
    const nums: number[] = [];
    for (const m of html.matchAll(POINTS_RE)) nums.push(Number(m[1]));
    if (nums.length < 2) return null;
    return [nums[0], nums[1]];
  } catch {
    return null;
  }
}

export interface H2HMeeting {
  year: number;
  date: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

export interface H2H {
  teamA: string;
  teamB: string;
  meetings: H2HMeeting[];
  aWins: number;
  bWins: number;
  draws: number;
  aHomeWins: number;
  aAwayWins: number;
}

export async function computeH2H(division: DivisionKey, teamA: string, teamB: string): Promise<H2H> {
  const pairKey = [teamA, teamB].sort().join("__");
  const cacheKey = `h2h:v6:${division}:${pairKey}`;
  const entrada = await readCacheEntry<H2H>(cacheKey);
  const cached = entrada?.data ?? null;
  // NOTE: no early `return cached` — the cached counts may be for the other
  // ordering (see below); we reuse only its meetings and always recount.

  // The meetings (who played whom, when, final score) are absolute facts and get
  // cached. The win RECORD, however, is relative to which side is "teamA" — and
  // the cache key is order-independent (sorted), so the same cache entry serves
  // both orderings. So we always (re)count aWins/bWins from the meetings against
  // the REQUESTED teamA, never trusting cached counts. (Fixes the inverted record
  // when the cache was first populated with the teams in the other order.)
  // La caché del par tampoco puede ser eterna mientras la temporada corre:
  // se llenó antes de la fecha 17 y ese partido no entraba nunca.
  let meetings: H2HMeeting[];
  if (cached && cached.meetings.length > 0 && entrada!.ageMs < TTL_VIVO_MS) {
    meetings = cached.meetings;
  } else {
    const index = await buildIndex();
    const relevant = index.filter((t) => t.teams.includes(teamA) && t.teams.includes(teamB));
    const all: H2HMeeting[] = [];
    for (const t of relevant) {
      const matches = await fetchStructure(t);
      for (const m of matches) {
        if (m.division !== division) continue;
        if (!((m.home === teamA && m.away === teamB) || (m.home === teamB && m.away === teamA))) continue;
        const score = await matchScore(t.id, m);
        if (!score) continue;
        all.push({ year: t.year, date: m.date, homeTeam: m.home, awayTeam: m.away, homeScore: score[0], awayScore: score[1] });
      }
    }
    all.sort((x, y) => new Date(y.date ?? `${y.year}`).getTime() - new Date(x.date ?? `${x.year}`).getTime());
    // El historial no puede encoger: si el recálculo trajo menos partidos que
    // lo guardado (Leverade caído, 429 de arusa, índice a medias), manda la
    // caché. Vencer el TTL sirve para AGREGAR, no para perder.
    meetings = cached && cached.meetings.length > all.length ? cached.meetings : all;
  }

  let aWins = 0, bWins = 0, draws = 0, aHomeWins = 0, aAwayWins = 0;
  for (const m of meetings) {
    const aIsHome = m.homeTeam === teamA;
    const aScore = aIsHome ? m.homeScore : m.awayScore;
    const bScore = aIsHome ? m.awayScore : m.homeScore;
    if (aScore > bScore) { aWins++; if (aIsHome) aHomeWins++; else aAwayWins++; }
    else if (bScore > aScore) bWins++;
    else draws++;
  }

  const result: H2H = { teamA, teamB, meetings, aWins, bWins, draws, aHomeWins, aAwayWins };
  // Siempre se reescribe: además del dato, refresca updated_at, que es lo que
  // mide el TTL de arriba.
  if (meetings.length > 0) void writeCache(cacheKey, result);
  return result;
}

// Warm the H2H cache for the next round's Primera fixtures so opening them is
// instant. computeH2H short-circuits on the cache, so this is cheap once warm.
export async function prewarmH2H(): Promise<void> {
  try {
    const meta = await fetchAllMatchesMeta();
    const primera = meta.filter((m) => m.division === "PRIMERA");
    const upcoming = primera.filter((m) => !m.finished).map((m) => m.round);
    if (upcoming.length === 0) return;
    const nextRound = Math.min(...upcoming);
    for (const f of primera.filter((m) => m.round === nextRound)) {
      await computeH2H("PRIMERA", f.homeTeam, f.awayTeam).catch(() => {});
    }
  } catch {
    // best effort
  }
}
