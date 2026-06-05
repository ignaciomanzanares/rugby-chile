/**
 * Head-to-head history across every Primera División season on arusa/leverade
 * (2021–2026). For a pair of teams it returns their past meetings (date, score,
 * home/away, season) and a summary record, per division grade.
 *
 * Heavy but fully cached per pair (arusa_cache) — past seasons are immutable, so
 * once captured the H2H is served from the DB and only the current season is
 * re-checked. Best-effort: a season that fails to load is simply skipped.
 */
import { readCache, writeCache } from "../lib/arusaCache";
import { fetchAllMatchesMeta } from "../lib/leverade";
import type { DivisionKey } from "./computeStandings";

const LEVERADE = "https://api.leverade.com";
const ARUSA = "https://arusa.cl/en/tournament";

// Top-flight tournament(s) per season (manager 532872). The name changed over
// the years — "TOP 8" in 2021-2022, "Primera Nacional/División" from 2023 — and
// 2022 ran two phases (Apertura + Central), so a season can have several. These
// were verified by team composition (each contains COBS + Old Boys); the old
// "Primera - Titulares" of 2021-2022 was actually the 2nd division.
const SEASONS: { year: number; tournaments: string[] }[] = [
  { year: 2026, tournaments: ["1328550"] },
  { year: 2025, tournaments: ["1284807"] },
  { year: 2024, tournaments: ["1237417"] },
  { year: 2023, tournaments: ["1203958"] },
  { year: 2022, tournaments: ["1152624", "1161428"] }, // TOP 8 Apertura + Central
  { year: 2021, tournaments: ["1103237"] },            // TOP 8
];

// Map any historical team name to one of our 10 canonical names.
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
function canonTeam(name: string | undefined): string | null {
  if (!name) return null;
  for (const [canon, re] of CLUB_MATCH) if (re.test(name)) return canon;
  return null;
}

// These tournaments are the top-tier "Primera División" per season. Group names
// vary by year ("Titulares", "Fase Regular", "Semifinales", …), so only
// Intermedia/Pre groups are split off — everything else is the Primera grade.
function groupDivision(name: string): DivisionKey {
  const s = name.toLowerCase();
  if (s.includes("pre")) return "PRE_INTERMEDIA";
  if (s.includes("intermedia")) return "INTERMEDIA";
  return "PRIMERA";
}

async function leverade(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${LEVERADE}${path}`, { headers: { Accept: "application/vnd.api+json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const POINTS_RE = /<span>Points<\/span>\s*<span>(\d+)<\/span>/g;
async function scrapeScore(tournamentId: string, matchId: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(`${ARUSA}/${tournamentId}/match/${matchId}/results`, { headers: { "Accept-Language": "en" } });
    if (!res.ok) return null;
    const html = await res.text();
    const nums: number[] = [];
    for (const m of html.matchAll(POINTS_RE)) nums.push(Number(m[1]));
    return nums.length >= 2 ? [nums[0], nums[1]] : null;
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
  meetings: H2HMeeting[]; // newest first
  aWins: number;
  bWins: number;
  draws: number;
  aHomeWins: number;
  aAwayWins: number;
}

async function meetingsForSeason(
  tournamentId: string, year: number, division: DivisionKey, teamA: string, teamB: string,
): Promise<H2HMeeting[]> {
  const [structure, teamsDoc] = await Promise.all([
    leverade(`/tournaments/${tournamentId}?include=groups.rounds.matches`),
    leverade(`/tournaments/${tournamentId}?include=teams`),
  ]);
  if (!structure || !teamsDoc) return [];

  const inc: any[] = structure.included ?? [];
  const teamName: Record<string, string> = {};
  for (const t of (teamsDoc.included ?? [])) if (t.type === "team") teamName[t.id] = t.attributes?.name;

  const groupDiv: Record<string, DivisionKey | null> = {};
  for (const g of inc) if (g.type === "group") groupDiv[g.id] = groupDivision(g.attributes?.name ?? "");
  const roundGroup: Record<string, string> = {};
  for (const r of inc) if (r.type === "round") roundGroup[r.id] = String(r.relationships?.group?.data?.id ?? "");

  const out: H2HMeeting[] = [];
  for (const m of inc) {
    if (m.type !== "match" || !m.attributes?.finished) continue;
    const div = groupDiv[roundGroup[String(m.relationships?.round?.data?.id ?? "")]];
    if (div !== division) continue;
    const hId = String(m.meta?.home_team ?? "");
    const aId = String(m.meta?.away_team ?? "");
    const home = canonTeam(teamName[hId]);
    const away = canonTeam(teamName[aId]);
    if (!home || !away) continue;
    if (!((home === teamA && away === teamB) || (home === teamB && away === teamA))) continue;

    const score = await scrapeScore(tournamentId, String(m.id));
    if (!score) continue;
    out.push({
      year, date: m.attributes?.datetime ?? null,
      homeTeam: home, awayTeam: away, homeScore: score[0], awayScore: score[1],
    });
  }
  return out;
}

export async function computeH2H(division: DivisionKey, teamA: string, teamB: string): Promise<H2H> {
  const pairKey = [teamA, teamB].sort().join("__");
  const cacheKey = `h2h:v2:${division}:${pairKey}`;

  const cached = await readCache<H2H>(cacheKey);
  // Past seasons never change; refresh only if we've never captured this pair.
  if (cached && cached.meetings.length > 0) return cached;

  const all: H2HMeeting[] = [];
  for (const s of SEASONS) {
    for (const tid of s.tournaments) {
      const ms = await meetingsForSeason(tid, s.year, division, teamA, teamB);
      all.push(...ms);
    }
  }
  all.sort((x, y) => (new Date(y.date ?? `${y.year}`).getTime()) - (new Date(x.date ?? `${x.year}`).getTime()));

  let aWins = 0, bWins = 0, draws = 0, aHomeWins = 0, aAwayWins = 0;
  for (const m of all) {
    const aIsHome = m.homeTeam === teamA;
    const aScore = aIsHome ? m.homeScore : m.awayScore;
    const bScore = aIsHome ? m.awayScore : m.homeScore;
    if (aScore > bScore) { aWins++; if (aIsHome) aHomeWins++; else aAwayWins++; }
    else if (bScore > aScore) bWins++;
    else draws++;
  }

  const result: H2H = { teamA, teamB, meetings: all, aWins, bWins, draws, aHomeWins, aAwayWins };
  if (all.length > 0) void writeCache(cacheKey, result);
  return result;
}

// Warm the H2H cache for the next round's Primera fixtures so opening them is
// instant. computeH2H short-circuits on the cache, so this is cheap once warm.
export async function prewarmH2H(): Promise<void> {
  try {
    const meta = await fetchAllMatchesMeta();
    const primera = meta.filter((m) => m.division === "PRIMERA");
    const upcomingRounds = primera.filter((m) => !m.finished).map((m) => m.round);
    if (upcomingRounds.length === 0) return;
    const nextRound = Math.min(...upcomingRounds);
    const fixtures = primera.filter((m) => m.round === nextRound);
    for (const f of fixtures) {
      await computeH2H("PRIMERA", f.homeTeam, f.awayTeam).catch(() => {});
    }
  } catch {
    // best effort
  }
}
