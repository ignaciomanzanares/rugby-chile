/**
 * Backtest scoring + weight calibration — shared by the backtest report
 * (scripts/backtest.ts) and the re-calibration command (scripts/recalibrate.ts)
 * so they can never drift apart. The match math itself lives in modelCore.ts.
 *
 * Walk-forward, no leakage: every match is predicted using ONLY matches played
 * strictly before it.
 */
import { type Match, type Params, DEFAULTS, buildHistory, fitRatings, predict } from "./modelCore";

export interface Score { n: number; logloss: number; brier: number; acc: number; marginSE: number }

export function evaluate(all: Match[], p: Params, fromYear = 2023, minCurrentGames = 0): Score {
  let n = 0, logloss = 0, brier = 0, acc = 0, marginSE = 0;
  for (const m of all) {
    if (m.year < fromYear) continue;
    const before = all.filter((x) => x.date < m.date);
    if (before.filter((x) => x.year < m.year).length < 15) continue; // need a prior season
    if (minCurrentGames > 0) {
      const cur = before.filter((x) => x.year === m.year);
      const g = (t: string) => cur.filter((x) => x.home === t || x.away === t).length;
      if (Math.min(g(m.home), g(m.away)) < minCurrentGames) continue;
    }
    const hist = buildHistory(before, m.year, p);
    const r = fitRatings(before.filter((x) => x.year === m.year), hist, p);
    if (r.att.get(m.home) == null || r.att.get(m.away) == null) continue;
    const { pH, pD, pA, margin } = predict(m.home, m.away, r, hist, p);
    const s = pH + pD + pA; const qH = pH / s, qD = pD / s, qA = pA / s;
    const outcome = m.hs > m.as ? "H" : m.hs < m.as ? "A" : "D";
    const pTrue = outcome === "H" ? qH : outcome === "A" ? qA : qD;
    logloss += -Math.log(pTrue);
    brier += (qH - (outcome === "H" ? 1 : 0)) ** 2 + (qD - (outcome === "D" ? 1 : 0)) ** 2 + (qA - (outcome === "A" ? 1 : 0)) ** 2;
    if ((qH >= qD && qH >= qA ? "H" : qA >= qD ? "A" : "D") === outcome) acc++;
    marginSE += (margin - (m.hs - m.as)) ** 2;
    n++;
  }
  return { n, logloss: logloss / n, brier: brier / n, acc: acc / n, marginSE: Math.sqrt(marginSE / n) };
}

// No-skill baseline: predict the overall base rates for every match.
export function baseline(all: Match[], fromYear = 2023): Score {
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

// Grid searched by coordinate descent. Structural params (priorFullHistory,
// h2hMarginCap, h2hFullConf, fitIters) are intentionally fixed.
export const GRID: Partial<Record<keyof Params, number[]>> = {
  hfa: [0, 2, 3, 4, 5, 6, 7, 8],
  sdMargin: [12, 14, 15, 16, 17, 18, 19, 20, 22, 24],
  h2hWeight: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
  resultBlend: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
  decay: [0.3, 0.4, 0.5, 0.55, 0.65, 0.8],
  priorGames: [2, 3, 4, 5, 7, 9, 12, 16],
  scoreWinsor: [15, 20, 25, 30, 100],
};

// Coordinate descent on out-of-sample log-loss, starting from DEFAULTS.
// `pinned` keys are held fixed at their DEFAULTS value (editorial decisions the
// optimizer shouldn't override, e.g. the H2H weight for real rivalries).
export function calibrate(all: Match[], pinned: Set<keyof Params> = new Set()): Params {
  let best = { ...DEFAULTS };
  let bestLoss = evaluate(all, best).logloss;
  for (let pass = 0; pass < 3; pass++) {
    for (const key of Object.keys(GRID) as (keyof Params)[]) {
      if (pinned.has(key)) continue;
      let localBest = best[key], localLoss = bestLoss;
      for (const v of GRID[key]!) {
        const loss = evaluate(all, { ...best, [key]: v }).logloss;
        if (loss < localLoss) { localLoss = loss; localBest = v; }
      }
      best = { ...best, [key]: localBest }; bestLoss = localLoss;
    }
  }
  return best;
}
