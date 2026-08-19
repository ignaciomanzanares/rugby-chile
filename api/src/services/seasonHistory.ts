/**
 * Multi-season history for the season projection.
 *
 * Aggregates every top-flight head-to-head on arusa/leverade (2021–2026, via
 * computeH2H over all 45 club pairs) into two signals the simulator leans on:
 *
 *  · a per-club historical attack/defence baseline (past seasons only), so a
 *    club's rating is anchored by "how good it usually is", not just a 10-game
 *    sample — recent seasons weighted more (exponential decay per year); and
 *  · a per-pair head-to-head margin, so a matchup where one club has
 *    historically had the other's number is nudged accordingly.
 *
 * Building touches a lot of cached endpoints, so it runs in the background and
 * is persisted; callers get whatever is ready and the projection recomputes
 * once a fresh build lands (see the version counter).
 */
import { computeH2H } from "./computeH2H";
import { fetchAllResults } from "../routes/leveradeResults";
import { readCache, writeCache } from "../lib/arusaCache";

const CURRENT_SEASON = 2026;
export const DECAY = 0.4;             // weight of a season = DECAY ** (2026 - year); recent meetings dominate. Sincronizado con modelCore.DEFAULTS.decay (recalibración)
export const H2H_MARGIN_CAP = 21;    // cap each meeting's margin (±3 converted tries): H2H should say who wins, not by how much an old blowout went
const CACHE_KEY = "season-history:v3";
const FRESH_MS = 24 * 60 * 60 * 1000; // past results are immutable; refresh daily for the current season

export interface TeamHist { attack: number; defense: number; games: number; }
export interface PairH2H { teamA: string; teamB: string; games: number; marginAoverB: number; }

export interface SeasonHistory {
  builtAt: string;
  meetings: number;
  histLeagueMean: number;             // avg team-score across past seasons (era baseline)
  teams: Record<string, TeamHist>;    // raw historical avg points (past seasons only)
  h2h: Record<string, PairH2H>;       // keyed by sorted "A__B"
}

const pairKey = (a: string, b: string) => [a, b].sort().join("__");

let cache: SeasonHistory | null = null;
let building: Promise<void> | null = null;
let version = 0; // bumps whenever a fresh build lands, so the projection cache can invalidate

export function historyVersion(): number { return version; }

async function build(teams: string[]): Promise<SeasonHistory> {
  const tScored = new Map<string, number>();
  const tConc = new Map<string, number>();
  const tW = new Map<string, number>();
  const tG = new Map<string, number>();
  const h2h: Record<string, PairH2H> = {};
  let meetings = 0, leagueW = 0, leagueScoreW = 0;

  // computeH2H's per-match cache is built for immutable past seasons and can lag
  // the current one (a just-played meeting isn't in it yet). So take only past
  // seasons from it and fold this season's finished meetings in from the live
  // results feed — with full recency weight, and so a 3-0 in the current rivalry
  // actually shows up in the H2H.
  type Meeting = { year: number; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number };
  const currentByPair = new Map<string, Meeting[]>();
  try {
    const results = await fetchAllResults();
    for (const m of Object.values(results)) {
      if (m.division !== "PRIMERA" || !m.finished || m.homeScore == null || m.awayScore == null) continue;
      const k = pairKey(m.homeTeam, m.awayTeam);
      const list = currentByPair.get(k) ?? currentByPair.set(k, []).get(k)!;
      list.push({ year: CURRENT_SEASON, homeTeam: m.homeTeam, awayTeam: m.awayTeam, homeScore: m.homeScore, awayScore: m.awayScore });
    }
  } catch { /* no live feed — history-only H2H */ }

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const A = teams[i], B = teams[j];
      let past: Meeting[] = [];
      try {
        const h = await computeH2H("PRIMERA", A, B);
        past = h.meetings.filter((m) => m.year < CURRENT_SEASON);
      } catch { /* keep going with whatever the live feed has for this pair */ }
      const pairMeetings: Meeting[] = [...past, ...(currentByPair.get(pairKey(A, B)) ?? [])];

      const [sA, sB] = [A, B].sort(); // orient pair margin as sA over sB
      let mW = 0, mMarginW = 0;
      for (const m of pairMeetings) {
        const w = DECAY ** Math.max(0, CURRENT_SEASON - m.year);
        const aScore = m.homeTeam === sA ? m.homeScore : m.awayScore;
        const bScore = m.homeTeam === sA ? m.awayScore : m.homeScore;
        const margin = Math.max(-H2H_MARGIN_CAP, Math.min(H2H_MARGIN_CAP, aScore - bScore));
        mW += w; mMarginW += w * margin;
        meetings++;

        // Team baseline: past seasons only, so we don't double-count 2026 (it's
        // already the simulation's live data).
        if (m.year < CURRENT_SEASON) {
          const { homeTeam: home, awayTeam: away, homeScore: hs, awayScore: as } = m;
          const add = (map: Map<string, number>, k: string, v: number) => map.set(k, (map.get(k) ?? 0) + v);
          add(tScored, home, w * hs); add(tConc, home, w * as); add(tW, home, w); add(tG, home, 1);
          add(tScored, away, w * as); add(tConc, away, w * hs); add(tW, away, w); add(tG, away, 1);
          leagueW += 2 * w; leagueScoreW += w * (hs + as);
        }
      }
      if (mW > 0) h2h[pairKey(A, B)] = { teamA: sA, teamB: sB, games: pairMeetings.length, marginAoverB: mMarginW / mW };
    }
  }

  const teamsOut: Record<string, TeamHist> = {};
  for (const t of teams) {
    const w = tW.get(t) ?? 0;
    if (w > 0) teamsOut[t] = { attack: tScored.get(t)! / w, defense: tConc.get(t)! / w, games: tG.get(t) ?? 0 };
  }

  return {
    builtAt: new Date().toISOString(),
    meetings,
    histLeagueMean: leagueW > 0 ? leagueScoreW / leagueW : 0,
    teams: teamsOut,
    h2h,
  };
}

async function ensureBuilt(teams: string[]): Promise<void> {
  const t0 = Date.now();
  const built = await build(teams);
  if (built.meetings > 0) {
    cache = built;
    version++;
    await writeCache(CACHE_KEY, built);
    console.log(`[seasonHistory] built from ${built.meetings} meetings across ${Object.keys(built.teams).length} clubs in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } else {
    console.warn("[seasonHistory] build produced no meetings (arusa/leverade unreachable?)");
  }
  building = null;
}

/**
 * Best-effort history. Returns whatever is warm right now (or null on a cold
 * start) and kicks off a background (re)build when stale — never blocks the
 * projection on a full multi-season scrape.
 */
export async function getSeasonHistory(teams: string[]): Promise<SeasonHistory | null> {
  if (!cache) {
    const persisted = await readCache<SeasonHistory>(CACHE_KEY);
    if (persisted) { cache = persisted; version++; }
  }
  const stale = !cache || Date.now() - new Date(cache.builtAt).getTime() > FRESH_MS;
  if (stale && !building) building = ensureBuilt(teams).catch((err) => { console.error("[seasonHistory] build failed:", err); building = null; });
  return cache;
}

// Warm the cache at boot so the first projection already carries the history.
export function prewarmSeasonHistory(teams: string[]): void {
  void getSeasonHistory(teams);
}
