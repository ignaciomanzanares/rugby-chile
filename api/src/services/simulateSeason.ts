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

const DIVISION: DivisionKey = "PRIMERA";
const PLAYOFF_SPOTS = 4;
const TOTAL_TEAMS = 10;

// Estimation knobs. TRY_VALUE ≈ points per try including the average conversion
// and the drag of penalties/drop goals, tuned so BP rates land around the 45%
// league norm. SCORE_SD is refined from this season's residuals at fit time.
const TRY_VALUE = 6.3;
let SCORE_SD = 11;
// Shrink each club's per-game attack/defence toward the league mean as if it
// had also played PRIOR_GAMES average matches — stops a hot/cold 10-game sample
// from being taken at face value.
const PRIOR_GAMES = 5;

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

export interface TeamProjection {
  team: string;
  currentPos: number;
  currentPts: number;
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

  const avg = (xs: number[], fallback: number) =>
    (xs.reduce((a, b) => a + b, 0) + PRIOR_GAMES * fallback) / (xs.length + PRIOR_GAMES);

  const ratings = new Map<string, TeamRating>();
  for (const t of teams) {
    ratings.set(t, {
      team: t,
      attack: avg(scored.get(t)!, leagueMean),
      defense: avg(conceded.get(t)!, leagueMean),
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

// Expected points for (home, away). Blends the attacker's scoring with the
// defender's conceding, then splits the home-field edge between the two sides.
function expectedScores(home: TeamRating, away: TeamRating, hfa: number): [number, number] {
  const eh = 0.5 * (home.attack + away.defense) + hfa / 2;
  const ea = 0.5 * (away.attack + home.defense) - hfa / 2;
  return [Math.max(0, eh), Math.max(0, ea)];
}

interface Points { home: number; away: number; hs: number; as: number; }

// One simulated match → league points for each side (with estimated try bonus
// and exact losing bonus), plus the sampled score for point-difference tallies.
function simMatch(home: TeamRating, away: TeamRating, hfa: number, rand: () => number): Points {
  const [eh, ea] = expectedScores(home, away, hfa);
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
function simKnockout(a: TeamRating, b: TeamRating, hfa: number, aIsHigherSeed: boolean, rand: () => number): string {
  // Higher seed hosts.
  const [home, away] = aIsHigherSeed ? [a, b] : [b, a];
  const [eh, ea] = expectedScores(home, away, hfa);
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

  const model = fitModel(completed, teams);

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
      const p = simMatch(home, away, model.hfa, rand);
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
      const w1 = simKnockout(r.get(s1)!, r.get(s4)!, model.hfa, true, rand); // 1º is higher seed
      const w2 = simKnockout(r.get(s2)!, r.get(s3)!, model.hfa, true, rand); // 2º is higher seed
      finalCount.set(w1, finalCount.get(w1)! + 1);
      finalCount.set(w2, finalCount.get(w2)! + 1);
      // Final: the better regular-season seed hosts.
      const seedRank = new Map(ranked.map((x, i) => [x.team, i]));
      const w1Higher = seedRank.get(w1)! < seedRank.get(w2)!;
      const champ = simKnockout(r.get(w1)!, r.get(w2)!, model.hfa, w1Higher, rand);
      champion.set(champ, champion.get(champ)! + 1);
    }
  }

  const pct = (n: number) => (n / sims) * 100;
  const teamProjections: TeamProjection[] = teams.map((t) => ({
    team: t,
    currentPos: currentPos.get(t) ?? 0,
    currentPts: seeds.get(t)!.pts,
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

  return {
    division: DIVISION,
    simulations: sims,
    playedRounds: completed.length ? Math.max(...primera.filter((m) => m.finished).map((m) => m.round)) : 0,
    remainingMatches: remaining.length,
    generatedAt: new Date().toISOString(),
    teams: teamProjections,
  };
}

// Short cache — the projection only moves when a result comes in, and the
// results feed itself is cached, but the sim is a few hundred ms so keep it hot.
let cache: { data: SeasonProjection; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function getSeasonProjection(sims = 20000): Promise<SeasonProjection> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  const data = await simulateSeason(sims);
  cache = { data, ts: Date.now() };
  return data;
}
