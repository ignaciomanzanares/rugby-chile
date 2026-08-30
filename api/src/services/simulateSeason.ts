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
import { getSeasonHistory, historyVersion, DECAY, H2H_MARGIN_CAP, type SeasonHistory } from "./seasonHistory";

const DIVISION: DivisionKey = "PRIMERA";
const PLAYOFF_SPOTS = 4;
const TOTAL_TEAMS = 10;

// Estimation knobs. TRY_VALUE ≈ points per try including the average conversion
// and the drag of penalties/drop goals, tuned so BP rates land around the 45%
// league norm.
const TRY_VALUE = 6.3;
// Per-side score SD; the margin SD is SCORE_SD·√2 ≈ 18. Calibrated by the
// walk-forward backtest on out-of-sample log-loss (scripts/backtest.ts), NOT
// from this season's in-sample residuals — a 10-game residual badly understates
// the real predictive spread (rugby margins swing ~±18) and made the model
// overconfident (favouritos con 88% que no se sostienen). Sincronizado con
// modelCore.DEFAULTS.sdMargin=18 (recalibración): 18/√2 ≈ 12.73.
const SCORE_SD = 12.73;
// Ventaja de localía en puntos. Calibrada por el backtest (no empírica de la
// temporada, que sobreajusta). Sincronizado con modelCore.DEFAULTS.hfa.
const HFA = 3;
let LEAGUE_MEAN = 28; // avg team-score this season; set at fit time, used by the additive model
const FIT_ITERS = 30; // opponent-adjustment passes (converges well before this)
// This season is the primary driver: a club's rating is its real per-game
// attack/defence, only lightly pulled toward its historical baseline (past
// seasons) as if it had played PRIOR_GAMES such matches on top of the ones
// already played. With ~10 games played that leaves this season worth ~3/4 of
// the rating, and the more of the season that's in the books the less history
// weighs. The pull is further scaled by how much history a club actually has,
// so a thin record (e.g. a recently promoted side) doesn't over-anchor it.
const PRIOR_GAMES = 9; // sincronizado con modelCore.DEFAULTS.priorGames (recalibración)
const PRIOR_FULL_HISTORY = 20; // historical games at which the prior gets its full (PRIOR_GAMES) weight
// Margin-based ratings undervalue a side that keeps winning tight games (and
// overvalue one that loses big but wins occasionally by a lot). RESULT_BLEND
// nudges each club toward its actual league-points-per-game — but only the part
// its scoring margin doesn't already explain, so we don't double-count.
const RESULT_BLEND = 0; // sincronizado con modelCore.DEFAULTS.resultBlend (recalibración: el backtest lo llevó a 0)
// Head-to-head nudge. The backtest (scripts/backtest.ts) shows any non-zero
// weight slightly WORSENS out-of-sample log-loss (~0.5% at 0.15) — a club's edge
// is mostly already in its ratings. Kept deliberately small, as a nod to real
// rivalries that carry signal the aggregate ratings miss, at a cost the backtest
// says is minor. Confidence-scaled by number of meetings, so thin records barely
// move. NB: only PRIMERA meetings count (lower-division history is excluded).
const H2H_WEIGHT = 0.15;
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
  model: ModelInfo;           // fitted internals + weights, for transparency
}

export interface ModelInfo {
  leagueMean: number;   // avg team-score this season
  homeAdvantage: number; // hfa, in points
  scoreSd: number;       // per-side score SD used to sample matches
  historyMeetings: number | null; // multi-season meetings behind the prior/H2H (null if cold)
  weights: {
    priorGames: number; priorFullHistory: number; decayPerSeason: number;
    h2hWeight: number; h2hFullConfidence: number; h2hMarginCap: number;
    resultBlend: number; scoreCapLo: number; scoreCapHi: number;
  };
  ratings: { team: string; attack: number; defense: number }[]; // fitted, opponent-adjusted
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

interface Game { opp: string; scored: number; conceded: number; home: boolean; }

function fitModel(
  completed: { home: string; away: string; hs: number; as: number }[],
  teams: string[],
  history: SeasonHistory | null,
  ppg: Map<string, number> | null,
): Model {
  const allScores = completed.flatMap((m) => [m.hs, m.as]);
  const leagueMean = allScores.reduce((a, b) => a + b, 0) / Math.max(1, allScores.length);
  LEAGUE_MEAN = leagueMean;

  // Winsorize cada team-score antes del fit. La recalibración llevó scoreWinsor a
  // 100 (prácticamente sin recorte): las goleadas SÍ son señal de fuerza y
  // recortarlas empeoraba la predicción fuera de muestra. Sincronizado con
  // modelCore.DEFAULTS.scoreWinsor=100 → cap ±100 (leagueMean-99 … leagueMean+101).
  const cap = (x: number) => Math.max(leagueMean - 99, Math.min(leagueMean + 101, x));

  const games = new Map<string, Game[]>();
  for (const t of teams) games.set(t, []);
  for (const m of completed) {
    const hs = cap(m.hs), as = cap(m.as);
    games.get(m.home)?.push({ opp: m.away, scored: hs, conceded: as, home: true });
    games.get(m.away)?.push({ opp: m.home, scored: as, conceded: hs, home: false });
  }
  // Ventaja de localía CALIBRADA (backtest walk-forward), no la empírica de esta
  // temporada. El HFA empírico de un solo año sobreajusta (2026 dio 4.05, pero
  // fuera de muestra 3 predice mejor y es lo que da el backtest) — usar el
  // empírico inflaba la ventaja del local y hacía la proyección más confiada de
  // lo que se sostiene. Sincronizado con modelCore.DEFAULTS.hfa.
  const hfa = HFA;

  // Historical prior (past seasons, recency-weighted inside seasonHistory),
  // rescaled from the past era's scoring level to this season's. Weight scaled
  // by how deep a club's record is; no history → the league mean at weight 0.
  const scale = history && history.histLeagueMean > 0 ? leagueMean / history.histLeagueMean : 0;
  const priorAtt = (t: string) => { const h = history?.teams[t]; return h && scale > 0 ? h.attack * scale : leagueMean; };
  const priorDef = (t: string) => { const h = history?.teams[t]; return h && scale > 0 ? h.defense * scale : leagueMean; };
  const priorW = (t: string) => PRIOR_GAMES * Math.min(history?.teams[t]?.games ?? 0, PRIOR_FULL_HISTORY) / PRIOR_FULL_HISTORY;

  // Opponent-adjusted attack/defence via alternating updates (Massey-style).
  // attack[t] = points t scores vs a league-average defence on neutral ground;
  // defence[t] = points t concedes from a league-average attack. Each pass peels
  // the opponent's strength and the home edge out of every score, then shrinks
  // toward the historical prior. Converges in a handful of iterations.
  const att = new Map<string, number>();
  const def = new Map<string, number>();
  for (const t of teams) {
    const gl = games.get(t)!;
    att.set(t, gl.length ? gl.reduce((a, g) => a + g.scored, 0) / gl.length : leagueMean);
    def.set(t, gl.length ? gl.reduce((a, g) => a + g.conceded, 0) / gl.length : leagueMean);
  }
  for (let it = 0; it < FIT_ITERS; it++) {
    const nextAtt = new Map<string, number>();
    for (const t of teams) {
      const gl = games.get(t)!;
      let sum = 0;
      for (const g of gl) sum += g.scored - (def.get(g.opp)! - leagueMean) - (g.home ? hfa / 2 : -hfa / 2);
      nextAtt.set(t, (sum + priorW(t) * priorAtt(t)) / (gl.length + priorW(t)));
    }
    const nextDef = new Map<string, number>();
    for (const t of teams) {
      const gl = games.get(t)!;
      let sum = 0;
      // conceded_by_t = attack[opp] + (defence[t] − mean) + opp's home edge
      for (const g of gl) sum += g.conceded - (nextAtt.get(g.opp)! - leagueMean) - (g.home ? -hfa / 2 : hfa / 2);
      nextDef.set(t, (sum + priorW(t) * priorDef(t)) / (gl.length + priorW(t)));
    }
    for (const t of teams) { att.set(t, nextAtt.get(t)!); def.set(t, nextDef.get(t)!); }
  }

  // Results blend: move each club a fraction of the way toward the strength its
  // actual league-points-per-game implies, in the dimension its scoring margin
  // doesn't already capture. A consistent winner with a thin margin (bonus
  // points, tight wins) gets a bump; a big-margin side that loses gets trimmed.
  if (ppg && ppg.size) {
    const strength = new Map(teams.map((t) => [t, att.get(t)! - def.get(t)!])); // expected net margin vs. average
    const ppgVals = teams.map((t) => ppg.get(t) ?? 0);
    const strVals = teams.map((t) => strength.get(t)!);
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const sd = (a: number[], m: number) => Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) || 1;
    const mPpg = mean(ppgVals), sPpg = sd(ppgVals, mPpg), mStr = mean(strVals), sStr = sd(strVals, mStr);
    for (const t of teams) {
      const ppgZ = ((ppg.get(t) ?? mPpg) - mPpg) / sPpg;
      const strZ = (strength.get(t)! - mStr) / sStr;
      const residual = (ppgZ - strZ) * sStr; // results-implied minus margin-implied strength, in margin points
      const bump = RESULT_BLEND * residual;
      att.set(t, att.get(t)! + bump / 2);
      def.set(t, def.get(t)! - bump / 2);
    }
  }

  const ratings = new Map<string, TeamRating>();
  for (const t of teams) ratings.set(t, { team: t, attack: att.get(t)!, defense: def.get(t)! });

  // SCORE_SD is a calibrated constant (see its definition) — deliberately not
  // re-fit from in-sample residuals, which understate out-of-sample spread.

  return { ratings, leagueMean, hfa };
}

// Neutral-ground rating margin (home minus away), in points, under the additive
// model — how much the ratings alone favour the home side before home advantage.
function ratingMargin(home: TeamRating, away: TeamRating): number {
  return (home.attack - away.attack) + (away.defense - home.defense);
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
      const rating = ratingMargin(ratings.get(home)!, ratings.get(away)!);
      const h2hMargin = pair.teamA === home ? pair.marginAoverB : -pair.marginAoverB;
      const conf = Math.min(pair.games, H2H_FULL_CONFIDENCE) / H2H_FULL_CONFIDENCE;
      adj.set(`${home}|${away}`, H2H_WEIGHT * conf * (h2hMargin - rating));
    }
  }
  return adj;
}

// Expected points for (home, away) under the additive attack/defence model:
// each side scores its own attack level adjusted by how far the opponent's
// defence sits from league average, plus the split home edge and optional H2H
// nudge. Unlike averaging the two, this preserves the full strength gap.
function expectedScores(home: TeamRating, away: TeamRating, hfa: number, h2hAdj = 0): [number, number] {
  const eh = home.attack + (away.defense - LEAGUE_MEAN) + hfa / 2 + h2hAdj / 2;
  const ea = away.attack + (home.defense - LEAGUE_MEAN) - hfa / 2 - h2hAdj / 2;
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

/**
 * Tabla de posiciones calculada desde los resultados finalizados (score-based),
 * con el sistema de puntos del Top 10: ganar 4 / empatar 2 / perder 0, +1 al que
 * gana marcando 25+ pts (bonus ofensivo, aproximado porque el feed no trae tries)
 * y +1 al que pierde por 7 o menos (bonus defensivo). Es la fuente de verdad de lo
 * jugado, sin depender de arusa ni del standings oficial (que va atrasado).
 */
function tableFromResults(
  completed: { home: string; away: string; hs: number; as: number }[],
  teams: string[],
): StandingRow[] {
  const t = new Map<string, StandingRow>();
  for (const team of teams) {
    t.set(team, { pos: 0, team, pj: 0, pg: 0, pe: 0, pp: 0, pf: 0, pc: 0, diff: 0, pts: 0 });
  }
  for (const m of completed) {
    const h = t.get(m.home), a = t.get(m.away);
    if (!h || !a) continue;
    h.pj += 1; a.pj += 1;
    h.pf += m.hs; h.pc += m.as; a.pf += m.as; a.pc += m.hs;
    const draw = m.hs === m.as, homeWin = m.hs > m.as;
    if (draw) { h.pe += 1; a.pe += 1; }
    else if (homeWin) { h.pg += 1; a.pp += 1; }
    else { a.pg += 1; h.pp += 1; }
    let hp = draw ? 2 : homeWin ? 4 : 0;
    let ap = draw ? 2 : homeWin ? 0 : 4;
    if (m.hs >= 25) hp += 1;               // bonus ofensivo (proxy 25+ pts)
    if (m.as >= 25) ap += 1;
    if (!draw && !homeWin && m.as - m.hs <= 7) hp += 1;  // bonus defensivo
    if (!draw && homeWin && m.hs - m.as <= 7) ap += 1;
    h.pts += hp; a.pts += ap;
  }
  for (const r of t.values()) r.diff = r.pf - r.pc;
  return [...t.values()]
    .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.pf - a.pf)
    .map((r, i) => ({ ...r, pos: i + 1 }));
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

  // Tabla base: se calcula desde los resultados FINALIZADOS del feed (la verdad de
  // lo que se jugó), NO desde el standings oficial de Leverade. Ese va atrasado y,
  // peor, con la F12 postergada cuenta un set de partidos distinto (mismo PJ, otras
  // fechas), así que la reconciliación por conteo no lo detectaba y la proyección
  // arrancaba de una tabla a la que le faltaban resultados. Calcular desde el feed
  // refleja cada fecha al instante y no depende de arusa. El bonus ofensivo se
  // aproxima por 25+ pts (mismo criterio que "Estimar bonus" del simulador del
  // front), porque el feed no trae tries. Fallback al reconciliado si aún no hay
  // resultados (pretemporada) o el feed viene vacío.
  const teamNames = Array.from(
    new Set([
      ...completed.flatMap((m) => [m.home, m.away]),
      ...remaining.flatMap((m) => [m.home, m.away]),
    ]),
  );
  let startTable = completed.length
    ? tableFromResults(completed, teamNames)
    : await getReconciledStandings(DIVISION);
  const teams = Array.from(
    new Set([...teamNames, ...(startTable?.map((r) => r.team) ?? [])]),
  );

  const history = await getSeasonHistory(teams);
  // Real league points-per-game (correct bonus points) per club, for the results
  // blend — from the same reconciled table the sim starts from.
  const ppg = startTable && startTable.length
    ? new Map(startTable.filter((r) => r.pj > 0).map((r) => [r.team, r.pts / r.pj]))
    : null;
  const model = fitModel(completed, teams, history, ppg);
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
    model: {
      leagueMean: Math.round(model.leagueMean * 10) / 10,
      homeAdvantage: Math.round(model.hfa * 10) / 10,
      scoreSd: Math.round(SCORE_SD * 10) / 10,
      historyMeetings: history?.meetings ?? null,
      weights: {
        priorGames: PRIOR_GAMES, priorFullHistory: PRIOR_FULL_HISTORY, decayPerSeason: DECAY,
        h2hWeight: H2H_WEIGHT, h2hFullConfidence: H2H_FULL_CONFIDENCE, h2hMarginCap: H2H_MARGIN_CAP,
        resultBlend: RESULT_BLEND,
        scoreCapLo: Math.round(model.leagueMean - 24), scoreCapHi: Math.round(model.leagueMean + 26),
      },
      ratings: [...model.ratings.values()]
        .map((r) => ({ team: r.team, attack: Math.round(r.attack * 10) / 10, defense: Math.round(r.defense * 10) / 10 }))
        .sort((a, b) => (b.attack - b.defense) - (a.attack - a.defense)),
    },
  };
}

// Short cache — the projection only moves when a result comes in, and the
// results feed itself is cached. Also invalidated when a fresh multi-season
// history build lands (tracked by version), so the odds pick it up right away.
let cache: { data: SeasonProjection; ts: number; sims: number; histV: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;
let recomputing = false;

async function recomputeProjection(sims: number): Promise<SeasonProjection> {
  const data = await simulateSeason(sims);
  cache = { data, ts: Date.now(), sims, histV: historyVersion() };
  return data;
}

export async function getSeasonProjection(sims = 50000): Promise<SeasonProjection> {
  const fresh =
    cache && cache.sims === sims && cache.histV === historyVersion() && Date.now() - cache.ts < CACHE_TTL;
  if (fresh) return cache!.data;

  // Stale-while-revalidate: el Monte Carlo tarda ~7s. Si hay algo cacheado (aunque
  // haya vencido o cambiara la versión del historial), lo devolvemos YA y
  // recomputamos en segundo plano — el usuario nunca espera. Sólo bloquea el
  // primerísimo cálculo (sin nada en caché, p. ej. recién arrancado).
  if (cache) {
    if (!recomputing) {
      recomputing = true;
      void recomputeProjection(sims)
        .catch(() => {})
        .finally(() => {
          recomputing = false;
        });
    }
    return cache.data;
  }
  return recomputeProjection(sims);
}
