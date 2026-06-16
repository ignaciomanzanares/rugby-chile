/**
 * Shared helpers for fetching tournament data.
 *
 * Match metadata (rounds, teams, datetime, finished flag) still comes from
 * Leverade's public tournament endpoint — no auth required. Scores, however,
 * are now auth-gated on the JSON API. arusa.cl renders them into server-side
 * HTML, so we scrape the public match-results page to recover them.
 */

import { readCache, writeCache } from "./arusaCache";

const TOURNAMENT_ID = "1328550";
const LEVERADE_BASE = "https://api.leverade.com";
const ARUSA_BASE = `https://arusa.cl/en/tournament/${TOURNAMENT_ID}`;
// Spanish locale for play-by-play scrape — the event labels (Ensayo,
// Conversión, Penalti, Tarjeta amarilla, …) are in Spanish there.
const ARUSA_BASE_ES = `https://arusa.cl/es/tournament/${TOURNAMENT_ID}`;
const ARUSA_AJAX_ES = `https://arusa.cl/es/ajax/tournament/${TOURNAMENT_ID}`;
const ARUSA_AJAX_EN = "https://arusa.cl/en/ajax";

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
  datetime: string | null;
}

async function leveradeGet(path: string): Promise<any> {
  const res = await fetch(`${LEVERADE_BASE}${path}`, {
    headers: { Accept: "application/vnd.api+json" },
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
    `/tournaments/${TOURNAMENT_ID}?include=groups.rounds.matches`,
  );
  const inc: any[] = data.included ?? [];

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

    matches.push({
      matchId: String(m.id),
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      division,
      round: roundToNumber[roundId] ?? 0,
      finished: Boolean(m.attributes?.finished),
      datetime: m.attributes?.datetime ?? null,
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

export async function scrapeArusaScore(
  matchId: string,
  options: { force?: boolean } = {},
): Promise<MatchPageInfo> {
  if (!options.force) {
    const cached = scoreCache.get(matchId);
    if (cached) return cached;
  }

  try {
    const res = await fetch(`${ARUSA_BASE}/match/${matchId}/results`, {
      headers: { "Accept-Language": "en" },
    });
    if (!res.ok) return {};
    const html = await res.text();
    const referees = parseReferees(html);
    const nums: number[] = [];
    for (const m of html.matchAll(POINTS_RE)) nums.push(Number(m[1]));

    const result: MatchPageInfo = {};
    if (referees.length) result.referees = referees;
    if (nums.length >= 2) {
      result.homeScore = nums[0];
      result.awayScore = nums[1];
      scoreCache.set(matchId, result); // finished scores are immutable — cache forever
    }
    return result;
  } catch {
    return {};
  }
}

export async function batchScrapeScores(
  matches: MatchMeta[],
  concurrency = 8,
): Promise<Map<string, { homeScore?: number; awayScore?: number }>> {
  const out = new Map<string, { homeScore?: number; awayScore?: number }>();
  const queue = [...matches];
  async function worker() {
    while (queue.length) {
      const m = queue.shift();
      if (!m) return;
      const score = await scrapeArusaScore(m.matchId);
      out.set(m.matchId, score);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, matches.length) }, worker),
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
      headers: { "Accept-Language": "en" },
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
    rows.push({
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
    });
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
    headers: { "Accept-Language": "en", "X-Requested-With": "XMLHttpRequest" },
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
// arusa.cl gates the minute-by-minute tab behind a session cookie + CSRF
// token. We do the two-step dance: GET the match page to obtain both, then
// POST /change-tab with tab=minute_by_minute. The returned JSON `content`
// field holds the full events HTML, which we parse into structured rows.

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
  try {
    const res = await fetch(`${ARUSA_BASE_ES}/match/${matchId}/results`, {
      headers: { "Accept-Language": "es" },
    });
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
        },
        body: new URLSearchParams({
          tab: "minute_by_minute",
          csrf_token: auth.csrf,
        }).toString(),
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
// so a non-empty read is cached forever.
const triesCache = new Map<string, { home: number; away: number }>();

export async function scrapeMatchTries(
  matchId: string,
  options: { force?: boolean } = {},
): Promise<{ home: number; away: number }> {
  if (!options.force) {
    const cached = triesCache.get(matchId);
    if (cached) return cached;
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
  const tries = { home, away };
  triesCache.set(matchId, tries);
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

