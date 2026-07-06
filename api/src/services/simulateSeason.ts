/**
 * Season projection — Monte Carlo simulation of "how the tournament ends".
 *
 * The Top 10 regular phase is 18 rounds (todos contra todos, ida y vuelta).
 * From wherever the season currently is, we simulate every remaining fixture
 * many thousands of times to estimate each club's chances of: winning the title
 * (through the playoffs), reaching the final, finishing top-4 (clasifican a
 * playoffs), landing 9th (repechaje) or 10th (descenso directo).
 *
 * Ratings come from an attack/defence model fitted to this season's finished
 * PRIMERA scores; the current table (with real bonus points) is the starting
 * point, so only the future is simulated. Try counts aren't in the results
 * feed, so try-bonus points on simulated matches are estimated from the scored
 * points (tries ~ Poisson(points / TRY_VALUE)). Everything else — win/draw/loss
 * points and the losing bonus (margin ≤ 7) — is exact per the reglamento.
 */
import { fetchAllResults, getReconciledStandings } from "../routes/leveradeResults";
import type { DivisionKey, StandingRow } from "../lib/leverade";
import { getSeasonHistory, historyVersion, type SeasonHistory } from "./seasonHistory";

const DIVISION: DivisionKey = "PRIMERA";
const PLAYOFF_SPOTS = 4;
const TOTAL_TEAMS = 10;

// Estimation knobs. TRY_VALUE ≈ points per try including the average conversion
// and the drag of penalties/drop goals, tuned so BP rates land around the 45%
// league norm. SCORE_SD is refined from this season's residuals at fit time.
const TRY_VALUE = 6.3;
let SCORE_SD = 11;
// Shrink each club's per-game attack/defence toward its historical baseline (or
// the league mean if we have no history) as if it had also played PRIOR_GAMES
// such matches — stops a hot/cold 10-game sample from being taken at face value
// and folds in past seasons.
const PRIOR_GAMES = 5;
// Head-to-head nudge: fraction of a matchup's historical over/under-performance
// (vs. what raw ratings predict) folded into that fixture's expected margin,
// scaled by how many past meetings we have.
const H2H_WEIGHT = 0.35;
const H2H_FULL_CONFIDENCE = 6; // meetings at which H2H gets its full weight

interface TeamRating {
  team: string;
  attack: number;  // shrunk avg points scored
  defense: number; // shrunk avg points conceded
}

interface Fixture {
  round: number;
  home: string;
  away: string;
}

export interface MatchPrediction {
  round: number;
  home: string;
  away: string;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  expHome: number; // expected points (model mean)
  expAway: number;
}

export interface TeamProjection {
  team: string;
  currentPos: number;
  currentPts: number;
  currentDiff: number;
  currentPf: number;
  playoffPct: number;    // finish top 4
  championPct: number;   // win the final
  finalPct: number;      // reach the final
  homeSemiPct: number;   // finish top 2 (host a semifinal)
  repechajePct: number;  // finish 9th
  relegationPct: number; // finish 10th
  avgPts: number;
  avgPos: number;
  posDist: number[];     // length 10, probability of finishing in each position
  projectedPos: number;  // rank by avg points (the headline projected table)
}

export interface SeasonProjection {
  division: DivisionKey;
  simulations: number;
  playedRounds: number;
  remainingMatches: number;
  generatedAt: string;
  teams: TeamProjection[];
  matches: MatchPrediction[]; // per-match model prediction for every remaining fixture
}

// ── RNG (seedable, so a given request is reproducible) ───────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  // Box–Muller
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function poisson(lambda: number, rand: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

// ── Model fit ────────────────────────────────────────────────────────────────
interface Model {
  ratings: Map<string, TeamRating>;
  leagueMean: number;
  hfa: number; // home-field advantage, in points
}

function fitModel(
  completed: { home: string; away: string; hs: number; as: number }[],
  teams: string[],
  history: SeasonHistory | null,
): Model {
  const scored = new Map<string, number[]>();
  const conceded = new Map<string, number[]>();
  for (const t of teams) { scored.set(t, []); conceded.set(t, []); }

  let homeSum = 0, awaySum = 0;
  for (const m of completed) {
    scored.get(m.home)!.push(m.hs);
    conceded.get(m.home)!.push(m.as);
    scored.get(m.away)!.push(m.as);
    conceded.get(m.away)!.push(m.hs);
    homeSum += m.hs; awaySum += m.as;
  }

  const allScores = completed.flatMap((m) => [m.hs, m.as]);
  const leagueMean = allScores.reduce((a, b) => a + b, 0) / Math.max(1, allScores.length);
  const hfa = completed.length ? (homeSum - awaySum) / completed.length : 0;

  // Prior for a club: its historical attack/defence, rescaled from the past
  // era's scoring level to this season's, so past seasons anchor the rating
  // without importing old scoring inflation. No history → the league mean.
  const scale = history && history.histLeagueMean > 0 ? leagueMean / history.histLeagueMean : 0;
  const prior = (t: string, side: "attack" | "defense") => {
    const h = history?.teams[t];
    return h && scale > 0 ? h[side] * scale : leagueMean;
  };
  const shrink = (xs: number[], priorVal: number) =>
    (xs.reduce((a, b) => a + b, 0) + PRIOR_GAMES * priorVal) / (xs.length + PRIOR_GAMES);

  const ratings = new Map<string, TeamRating>();
  for (const t of teams) {
    ratings.set(t, {
      team: t,
      attack: shrink(scored.get(t)!, prior(t, "attack")),
      defense: shrink(conceded.get(t)!, prior(t, "defense")),
    });
  }

  // Refine the score SD from residuals of the fitted expectations.
  let ss = 0, n = 0;
  for (const m of completed) {
    const [eh, ea] = expectedScores(ratings.get(m.home)!, ratings.get(m.away)!, hfa);
    ss += (m.hs - eh) ** 2 + (m.as - ea) ** 2; n += 2;
  }
  if (n > 0) SCORE_SD = Math.max(7, Math.min(16, Math.sqrt(ss / n)));

  return { ratings, leagueMean, hfa };
}

// Per-fixture head-to-head margin adjustment (home minus away), in points. It's
// the slice of a matchup's historical margin that the raw ratings don't already
// explain, damped by H2H_WEIGHT and the number of past meetings. Precomputed for
// every ordered pair so regular and playoff matches look it up for free.
function buildH2HAdjustments(ratings: Map<string, TeamRating>, teams: string[], history: SeasonHistory | null): Map<string, number> {
  const adj = new Map<string, number>();
  if (!history) return adj;
  for (const home of teams) {
    for (const away of teams) {
      if (home === away) continue;
      const pair = history.h2h[[home, away].sort().join("__")];
      if (!pair || pair.games < 3) continue;
      const H = ratings.get(home)!, A = ratings.get(away)!;
      // Rating-implied neutral margin (home minus away, without home advantage).
      const ratingMargin = 0.5 * (H.attack - A.attack + A.defense - H.defense);
      // Historical margin oriented home minus away.
      const h2hMargin = pair.teamA === home ? pair.marginAoverB : -pair.marginAoverB;
      const conf = Math.min(pair.games, H2H_FULL_CONFIDENCE) / H2H_FULL_CONFIDENCE;
      adj.set(`${home}|${away}`, H2H_WEIGHT * conf * (h2hMargin - ratingMargin));
    }
  }
  return adj;
}

// Expected points for (home, away). Blends the attacker's scoring with the
// defender's conceding, splits the home-field edge, then applies the optional
// head-to-head margin nudge (half to each side).
function expectedScores(home: TeamRating, away: TeamRating, hfa: number, h2hAdj = 0): [number, number] {
  const eh = 0.5 * (home.attack + away.defense) + hfa / 2 + h2hAdj / 2;
  const ea = 0.5 * (away.attack + home.defense) - hfa / 2 - h2hAdj / 2;
  return [Math.max(0, eh), Math.max(0, ea)];
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26).
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

// Analytic 1/X/2 for a match: the margin D = homeScore − awayScore is Normal
// with mean (eh−ea) and sd = SCORE_SD·√2. A "draw" is D rounding to 0
// (continuity-corrected to ±0.5). Cheaper and smoother than sampling.
function predictMatch(home: TeamRating, away: TeamRating, hfa: number, h2hAdj = 0): {
  homeWinPct: number; drawPct: number; awayWinPct: number; expHome: number; expAway: number;
} {
  const [eh, ea] = expectedScores(home, away, hfa, h2hAdj);
  const mu = eh - ea;
  const sd = SCORE_SD * Math.SQRT2;
  const drawPct = normCdf((0.5 - mu) / sd) - normCdf((-0.5 - mu) / sd);
  const awayWinPct = normCdf((-0.5 - mu) / sd);
  const homeWinPct = 1 - drawPct - awayWinPct;
  return {
    homeWinPct: homeWinPct * 100,
    drawPct: drawPct * 100,
    awayWinPct: awayWinPct * 100,
    expHome: Math.round(eh * 10) / 10,
    expAway: Math.round(ea * 10) / 10,
  };
}

interface Points { home: number; away: number; hs: number; as: number; }

// One simulated match → league points for each side (with estimated try bonus
// and exact losing bonus), plus the sampled score for point-difference tallies.
function simMatch(home: TeamRating, away: TeamRating, hfa: number, rand: () => number, h2hAdj = 0): Points {
  const [eh, ea] = expectedScores(home, away, hfa, h2hAdj);
  const hs = Math.max(0, Math.round(eh + SCORE_SD * gaussian(rand)));
  const as = Math.max(0, Math.round(ea + SCORE_SD * gaussian(rand)));

  const draw = hs === as;
  const homeWin = hs > as;
  let hp = draw ? 2 : homeWin ? 4 : 0;
  let ap = draw ? 2 : homeWin ? 0 : 4;

  // Try bonus (4+ tries) — estimated from points scored.
  if (poisson(hs / TRY_VALUE, rand) >= 4) hp += 1;
  if (poisson(as / TRY_VALUE, rand) >= 4) ap += 1;
  // Losing bonus (margin ≤ 7).
  if (!draw && !homeWin && as - hs <= 7) hp += 1;
  if (!draw && homeWin && hs - as <= 7) ap += 1;

  return { home: hp, away: ap, hs, as };
}

// Single-leg playoff: higher score wins; a tie goes to the better seed (as a
// stand-in for extra time / regulation advantage). Returns the winning team.
function simKnockout(a: TeamRating, b: TeamRating, hfa: number, aIsHigherSeed: boolean, rand: () => number, h2hAdj = 0): string {
  // Higher seed hosts.
  const [home, away] = aIsHigherSeed ? [a, b] : [b, a];
  const [eh, ea] = expectedScores(home, away, hfa, h2hAdj);
  const hs = Math.max(0, Math.round(eh + SCORE_SD * gaussian(rand)));
  const as = Math.max(0, Math.round(ea + SCORE_SD * gaussian(rand)));
  if (hs === as) return aIsHigherSeed ? a.team : b.team; // seed advantage breaks ties
  return hs > as ? home.team : away.team;
}

interface SeedRow { team: string; pts: number; diff: number; pf: number; }

function rankTable(rows: SeedRow[]): SeedRow[] {
  return [...rows].sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.pf - a.pf);
}

export async function simulateSeason(sims = 20000, seed = 12345): Promise<SeasonProjection> {
  const all = await fetchAllResults();
  const primera = Object.values(all).filter((m) => m.division === DIVISION);

  const completed = primera
    .filter((m) => m.finished && m.homeScore != null && m.awayScore != null)
    .map((m) => ({ home: m.homeTeam, away: m.awayTeam, hs: m.homeScore!, as: m.awayScore! }));

  const remaining: Fixture[] = primera
    .filter((m) => !m.finished || m.homeScore == null || m.awayScore == null)
    .map((m) => ({ round: m.round, home: m.homeTeam, away: m.awayTeam }));

  // Starting table: the real, lag-corrected standings (correct bonus points).
  // Fall back to a from-scratch tally of finished scores if arusa is down.
  let startTable = await getReconciledStandings(DIVISION);
  const teams = Array.from(
    new Set([
      ...completed.flatMap((m) => [m.home, m.away]),
      ...remaining.flatMap((m) => [m.home, m.away]),
      ...(startTable?.map((r) => r.team) ?? []),
    ]),
  );

  const history = await getSeasonHistory(teams);
  const model = fitModel(completed, teams, history);
  const h2hAdj = buildH2HAdjustments(model.ratings, teams, history);
  const adjOf = (home: string, away: string) => h2hAdj.get(`${home}|${away}`) ?? 0;

  const seeds: Map<string, SeedRow> = new Map();
  if (startTable && startTable.length) {
    for (const r of startTable) seeds.set(r.team, { team: r.team, pts: r.pts, diff: r.diff, pf: r.pf });
  }
  for (const t of teams) {
    if (!seeds.has(t)) seeds.set(t, { team: t, pts: 0, diff: 0, pf: 0 });
  }

  const currentRanked = rankTable([...seeds.values()]);
  const currentPos = new Map(currentRanked.map((r, i) => [r.team, i + 1]));

  // Accumulators
  const posCount = new Map<string, number[]>();     // per team, count of finishes in each position
  const ptsSum = new Map<string, number>();
  const posSum = new Map<string, number>();
  const playoff = new Map<string, number>();
  const homeSemi = new Map<string, number>();
  const finalCount = new Map<string, number>();
  const champion = new Map<string, number>();
  const repechaje = new Map<string, number>();
  const relegation = new Map<string, number>();
  for (const t of teams) {
    posCount.set(t, new Array(TOTAL_TEAMS).fill(0));
    ptsSum.set(t, 0); posSum.set(t, 0);
    playoff.set(t, 0); homeSemi.set(t, 0); finalCount.set(t, 0);
    champion.set(t, 0); repechaje.set(t, 0); relegation.set(t, 0);
  }

  const rand = mulberry32(seed);
  const r = model.ratings;

  for (let s = 0; s < sims; s++) {
    const table = new Map<string, SeedRow>();
    for (const [t, row] of seeds) table.set(t, { ...row });

    for (const fx of remaining) {
      const home = r.get(fx.home); const away = r.get(fx.away);
      if (!home || !away) continue;
      const p = simMatch(home, away, model.hfa, rand, adjOf(fx.home, fx.away));
      const h = table.get(fx.home)!; const a = table.get(fx.away)!;
      h.pts += p.home; a.pts += p.away;
      h.diff += p.hs - p.as; a.diff += p.as - p.hs;
      h.pf += p.hs; a.pf += p.as;
    }

    const ranked = rankTable([...table.values()]);
    for (let i = 0; i < ranked.length; i++) {
      const t = ranked[i].team;
      posCount.get(t)![i] += 1;
      ptsSum.set(t, ptsSum.get(t)! + ranked[i].pts);
      posSum.set(t, posSum.get(t)! + (i + 1));
      if (i < PLAYOFF_SPOTS) playoff.set(t, playoff.get(t)! + 1);
      if (i < 2) homeSemi.set(t, homeSemi.get(t)! + 1);
      if (i === TOTAL_TEAMS - 2) repechaje.set(t, repechaje.get(t)! + 1);
      if (i === TOTAL_TEAMS - 1) relegation.set(t, relegation.get(t)! + 1);
    }

    // Playoffs: SF1 = 1º vs 4º, SF2 = 2º vs 3º; final = winners. Higher seed hosts.
    if (ranked.length >= PLAYOFF_SPOTS) {
      const s1 = ranked[0].team, s4 = ranked[3].team;
      const s2 = ranked[1].team, s3 = ranked[2].team;
      const w1 = simKnockout(r.get(s1)!, r.get(s4)!, model.hfa, true, rand, adjOf(s1, s4)); // 1º is higher seed
      const w2 = simKnockout(r.get(s2)!, r.get(s3)!, model.hfa, true, rand, adjOf(s2, s3)); // 2º is higher seed
      finalCount.set(w1, finalCount.get(w1)! + 1);
      finalCount.set(w2, finalCount.get(w2)! + 1);
      // Final: the better regular-season seed hosts.
      const seedRank = new Map(ranked.map((x, i) => [x.team, i]));
      const w1Higher = seedRank.get(w1)! < seedRank.get(w2)!;
      const [fHome, fAway] = w1Higher ? [w1, w2] : [w2, w1];
      const champ = simKnockout(r.get(w1)!, r.get(w2)!, model.hfa, w1Higher, rand, adjOf(fHome, fAway));
      champion.set(champ, champion.get(champ)! + 1);
    }
  }

  const pct = (n: number) => (n / sims) * 100;
  const teamProjections: TeamProjection[] = teams.map((t) => ({
    team: t,
    currentPos: currentPos.get(t) ?? 0,
    currentPts: seeds.get(t)!.pts,
    currentDiff: seeds.get(t)!.diff,
    currentPf: seeds.get(t)!.pf,
    playoffPct: pct(playoff.get(t)!),
    championPct: pct(champion.get(t)!),
    finalPct: pct(finalCount.get(t)!),
    homeSemiPct: pct(homeSemi.get(t)!),
    repechajePct: pct(repechaje.get(t)!),
    relegationPct: pct(relegation.get(t)!),
    avgPts: ptsSum.get(t)! / sims,
    avgPos: posSum.get(t)! / sims,
    posDist: posCount.get(t)!.map((c) => pct(c)),
    projectedPos: 0,
  }));

  // Headline projected table: order by expected final points (then current pts).
  teamProjections.sort((a, b) => b.avgPts - a.avgPts || b.currentPts - a.currentPts);
  teamProjections.forEach((tp, i) => { tp.projectedPos = i + 1; });

  // Per-match model prediction for every remaining fixture (kept in fixture
  // order), so the client can show odds and seed a manual "what-if" table.
  const matches: MatchPrediction[] = remaining
    .filter((fx) => r.has(fx.home) && r.has(fx.away))
    .sort((a, b) => a.round - b.round)
    .map((fx) => ({ round: fx.round, home: fx.home, away: fx.away, ...predictMatch(r.get(fx.home)!, r.get(fx.away)!, model.hfa, adjOf(fx.home, fx.away)) }));

  return {
    division: DIVISION,
    simulations: sims,
    playedRounds: completed.length ? Math.max(...primera.filter((m) => m.finished).map((m) => m.round)) : 0,
    remainingMatches: remaining.length,
    generatedAt: new Date().toISOString(),
    teams: teamProjections,
    matches,
  };
}

// Short cache — the projection only moves when a result comes in, and the
// results feed itself is cached. Also invalidated when a fresh multi-season
// history build lands (tracked by version), so the odds pick it up right away.
let cache: { data: SeasonProjection; ts: number; sims: number; histV: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function getSeasonProjection(sims = 50000): Promise<SeasonProjection> {
  if (cache && cache.sims === sims && cache.histV === historyVersion() && Date.now() - cache.ts < CACHE_TTL) {
    return cache.data;
  }
  const data = await simulateSeason(sims);
  cache = { data, ts: Date.now(), sims, histV: historyVersion() };
  return data;
}
