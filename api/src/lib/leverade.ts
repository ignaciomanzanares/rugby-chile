/**
 * Shared helpers for fetching tournament data.
 *
 * Match metadata (rounds, teams, datetime, finished flag) still comes from
 * Leverade's public tournament endpoint — no auth required. Scores, however,
 * are now auth-gated on the JSON API. arusa.cl renders them into server-side
 * HTML, so we scrape the public match-results page to recover them.
 */

import { readCache, writeCache } from "./arusaCache";
import { USER_AGENT } from "../config";
import { robotsAllows } from "./robots";

const TOURNAMENT_ID = "1328550";
const LEVERADE_BASE = "https://api.leverade.com";
const ARUSA_BASE = `https://arusa.cl/en/tournament/${TOURNAMENT_ID}`;
// Spanish locale for play-by-play scrape — the event labels (Ensayo,
// Conversión, Penalti, Tarjeta amarilla, …) are in Spanish there.
const ARUSA_BASE_ES = `https://arusa.cl/es/tournament/${TOURNAMENT_ID}`;
const ARUSA_AJAX_ES = `https://arusa.cl/es/ajax/tournament/${TOURNAMENT_ID}`;
const ARUSA_AJAX_EN = "https://arusa.cl/en/ajax";
// Per-request cap on arusa scrapes so one hung connection can't stall a whole
// batch (e.g. scraping tries across ~45 matches) forever.
const SCRAPE_TIMEOUT_MS = 8000;

export type DivisionKey = "PRIMERA" | "INTERMEDIA" | "PRE_INTERMEDIA";

// Tournament 1328550 has three groups, one per division.
export const GROUP_TO_DIVISION: Record<string, DivisionKey> = {
  "3667033": "PRIMERA",
  "3667034": "INTERMEDIA",
  "3667035": "PRE_INTERMEDIA",
};

export const DIVISION_TO_GROUP: Record<DivisionKey, string> = {
  PRIMERA: "3667033",
  INTERMEDIA: "3667034",
  PRE_INTERMEDIA: "3667035",
};

// Leverade team ID → our canonical name.
export const LEVERADE_TEAMS: Record<string, string> = {
  "15747914": "COBS",
  "15747921": "DOBS",
  "15747906": "Old Boys",
  "15747910": "Stade Francais",
  "15747908": "Old Macks",
  "15747909": "Sporting RC",
  "15747907": "Old Johns",
  "15747912": "PWCC",
  "15747915": "UC",
  "15747913": "Old Reds",
};

export interface MatchMeta {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string;
  awayTeamId: string;
  division: DivisionKey;
  round: number;
  finished: boolean;
  // Flags oficiales de Leverade (los mismos que muestra arusa). Un partido
  // postergado o cancelado NO se juega en su horario, así que nunca debe salir
  // "en vivo" (evita el fantasma 0-0 con minuto corriendo).
  postponed: boolean;
  canceled: boolean;
  datetime: string | null;
  // Score straight from Leverade's own `result` rows (attributes.value). Used as
  // a fallback for the arusa scrape — arusa is the primary source (live minute +
  // event timeline), but when it's rate-limiting/down (429), these keep scores
  // and final results flowing. null/undefined until Leverade publishes a value.
  homeScore?: number;
  awayScore?: number;
}

async function leveradeGet(path: string): Promise<any> {
  const url = `${LEVERADE_BASE}${path}`;
  if (!(await robotsAllows(url))) throw new Error(`Leverade ${path} → blocked by robots.txt`);
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.api+json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Leverade ${path} → ${res.status}`);
  return res.json();
}

// ── Match metadata cache ────────────────────────────────────────────────────
let metaCache: { data: MatchMeta[]; ts: number } | null = null;
const META_TTL = 5 * 60 * 1000;

export async function fetchAllMatchesMeta(): Promise<MatchMeta[]> {
  if (metaCache && Date.now() - metaCache.ts < META_TTL) return metaCache.data;

  const data = await leveradeGet(
    // `.results` pulls each match's own score rows (result.attributes.value) in
    // the same request — no extra round-trip — so we have a Leverade-native
    // score fallback for when the arusa scrape is blocked.
    `/tournaments/${TOURNAMENT_ID}?include=groups.rounds.matches.results`,
  );
  const inc: any[] = data.included ?? [];

  // matchId → (teamId → score value). Leverade emits one `result` per team with
  // attributes.value = points scored (null until the match is played).
  const resultByMatch = new Map<string, Map<string, number>>();
  for (const r of inc) {
    if (r.type !== "result") continue;
    const value = r.attributes?.value;
    if (value == null) continue; // not played yet
    const mid = String(r.relationships?.match?.data?.id ?? "");
    const tid = String(r.relationships?.team?.data?.id ?? "");
    if (!mid || !tid) continue;
    let byTeam = resultByMatch.get(mid);
    if (!byTeam) { byTeam = new Map(); resultByMatch.set(mid, byTeam); }
    byTeam.set(tid, Number(value));
  }

  const roundToGroup: Record<string, string> = {};
  const roundToNumber: Record<string, number> = {};
  for (const r of inc) {
    if (r.type !== "round") continue;
    const gid = r.relationships?.group?.data?.id;
    if (gid) roundToGroup[String(r.id)] = String(gid);
    // round names look like "1. Fecha 1" — the Fecha number is the round.
    const fm = /Fecha\s+(\d+)/i.exec(r.attributes?.name ?? "");
    if (fm) roundToNumber[String(r.id)] = Number(fm[1]);
  }

  const matches: MatchMeta[] = [];
  for (const m of inc) {
    if (m.type !== "match") continue;
    const roundId = String(m.relationships?.round?.data?.id ?? "");
    const groupId = roundToGroup[roundId];
    const division = GROUP_TO_DIVISION[groupId];
    if (!division) continue;

    const homeTeamId = String(m.meta?.home_team ?? "");
    const awayTeamId = String(m.meta?.away_team ?? "");
    const homeTeam = LEVERADE_TEAMS[homeTeamId];
    const awayTeam = LEVERADE_TEAMS[awayTeamId];
    if (!homeTeam || !awayTeam) continue;

    const byTeam = resultByMatch.get(String(m.id));
    matches.push({
      matchId: String(m.id),
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      division,
      round: roundToNumber[roundId] ?? 0,
      finished: Boolean(m.attributes?.finished),
      postponed: Boolean(m.attributes?.postponed),
      canceled: Boolean(m.attributes?.canceled),
      datetime: m.attributes?.datetime ?? null,
      homeScore: byTeam?.get(homeTeamId),
      awayScore: byTeam?.get(awayTeamId),
    });
  }

  metaCache = { data: matches, ts: Date.now() };
  return matches;
}

// ── Score scrape (arusa.cl per match) ───────────────────────────────────────
// Scores don't change once a match is finished, so once we capture a complete
// pair we hold it forever. In-progress matches are scraped fresh each time.
export interface MatchPageInfo {
  homeScore?: number;
  awayScore?: number;
  referees?: string[];
}

const scoreCache = new Map<string, MatchPageInfo>();
const POINTS_RE = /<span>Points<\/span>\s*<span>(\d+)<\/span>/g;

// arusa renders referees as `<div>Referees</div> Name1 , Name2, …` inside a col.
function parseReferees(html: string): string[] {
  const m = /<div>\s*Referees?\s*<\/div>\s*([\s\S]*?)<\/div>/i.exec(html);
  if (!m) return [];
  return stripTags(m[1])
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A captured score, from memory or the durable cache — no network. Finished
// scores are immutable, so once captured we hold them: in-memory for the process
// and persisted (arusaCache) so a restart doesn't lose the whole backfill and
// fall back to a stale snapshot.
async function getCachedScore(matchId: string): Promise<MatchPageInfo | null> {
  const mem = scoreCache.get(matchId);
  if (mem && mem.homeScore != null && mem.awayScore != null) return mem;
  const persisted = await readCache<MatchPageInfo>(`score:${matchId}`);
  if (persisted && persisted.homeScore != null && persisted.awayScore != null) {
    scoreCache.set(matchId, persisted);
    return persisted;
  }
  return null;
}

// ── arusa rate-limit circuit breaker ────────────────────────────────────────
// arusa (nginx + a Laravel throttle keyed by IP) answers 429 with a Retry-After
// once too many match pages are pulled. Crucially, hammering while blocked only
// keeps the ban alive (its Retry-After we've seen reach *days*), so the moment we
// see a 429 we go quiet for a cooldown and only then probe again. Scores are
// immutable and cached forever after first capture, so a slow, polite backfill
// loses nothing — it just fills in over more 60s cycles.
let arusaBlockedUntil = 0;
// Never self-block longer than this before re-probing (so we recover soon after
// arusa's throttle actually lifts), even if it asks us to wait days.
const ARUSA_BLOCK_CAP_MS = 60 * 60 * 1000;
const ARUSA_BLOCK_DEFAULT_MS = 15 * 60 * 1000; // when arusa sends no Retry-After
// Small pause between score pages so a batch never bursts and trips the throttle.
const ARUSA_PACE_MS = 350;

export function isArusaBlocked(): boolean {
  return Date.now() < arusaBlockedUntil;
}

function tripArusaBreaker(retryAfter: string | null): void {
  const ra = Number(retryAfter);
  const asked = Number.isFinite(ra) && ra > 0 ? ra * 1000 : ARUSA_BLOCK_DEFAULT_MS;
  const cooldown = Math.min(asked, ARUSA_BLOCK_CAP_MS);
  arusaBlockedUntil = Date.now() + cooldown;
  console.warn(`[arusa] 429 rate-limited — pausing scrapes ${Math.round(cooldown / 60000)}min (Retry-After: ${retryAfter ?? "none"})`);
}

// Fetch one arusa page, respecting the breaker. Returns null when blocked, on a
// network error, or on any non-2xx (including 429, which also trips the breaker).
async function fetchArusaPage(url: string): Promise<string | null> {
  if (isArusaBlocked()) return null;
  if (!(await robotsAllows(url))) return null;
  try {
    const res = await fetch(url, {
      headers: { "Accept-Language": "en", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    });
    if (res.status === 429) { tripArusaBreaker(res.headers.get("retry-after")); return null; }
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function scrapeArusaScore(
  matchId: string,
  options: { force?: boolean } = {},
): Promise<MatchPageInfo> {
  if (!options.force) {
    const cached = await getCachedScore(matchId);
    if (cached) return cached;
  }

  const html = await fetchArusaPage(`${ARUSA_BASE}/match/${matchId}/results`);
  if (html == null) return {};

  const referees = parseReferees(html);
  const nums: number[] = [];
  for (const m of html.matchAll(POINTS_RE)) nums.push(Number(m[1]));

  const result: MatchPageInfo = {};
  if (referees.length) result.referees = referees;
  if (nums.length >= 2) {
    result.homeScore = nums[0];
    result.awayScore = nums[1];
    scoreCache.set(matchId, result);
    if (!options.force) void writeCache(`score:${matchId}`, result); // durable backfill
  }
  return result;
}

// Cap on how many *uncached* matches to scrape per call. Everything already
// captured is served from cache for free; only this many fresh pages are pulled
// each time, so the request stays fast and arusa isn't hammered. With the durable
// per-match cache, a full-season backfill just completes over a few 60s polls —
// newest rounds first, so a freshly-played fecha shows up first.
const MAX_FRESH_SCRAPES_PER_CALL = 12;

// Some past matches never yield a score (suspended fixtures like a rained-out
// fecha, or a result arusa hasn't published yet). Without this they'd re-consume
// the scrape budget every single call and stall the real backfill, so a match
// that comes back score-less is put on a cooldown before it's tried again.
const emptyScrapeAt = new Map<string, number>();
const EMPTY_RETRY_MS = 10 * 60 * 1000;

export async function batchScrapeScores(
  matches: MatchMeta[],
  concurrency = 2,
): Promise<Map<string, { homeScore?: number; awayScore?: number }>> {
  const out = new Map<string, { homeScore?: number; awayScore?: number }>();

  // Serve everything already captured instantly; collect the rest as misses,
  // newest round first so recent fechas are backfilled ahead of old ones. Skip
  // matches on the score-less cooldown so they don't crowd out capturable ones.
  const now = Date.now();
  const misses: MatchMeta[] = [];
  for (const m of [...matches].sort((a, b) => b.round - a.round)) {
    const cached = await getCachedScore(m.matchId);
    if (cached) { out.set(m.matchId, cached); continue; }
    const lastEmpty = emptyScrapeAt.get(m.matchId);
    if (lastEmpty && now - lastEmpty < EMPTY_RETRY_MS) { out.set(m.matchId, {}); continue; }
    misses.push(m);
  }

  // Nothing to gain hitting arusa while the breaker is open — bail cheaply.
  if (isArusaBlocked()) return out;

  // Scrape only a bounded slice of the misses this call.
  const toScrape = misses.slice(0, MAX_FRESH_SCRAPES_PER_CALL);
  const queue = [...toScrape];
  async function worker() {
    while (queue.length) {
      const m = queue.shift();
      if (!m) return;
      if (isArusaBlocked()) return; // a sibling worker tripped the breaker — stop
      const html = await fetchArusaPage(`${ARUSA_BASE}/match/${m.matchId}/results`);
      if (html == null) { out.set(m.matchId, {}); continue; } // network/429 — retry next call
      const nums: number[] = [];
      for (const mm of html.matchAll(POINTS_RE)) nums.push(Number(mm[1]));
      if (nums.length >= 2) {
        const score = { homeScore: nums[0], awayScore: nums[1] };
        scoreCache.set(m.matchId, score);
        void writeCache(`score:${m.matchId}`, score); // durable backfill
        emptyScrapeAt.delete(m.matchId);
        out.set(m.matchId, score);
      } else {
        emptyScrapeAt.set(m.matchId, Date.now()); // score-less page — back off
        out.set(m.matchId, {});
      }
      if (queue.length) await sleep(ARUSA_PACE_MS); // pace so a batch never bursts
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, toScrape.length) }, worker),
  );
  return out;
}

// ── Standings scrape ────────────────────────────────────────────────────────
export interface StandingRow {
  pos: number;
  team: string;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  pf: number;
  pc: number;
  diff: number;
  pts: number;
}

const standingsCache = new Map<DivisionKey, { data: StandingRow[]; ts: number }>();
const STANDINGS_TTL = 60 * 1000;

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function extractTd(row: string, cls: string): string | null {
  const re = new RegExp(
    `<td[^>]*class=\"${cls}(?:\\s[^\"]*)?\"[^>]*>([\\s\\S]*?)<\\/td>`,
    "i",
  );
  const m = re.exec(row);
  return m ? m[1] : null;
}

function parseStandingsHTML(html: string): StandingRow[] {
  const tbody = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(html);
  if (!tbody) return [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows: StandingRow[] = [];
  for (const tr of tbody[1].matchAll(trRe)) {
    const row = tr[1];
    const pos = Number(stripTags(extractTd(row, "colstyle-posicion") ?? "0"));
    const name = stripTags(extractTd(row, "colstyle-nombre") ?? "");
    const pts = Number(stripTags(extractTd(row, "colstyle-puntos") ?? "0"));
    const pj = Number(stripTags(extractTd(row, "colstyle-partidos-jugados") ?? "0"));
    const pg = Number(stripTags(extractTd(row, "colstyle-partidos-ganados") ?? "0"));
    const pe = Number(stripTags(extractTd(row, "colstyle-partidos-empatados") ?? "0"));
    const pp = Number(stripTags(extractTd(row, "colstyle-partidos-perdidos") ?? "0"));
    const pf = Number(stripTags(extractTd(row, "colstyle-valor") ?? "0"));
    const pc = Number(stripTags(extractTd(row, "colstyle-contravalor") ?? "0"));
    const diff = Number(stripTags(extractTd(row, "colstyle-diferencia-valor") ?? "0"));
    if (!name || !pos) continue;
    rows.push({ pos, team: name, pj, pg, pe, pp, pf, pc, diff, pts });
  }
  return rows.sort((a, b) => a.pos - b.pos);
}

export async function fetchStandings(division: DivisionKey): Promise<StandingRow[] | null> {
  const cached = standingsCache.get(division);
  if (cached && Date.now() - cached.ts < STANDINGS_TTL) return cached.data;

  const groupId = DIVISION_TO_GROUP[division];
  try {
    const res = await fetch(`${ARUSA_BASE}/ranking/${groupId}`, {
      headers: { "Accept-Language": "en", "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`ranking ${res.status}`);
    const html = await res.text();
    const rows = parseStandingsHTML(html);
    if (rows.length === 0) throw new Error("empty standings");
    standingsCache.set(division, { data: rows, ts: Date.now() });
    void writeCache(`standings:${division}`, rows); // persist last-good
    return rows;
  } catch {
    // arusa unreachable — serve the last captured snapshot if we have one, so
    // the table holds the latest real data instead of reverting to baseline.
    const persisted = await readCache<StandingRow[]>(`standings:${division}`);
    if (persisted && persisted.length > 0) {
      standingsCache.set(division, { data: persisted, ts: Date.now() });
      return persisted;
    }
    return null;
  }
}

export function resolveDivision(raw: unknown): DivisionKey {
  const d = typeof raw === "string" ? raw.toUpperCase() : "PRIMERA";
  return d in DIVISION_TO_GROUP ? (d as DivisionKey) : "PRIMERA";
}

// ── Player stats scrape (arusa per-division statistics) ─────────────────────
export interface PlayerStatRow {
  id: string;
  name: string;
  team: string;
  teamSlug: string;
  matches: number;
  points: number;
  tries: number;
  penaltyTries: number;
  conversions: number;
  penalties: number;
  drops: number;
  yellowCards: number;
  redCards: number;
  mvp: number;
}

// arusa display name → our canonical name (mirrors the web NAME_ALIASES).
const TEAM_CANON: Record<string, string> = {
  "Old Mackayans": "Old Macks",
  "Prince of Wales CC": "PWCC",
  "Stade Français": "Stade Francais",
  "Univ. Católica": "UC",
  "Old Boys RC": "Old Boys",
  "Old Johns RC": "Old Johns",
  "Old Reds RC": "Old Reds",
};

// Map an arusa display name onto our canonical team name (no-op if already
// canonical). Lets standings rows (display names) join the results feed
// (canonical names) by team.
export function canonicalTeam(name: string): string {
  return TEAM_CANON[name] ?? name;
}

const TEAM_SLUG: Record<string, string> = {
  COBS: "cobs", "Old Boys": "old-boys", PWCC: "pwcc", "Old Macks": "old-macks",
  "Stade Francais": "stade-francais", "Sporting RC": "sporting-rc", DOBS: "dobs",
  UC: "uc", "Old Johns": "old-johns", "Old Reds": "old-reds",
};

/** Slug del club a partir del nombre canónico (para el filtro de notificaciones). */
export function teamSlug(name: string): string | undefined {
  return TEAM_SLUG[name];
}

const num = (s: string | null) => Number(stripTags(s ?? "0")) || 0;

function parsePlayerStatsHTML(html: string): PlayerStatRow[] {
  const rows: PlayerStatRow[] = [];
  // Parse every player row (works on both the full page and AJAX page fragments).
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = tr[1];
    if (!row.includes("colstyle-jugador")) continue;
    // strip a leading UI word ("Look"/"Ver") that arusa renders in the name cell
    const name = stripTags(extractTd(row, "colstyle-jugador") ?? "").replace(/^(Look|Ver)\s+/i, "").trim();
    if (!name) continue;
    const teamRaw = stripTags(extractTd(row, "colstyle-equipo") ?? "");
    const team = TEAM_CANON[teamRaw] ?? teamRaw;
    const idM = /\/players\/(\d+)/.exec(row);
    const stat: PlayerStatRow = {
      id: idM ? idM[1] : `${team}-${name}`,
      name,
      team,
      teamSlug: TEAM_SLUG[team] ?? "",
      matches: num(extractTd(row, "colstyle-partidos-jugados")),
      points: num(extractTd(row, "colstyle-puntos-totales")),
      tries: num(extractTd(row, "colstyle-tries")),
      penaltyTries: num(extractTd(row, "colstyle-tries-penalti")),
      conversions: num(extractTd(row, "colstyle-conversiones")),
      penalties: num(extractTd(row, "colstyle-penalti")),
      drops: num(extractTd(row, "colstyle-drops")),
      yellowCards: num(extractTd(row, "colstyle-tarjetas-amarillas")),
      redCards: num(extractTd(row, "colstyle-tarjetas-rojas")),
      mvp: num(extractTd(row, "colstyle-mvp")),
    };
    // arusa marca 0 "partidos jugados" a los que entran desde la banca, aunque
    // hayan anotado o recibido una tarjeta. Si hay CUALQUIER actividad, jugó al
    // menos 1 partido → piso PJ a 1 (afecta estadísticas, plantel y elegibilidad
    // en el fantasy, que filtra por matches > 0).
    const activity =
      stat.points + stat.tries + stat.penaltyTries + stat.conversions +
      stat.penalties + stat.drops + stat.yellowCards + stat.redCards + stat.mvp;
    if (stat.matches === 0 && activity > 0) stat.matches = 1;
    rows.push(stat);
  }
  return rows;
}

const playerStatsCache = new Map<DivisionKey, { data: PlayerStatRow[]; ts: number }>();
const PLAYER_STATS_TTL = 60 * 1000;

// arusa's statistics table is a paginated clupik table (~50 rows/page). Pull a
// single page via its GET AJAX endpoint.
async function fetchStatsPage(groupId: string, page: number): Promise<PlayerStatRow[]> {
  const qs = new URLSearchParams({
    input: String(page), type: "11", id: groupId, rows: "50", actual: "1", column: "jugador.asc",
  });
  const res = await fetch(`${ARUSA_AJAX_EN}/table-page?${qs}`, {
    headers: { "Accept-Language": "en", "X-Requested-With": "XMLHttpRequest", "User-Agent": USER_AGENT },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { code?: number; content?: string };
  if (json.code !== 0 || !json.content) return [];
  return parsePlayerStatsHTML(json.content);
}

export async function fetchPlayerStats(division: DivisionKey): Promise<PlayerStatRow[] | null> {
  const cached = playerStatsCache.get(division);
  if (cached && Date.now() - cached.ts < PLAYER_STATS_TTL) return cached.data;

  const groupId = DIVISION_TO_GROUP[division];
  try {
    // Walk every page so all players show — not just the first 50.
    const byId = new Map<string, PlayerStatRow>();
    for (let page = 1; page <= 12; page++) {
      const rows = await fetchStatsPage(groupId, page);
      if (rows.length === 0) break;
      for (const r of rows) byId.set(r.id, r);
      if (rows.length < 50) break; // last page
    }
    const all = [...byId.values()];
    if (all.length === 0) throw new Error("empty player stats");
    playerStatsCache.set(division, { data: all, ts: Date.now() });
    void writeCache(`players:${division}`, all);
    return all;
  } catch {
    const persisted = await readCache<PlayerStatRow[]>(`players:${division}`);
    if (persisted && persisted.length > 0) {
      playerStatsCache.set(division, { data: persisted, ts: Date.now() });
      return persisted;
    }
    return null;
  }
}

// ── Play-by-play events scrape ──────────────────────────────────────────────
// The minute-by-minute timeline lives on the PUBLIC match page — no login, no
// paywall. arusa (a Laravel app) just loads that tab over AJAX, and Laravel
// requires a CSRF token + session cookie on the AJAX call as anti-CSRF hygiene.
// So we do exactly what an anonymous browser's own JS does: GET the public match
// page to receive the freely-issued session cookie + csrf_token, then POST
// /change-tab with tab=minute_by_minute carrying them back. This is NOT bypassing
// authentication or an access control — the token/cookie are handed to any
// visitor; they only prove the request came from a page arusa served. The JSON
// `content` field holds the events HTML, which we parse into structured rows.

export type LiveEventType =
  | "TRY"
  | "CONVERSION"
  | "PENALTY"
  | "DROP_GOAL"
  | "YELLOW_CARD"
  | "RED_CARD";

export interface ArusaEvent {
  minute: number;
  second: number;
  team: "home" | "away";
  type: LiveEventType;
  playerName: string | null;
  playerNumber: number | null;
  homeScore: number;
  awayScore: number;
}

const EVENT_TYPE_MAP: Record<string, LiveEventType> = {
  "Ensayo": "TRY",
  "Conversión": "CONVERSION",
  "Penalti": "PENALTY",
  "Penal": "PENALTY",
  "Drop": "DROP_GOAL",
  "Tarjeta amarilla": "YELLOW_CARD",
  "Tarjeta roja": "RED_CARD",
};

const POINTS_BY_TYPE: Record<LiveEventType, number> = {
  TRY: 5,
  CONVERSION: 2,
  PENALTY: 3,
  DROP_GOAL: 3,
  YELLOW_CARD: 0,
  RED_CARD: 0,
};

export function pointsForEventType(t: LiveEventType): number {
  return POINTS_BY_TYPE[t];
}

const CSRF_RE = /csrf_token" value="([^"]+)"/;

async function getCsrfAndCookies(
  matchId: string,
): Promise<{ csrf: string; cookies: string } | null> {
  if (isArusaBlocked()) return null; // respect the rate-limit breaker
  try {
    const res = await fetch(`${ARUSA_BASE_ES}/match/${matchId}/results`, {
      headers: { "Accept-Language": "es", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    });
    if (res.status === 429) { tripArusaBreaker(res.headers.get("retry-after")); return null; }
    if (!res.ok) return null;
    // Node 19+ — fall back to single header if the array form isn't available.
    const setCookies: string[] =
      typeof (res.headers as any).getSetCookie === "function"
        ? (res.headers as any).getSetCookie()
        : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie") as string] : []);
    const cookies = setCookies.map((c) => c.split(";")[0]).join("; ");
    const html = await res.text();
    const m = html.match(CSRF_RE);
    if (!m) return null;
    return { csrf: m[1], cookies };
  } catch {
    return null;
  }
}

function parseEvents(html: string): ArusaEvent[] {
  const events: ArusaEvent[] = [];
  const splits = html.split(/<div class="incidence (left|right)">/);
  let lastHome = 0;
  let lastAway = 0;
  for (let i = 1; i < splits.length; i += 2) {
    const side = splits[i] as "left" | "right";
    const block = splits[i + 1];
    if (!block) continue;

    // Cards carry no second and no score; only the minute + type are required.
    const minM = block.match(/(\d+)&prime;(?:\s*\n?\s*(\d+)&Prime;)?/);
    if (!minM) continue;

    const typeM = block.match(
      /<div>\s*(Ensayo|Conversión|Penalti|Penal|Drop|Tarjeta amarilla|Tarjeta roja)\s*<\/div>/,
    );
    const type = typeM ? EVENT_TYPE_MAP[typeM[1]] : null;
    if (!type) continue; // skip substitutions and other non-scoring rows

    const scoreM = block.match(/<strong>\s*(\d+)\s*-\s*(\d+)\s*<\/strong>/);
    if (scoreM) {
      lastHome = Number(scoreM[1]);
      lastAway = Number(scoreM[2]);
    }

    const altM = block.match(/alt="([^"]+)"/);
    const numM = block.match(/title="Dorsal">\s*(\d+)/);

    events.push({
      minute: Number(minM[1]),
      second: minM[2] ? Number(minM[2]) : 0,
      team: side === "left" ? "home" : "away",
      type,
      playerName: altM ? altM[1].trim() : null,
      playerNumber: numM ? Number(numM[1]) : null,
      homeScore: lastHome,
      awayScore: lastAway,
    });
  }
  return events;
}

// In-progress matches need fresh data on every poll; finished matches are
// immutable so we cache forever after the first read.
const eventsCache = new Map<string, ArusaEvent[]>();

export async function scrapeArusaEvents(
  matchId: string,
  options: { force?: boolean } = {},
): Promise<ArusaEvent[]> {
  if (!options.force) {
    const cached = eventsCache.get(matchId);
    if (cached) return cached;
  }

  const auth = await getCsrfAndCookies(matchId);
  if (!auth) return [];

  try {
    const res = await fetch(
      `${ARUSA_AJAX_ES}/match/${matchId}/results/change-tab`,
      {
        method: "POST",
        headers: {
          Cookie: auth.cookies,
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept-Language": "es",
          "User-Agent": USER_AGENT,
        },
        body: new URLSearchParams({
          tab: "minute_by_minute",
          csrf_token: auth.csrf,
        }).toString(),
        signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { content?: string };
    const html = json?.content ?? "";
    const events = parseEvents(html);
    eventsCache.set(matchId, events);
    return events;
  } catch {
    return [];
  }
}

export function clearEventsCache(matchId?: string) {
  if (matchId) eventsCache.delete(matchId);
  else eventsCache.clear();
}

// Per-match try counts (home/away), derived from the minute-by-minute timeline
// — the only place arusa exposes per-match tries. Oriented to arusa's
// home/away (i.e. MatchMeta.homeTeam/awayTeam). Finished matches are immutable,
// so a non-empty read is cached forever: in-memory for the process, and
// persisted to the DB so a restart doesn't re-scrape ~45 matches per division.
const triesCache = new Map<string, { home: number; away: number }>();
type TryCount = { home: number; away: number };

export async function scrapeMatchTries(
  matchId: string,
  options: { force?: boolean } = {},
): Promise<TryCount> {
  if (!options.force) {
    const cached = triesCache.get(matchId);
    if (cached) return cached;
    const persisted = await readCache<TryCount>(`tries:${matchId}`);
    if (persisted) {
      triesCache.set(matchId, persisted);
      return persisted;
    }
  }
  const events = await scrapeArusaEvents(matchId, options);
  if (events.length === 0) return { home: 0, away: 0 }; // don't cache a failed read
  let home = 0;
  let away = 0;
  for (const ev of events) {
    if (ev.type !== "TRY") continue;
    if (ev.team === "home") home++;
    else away++;
  }
  const tries: TryCount = { home, away };
  triesCache.set(matchId, tries);
  void writeCache(`tries:${matchId}`, tries); // survive restarts
  return tries;
}

export async function batchScrapeTries(
  matches: { matchId: string }[],
  concurrency = 5,
): Promise<Map<string, { home: number; away: number }>> {
  const out = new Map<string, { home: number; away: number }>();
  const queue = [...matches];
  async function worker() {
    while (queue.length) {
      const m = queue.shift();
      if (!m) return;
      out.set(m.matchId, await scrapeMatchTries(m.matchId));
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, matches.length) }, worker),
  );
  return out;
}

