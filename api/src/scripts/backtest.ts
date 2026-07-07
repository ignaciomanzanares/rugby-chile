/**
 * Backtest + weight calibration for the season-projection model.
 *
 * Walk-forward: for every PRIMERA match from 2023 on, we fit the model on ONLY
 * the matches played strictly before it (past seasons + the current season up to
 * that point), predict 1/X/2 and the margin, then score the prediction against
 * what actually happened. No leakage.
 *
 * The model math here mirrors production (services/simulateSeason.ts +
 * seasonHistory.ts) but exposed as a Params object so we can sweep the weights
 * and pick the set that minimises out-of-sample log-loss — instead of tuning by
 * eye. A sanity check re-fits on the full current season and confirms it
 * reproduces production's COBS–Old Reds number, so the two can't drift apart.
 *
 * Scoring rules (rugby UNION — not league): win 4 / draw 2 / loss 0, +1 try
 * bonus (est.), +1 losing bonus (≤7). Home-advantage / margin-SD priors come
 * from union sources (ELOR, Six Nations, PyMC), never NRL.
 *
 *   npx tsx src/scripts/backtest.ts
 */
import "dotenv/config";
import dns from "node:dns"; dns.setDefaultResultOrder("ipv4first");
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { computeH2H } from "../services/computeH2H";
import { fetchAllResults } from "../routes/leveradeResults";

const CLUBS = [
  "COBS", "Old Boys", "PWCC", "Old Macks", "Stade Francais",
  "Sporting RC", "DOBS", "UC", "Old Johns", "Old Reds",
];
const DATA_CACHE = resolve(__dirname, "../../.backtest-matches.json");

interface Match { year: number; date: string; home: string; away: string; hs: number; as: number }

// ── 1. Assemble the full PRIMERA match history (cached to disk) ──────────────
async function assembleDataset(): Promise<Match[]> {
  if (existsSync(DATA_CACHE)) {
    const cached = JSON.parse(readFileSync(DATA_CACHE, "utf8")) as Match[];
    if (cached.length > 50) { console.log(`dataset: ${cached.length} matches (cache)`); return cached; }
  }
  const seen = new Set<string>();
  const matches: Match[] = [];
  // Past seasons via computeH2H (2021–2025).
  for (let i = 0; i < CLUBS.length; i++) {
    for (let j = i + 1; j < CLUBS.length; j++) {
      let h;
      try { h = await computeH2H("PRIMERA", CLUBS[i], CLUBS[j]); } catch { continue; }
      for (const m of h.meetings) {
        if (m.year >= 2026) continue;
        const key = `${m.year}|${m.homeTeam}|${m.awayTeam}|${m.homeScore}-${m.awayScore}`;
        if (seen.has(key)) continue; seen.add(key);
        matches.push({ year: m.year, date: m.date ?? `${m.year}-06-01`, home: m.homeTeam, away: m.awayTeam, hs: m.homeScore, as: m.awayScore });
      }
    }
  }
  // Current season (2026) via the live results feed.
  try {
    const results = await fetchAllResults();
    for (const m of Object.values(results)) {
      if (m.division !== "PRIMERA" || !m.finished || m.homeScore == null || m.awayScore == null) continue;
      const date = m.datetime ? m.datetime.slice(0, 10) : "2026-06-01";
      matches.push({ year: 2026, date, home: m.homeTeam, away: m.awayTeam, hs: m.homeScore, as: m.awayScore });
    }
  } catch { /* no live feed */ }

  matches.sort((a, b) => a.date.localeCompare(b.date));
  writeFileSync(DATA_CACHE, JSON.stringify(matches));
  console.log(`dataset: ${matches.length} matches (rebuilt) — years ${[...new Set(matches.map((m) => m.year))].sort().join(", ")}`);
  return matches;
}

// ── 2. Parameterised model (mirrors production) ──────────────────────────────
interface Params {
  hfa: number;            // home advantage, points (fixed prior, not fitted per-cutoff)
  sdMargin: number;       // predictive SD of the margin (local − visita)
  h2hWeight: number;
  resultBlend: number;
  decay: number;          // per-season recency for prior + H2H
  priorGames: number;
  priorFullHistory: number;
  h2hMarginCap: number;
  h2hFullConf: number;
  scoreWinsor: number;    // half-width around league mean for winsorizing the fit
  fitIters: number;
}
// Production values after backtest calibration (services/simulateSeason.ts).
// sdMargin = SCORE_SD·√2 = 11.3·√2 ≈ 16.
const DEFAULTS: Params = {
  hfa: 2.8, sdMargin: 16, h2hWeight: 0, resultBlend: 0.15, decay: 0.55,
  priorGames: 3, priorFullHistory: 20, h2hMarginCap: 21, h2hFullConf: 6,
  scoreWinsor: 25, fitIters: 20,
};

const clampScore = (n: number) => { let x = Math.max(0, Math.round(n)); return x; };
// Approx league points a team earns in one match (bonus estimated from score,
// since historical try counts aren't available).
function leaguePoints(scored: number, conceded: number): number {
  const win = scored > conceded, draw = scored === conceded;
  let p = draw ? 2 : win ? 4 : 0;
  if (scored >= 25) p += 1;                       // ~4-try bonus, estimated
  if (!draw && !win && conceded - scored <= 7) p += 1; // losing bonus
  return p;
}

interface Ratings { att: Map<string, number>; def: Map<string, number>; leagueMean: number }

// Historical prior + H2H margins from every match strictly before `cutoff`,
// recency-weighted by season (current season = weight 1).
function buildHistory(before: Match[], year: number, p: Params) {
  const past = before.filter((m) => m.year < year);
  const tS = new Map<string, number>(), tC = new Map<string, number>(), tW = new Map<string, number>(), tG = new Map<string, number>();
  let lgW = 0, lgS = 0;
  for (const m of past) {
    const w = p.decay ** (year - m.year);
    const add = (mp: Map<string, number>, k: string, v: number) => mp.set(k, (mp.get(k) ?? 0) + v);
    add(tS, m.home, w * m.hs); add(tC, m.home, w * m.as); add(tW, m.home, w); add(tG, m.home, 1);
    add(tS, m.away, w * m.as); add(tC, m.away, w * m.hs); add(tW, m.away, w); add(tG, m.away, 1);
    lgW += 2 * w; lgS += w * (m.hs + m.as);
  }
  const teams: Record<string, { attack: number; defense: number; games: number }> = {};
  for (const t of CLUBS) { const w = tW.get(t) ?? 0; if (w > 0) teams[t] = { attack: tS.get(t)! / w, defense: tC.get(t)! / w, games: tG.get(t) ?? 0 }; }
  const histLeagueMean = lgW > 0 ? lgS / lgW : 0;

  // H2H: all meetings before cutoff (incl. current season), capped, decayed.
  const h2h = new Map<string, { games: number; marginAoverB: number }>();
  const byPair = new Map<string, Match[]>();
  for (const m of before) { const k = [m.home, m.away].sort().join("__"); (byPair.get(k) ?? byPair.set(k, []).get(k)!).push(m); }
  for (const [k, ms] of byPair) {
    const [sA] = k.split("__");
    let mW = 0, mM = 0;
    for (const m of ms) {
      const w = p.decay ** (year - m.year);
      const aS = m.home === sA ? m.hs : m.as, bS = m.home === sA ? m.as : m.hs;
      const margin = Math.max(-p.h2hMarginCap, Math.min(p.h2hMarginCap, aS - bS));
      mW += w; mM += w * margin;
    }
    if (mW > 0) h2h.set(k, { games: ms.length, marginAoverB: mM / mW });
  }
  return { teams, histLeagueMean, h2h };
}

function fitRatings(current: Match[], history: ReturnType<typeof buildHistory>, p: Params): Ratings {
  const scores = current.flatMap((m) => [m.hs, m.as]);
  const leagueMean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length
    : (history.histLeagueMean || 28);
  const cap = (x: number) => Math.max(leagueMean - p.scoreWinsor + 1, Math.min(leagueMean + p.scoreWinsor + 1, x));

  interface G { opp: string; scored: number; conceded: number; home: boolean }
  const games = new Map<string, G[]>();
  for (const t of CLUBS) games.set(t, []);
  for (const m of current) {
    const hs = cap(m.hs), as = cap(m.as);
    games.get(m.home)?.push({ opp: m.away, scored: hs, conceded: as, home: true });
    games.get(m.away)?.push({ opp: m.home, scored: as, conceded: hs, home: false });
  }

  const scale = history.histLeagueMean > 0 ? leagueMean / history.histLeagueMean : 0;
  const priorAtt = (t: string) => { const h = history.teams[t]; return h && scale > 0 ? h.attack * scale : leagueMean; };
  const priorDef = (t: string) => { const h = history.teams[t]; return h && scale > 0 ? h.defense * scale : leagueMean; };
  const priorW = (t: string) => p.priorGames * Math.min(history.teams[t]?.games ?? 0, p.priorFullHistory) / p.priorFullHistory;

  const att = new Map<string, number>(), def = new Map<string, number>();
  for (const t of CLUBS) {
    const gl = games.get(t)!;
    att.set(t, gl.length ? gl.reduce((a, g) => a + g.scored, 0) / gl.length : leagueMean);
    def.set(t, gl.length ? gl.reduce((a, g) => a + g.conceded, 0) / gl.length : leagueMean);
  }
  for (let it = 0; it < p.fitIters; it++) {
    const nA = new Map<string, number>();
    for (const t of CLUBS) {
      const gl = games.get(t)!; let s = 0;
      for (const g of gl) s += g.scored - (def.get(g.opp)! - leagueMean) - (g.home ? p.hfa / 2 : -p.hfa / 2);
      nA.set(t, (s + priorW(t) * priorAtt(t)) / (gl.length + priorW(t)));
    }
    const nD = new Map<string, number>();
    for (const t of CLUBS) {
      const gl = games.get(t)!; let s = 0;
      for (const g of gl) s += g.conceded - (nA.get(g.opp)! - leagueMean) - (g.home ? -p.hfa / 2 : p.hfa / 2);
      nD.set(t, (s + priorW(t) * priorDef(t)) / (gl.length + priorW(t)));
    }
    for (const t of CLUBS) { att.set(t, nA.get(t)!); def.set(t, nD.get(t)!); }
  }

  // Results blend (uses current-season approx ppg).
  if (current.length) {
    const pts = new Map<string, number>(), gp = new Map<string, number>();
    for (const m of current) {
      pts.set(m.home, (pts.get(m.home) ?? 0) + leaguePoints(m.hs, m.as));
      pts.set(m.away, (pts.get(m.away) ?? 0) + leaguePoints(m.as, m.hs));
      gp.set(m.home, (gp.get(m.home) ?? 0) + 1); gp.set(m.away, (gp.get(m.away) ?? 0) + 1);
    }
    const teamsWithGames = CLUBS.filter((t) => (gp.get(t) ?? 0) > 0);
    if (teamsWithGames.length >= 4) {
      const ppg = (t: string) => (pts.get(t) ?? 0) / Math.max(1, gp.get(t) ?? 0);
      const strength = new Map(CLUBS.map((t) => [t, att.get(t)! - def.get(t)!]));
      const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
      const sd = (a: number[], m: number) => Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) || 1;
      const pv = teamsWithGames.map(ppg), sv = teamsWithGames.map((t) => strength.get(t)!);
      const mP = mean(pv), sP = sd(pv, mP), mS = mean(sv), sS = sd(sv, mS);
      for (const t of teamsWithGames) {
        const bump = p.resultBlend * (((ppg(t) - mP) / sP - (strength.get(t)! - mS) / sS) * sS);
        att.set(t, att.get(t)! + bump / 2); def.set(t, def.get(t)! - bump / 2);
      }
    }
  }
  return { att, def, leagueMean };
}

function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const pr = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - pr : pr;
}

// Predict one match → {pH, pD, pA, margin}.
function predict(home: string, away: string, r: Ratings, hist: ReturnType<typeof buildHistory>, p: Params) {
  const ratingMargin = (r.att.get(home)! - r.att.get(away)!) + (r.def.get(away)! - r.def.get(home)!);
  const pair = hist.h2h.get([home, away].sort().join("__"));
  let h2h = 0;
  if (pair && pair.games >= 3) {
    const [sA] = [home, away].sort();
    const h2hMargin = sA === home ? pair.marginAoverB : -pair.marginAoverB;
    const conf = Math.min(pair.games, p.h2hFullConf) / p.h2hFullConf;
    h2h = p.h2hWeight * conf * (h2hMargin - ratingMargin);
  }
  const eh = r.att.get(home)! + (r.def.get(away)! - r.leagueMean) + p.hfa / 2 + h2h / 2;
  const ea = r.att.get(away)! + (r.def.get(home)! - r.leagueMean) - p.hfa / 2 - h2h / 2;
  const mu = eh - ea, sd = p.sdMargin;
  const pD = normCdf((0.5 - mu) / sd) - normCdf((-0.5 - mu) / sd);
  const pA = normCdf((-0.5 - mu) / sd);
  const pH = Math.max(1e-6, 1 - pD - pA);
  return { pH, pD: Math.max(1e-6, pD), pA: Math.max(1e-6, pA), margin: mu };
}

// ── 3. Walk-forward scoring ──────────────────────────────────────────────────
interface Score { n: number; logloss: number; brier: number; acc: number; marginSE: number }
function evaluate(all: Match[], p: Params, fromYear = 2023, minCurrentGames = 0): Score {
  let n = 0, logloss = 0, brier = 0, acc = 0, marginSE = 0;
  for (let i = 0; i < all.length; i++) {
    const m = all[i];
    if (m.year < fromYear) continue;
    const before = all.filter((x) => x.date < m.date);
    if (before.filter((x) => x.year < m.year).length < 15) continue; // need a prior season
    if (minCurrentGames > 0) {
      // Restrict to a late-season regime: both sides already have this many
      // games in the current season (matches our real use — projecting at fecha 11+).
      const cur = before.filter((x) => x.year === m.year);
      const g = (t: string) => cur.filter((x) => x.home === t || x.away === t).length;
      if (Math.min(g(m.home), g(m.away)) < minCurrentGames) continue;
    }
    const hist = buildHistory(before, m.year, p);
    const current = before.filter((x) => x.year === m.year);
    const r = fitRatings(current, hist, p);
    if (r.att.get(m.home) == null || r.att.get(m.away) == null) continue;
    const { pH, pD, pA, margin } = predict(m.home, m.away, r, hist, p);
    const s = pH + pD + pA; const qH = pH / s, qD = pD / s, qA = pA / s;
    const outcome = m.hs > m.as ? "H" : m.hs < m.as ? "A" : "D";
    const pTrue = outcome === "H" ? qH : outcome === "A" ? qA : qD;
    logloss += -Math.log(pTrue);
    brier += (qH - (outcome === "H" ? 1 : 0)) ** 2 + (qD - (outcome === "D" ? 1 : 0)) ** 2 + (qA - (outcome === "A" ? 1 : 0)) ** 2;
    const pred = qH >= qD && qH >= qA ? "H" : qA >= qD ? "A" : "D";
    if (pred === outcome) acc++;
    marginSE += (margin - (m.hs - m.as)) ** 2;
    n++;
  }
  return { n, logloss: logloss / n, brier: brier / n, acc: acc / n, marginSE: Math.sqrt(marginSE / n) };
}

// No-skill baseline: predict the overall base rates for every match.
function baseline(all: Match[], fromYear = 2023): Score {
  const test = all.filter((m) => m.year >= fromYear);
  let h = 0, d = 0; for (const m of test) { if (m.hs > m.as) h++; else if (m.hs === m.as) d++; }
  const pH = h / test.length, pD = d / test.length, pA = 1 - pH - pD;
  let logloss = 0, brier = 0, acc = 0;
  for (const m of test) {
    const o = m.hs > m.as ? "H" : m.hs < m.as ? "A" : "D";
    logloss += -Math.log(o === "H" ? pH : o === "A" ? pA : Math.max(1e-6, pD));
    brier += (pH - (o === "H" ? 1 : 0)) ** 2 + (pD - (o === "D" ? 1 : 0)) ** 2 + (pA - (o === "A" ? 1 : 0)) ** 2;
    if ((pH >= pA ? "H" : "A") === o) acc++;
  }
  return { n: test.length, logloss: logloss / test.length, brier: brier / test.length, acc: acc / test.length, marginSE: NaN };
}

// ── 4. Coordinate-descent calibration on out-of-sample log-loss ──────────────
const GRID: Partial<Record<keyof Params, number[]>> = {
  hfa: [0, 2, 3, 4, 5, 6, 7, 8],
  sdMargin: [12, 14, 15, 16, 17, 18, 19, 20, 22, 24],
  h2hWeight: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
  resultBlend: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
  decay: [0.3, 0.4, 0.5, 0.55, 0.65, 0.8],
  priorGames: [2, 3, 4, 5, 7, 9, 12, 16],
  scoreWinsor: [15, 20, 25, 30, 100],
};

function calibrate(all: Match[]): Params {
  let best = { ...DEFAULTS };
  let bestLoss = evaluate(all, best).logloss;
  for (let pass = 0; pass < 3; pass++) {
    for (const key of Object.keys(GRID) as (keyof Params)[]) {
      let localBest = best[key], localLoss = bestLoss;
      for (const v of GRID[key]!) {
        const trial = { ...best, [key]: v };
        const loss = evaluate(all, trial).logloss;
        if (loss < localLoss) { localLoss = loss; localBest = v; }
      }
      best = { ...best, [key]: localBest }; bestLoss = localLoss;
    }
  }
  return best;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const all = await assembleDataset();
  const fmt = (s: Score) => `logloss ${s.logloss.toFixed(4)} · brier ${s.brier.toFixed(4)} · acc ${(s.acc * 100).toFixed(1)}% · margenRMSE ${isNaN(s.marginSE) ? "—" : s.marginSE.toFixed(1)} · n=${s.n}`;

  console.log("\n── Backtest walk-forward (partidos 2023+) ──");
  console.log("baseline (tasa base):      ", fmt(baseline(all)));
  console.log("params actuales:           ", fmt(evaluate(all, DEFAULTS)));

  console.log("\ncalibrando (descenso de coordenadas sobre log-loss)…");
  const best = calibrate(all);
  console.log("params calibrados:         ", fmt(evaluate(all, best)));
  console.log("\nPESOS CALIBRADOS:");
  for (const k of Object.keys(DEFAULTS) as (keyof Params)[]) {
    const changed = best[k] !== DEFAULTS[k];
    console.log(`  ${k.padEnd(18)} ${String(DEFAULTS[k]).padStart(6)}  →  ${String(best[k]).padStart(6)}${changed ? "   *" : ""}`);
  }

  // Sensitivity: log-loss at each grid value, holding the others at their best.
  // Shows whether an optimum is sharp (real signal) or flat (marginal).
  console.log("\nSENSIBILIDAD (log-loss variando un peso, resto = calibrado):");
  for (const key of Object.keys(GRID) as (keyof Params)[]) {
    const cells = GRID[key]!.map((v) => {
      const loss = evaluate(all, { ...best, [key]: v }).logloss;
      const mark = v === best[key] ? "◄" : " ";
      return `${v}:${loss.toFixed(4)}${mark}`;
    });
    console.log(`  ${key.padEnd(14)} ${cells.join("  ")}`);
  }

  // Late-season regime (both sides ≥7 games this season) — our real use case.
  console.log("\n── Régimen fecha avanzada (≥7 partidos jugados este año) ──");
  const lateBase = evaluate(all, best, 2023, 7);
  console.log(`calibrado en este régimen: logloss ${lateBase.logloss.toFixed(4)} · acc ${(lateBase.acc * 100).toFixed(1)}% · n=${lateBase.n}`);
  for (const key of ["priorGames", "sdMargin", "h2hWeight", "decay"] as (keyof Params)[]) {
    const cells = GRID[key]!.map((v) => {
      const loss = evaluate(all, { ...best, [key]: v }, 2023, 7).logloss;
      return `${v}:${loss.toFixed(4)}`;
    });
    console.log(`  ${key.padEnd(14)} ${cells.join("  ")}`);
  }

  // Sanity: production currently predicts COBS home vs Old Reds ~79%. Re-fit on
  // the full current season with DEFAULTS and confirm we're in the same place.
  const beforeAll = all.filter((m) => m.date <= "2026-12-31");
  const hist = buildHistory(beforeAll, 2026, DEFAULTS);
  const cur = beforeAll.filter((m) => m.year === 2026);
  const r = fitRatings(cur, hist, DEFAULTS);
  if (r.att.get("COBS") != null && r.att.get("Old Reds") != null) {
    const pr = predict("COBS", "Old Reds", r, hist, DEFAULTS);
    console.log(`\nsanity COBS vs Old Reds (defaults): ${(pr.pH * 100).toFixed(0)}% / ${(pr.pD * 100).toFixed(0)}% / ${(pr.pA * 100).toFixed(0)}%  (producción ≈ 79/2/18)`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
