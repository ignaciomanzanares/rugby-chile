/**
 * Live model validation — reconstructs, for every played PRIMERA match, the
 * 1/X/2 the model WOULD have given using only data available before that match
 * (no leakage), and compares it to what actually happened. Because the model is
 * deterministic, this needs no pre-match snapshots — it's recomputed on demand.
 *
 * Feeds the "Aciertos del modelo" view: a running scoreboard (accuracy, log-loss,
 * Brier) plus a reliability curve (when it says 70%, do they win ~70%?).
 */
import { assembleMatchDataset, buildHistory, fitRatings, predict, DEFAULTS } from "./modelCore";

export interface ValidationGame {
  date: string; home: string; away: string; hs: number; as: number;
  pHome: number; pDraw: number; pAway: number; expHome: number; expAway: number;
  outcome: "H" | "D" | "A"; predicted: "H" | "D" | "A"; hit: boolean; pWinner: number;
}
export interface CalibrationBin { label: string; predicted: number; actual: number; count: number }
export interface ModelAccuracy {
  sinceYear: number;
  generatedAt: string;
  summary: { n: number; hits: number; accuracy: number; logloss: number; brier: number; drawShare: number };
  calibration: CalibrationBin[];
  games: ValidationGame[]; // most recent first
}

let cache: { data: ModelAccuracy; ts: number; sinceYear: number } | null = null;
const TTL = 10 * 60 * 1000;

export async function getModelAccuracy(sinceYear = 2025): Promise<ModelAccuracy> {
  if (cache && cache.sinceYear === sinceYear && Date.now() - cache.ts < TTL) return cache.data;

  const all = await assembleMatchDataset();
  const games: ValidationGame[] = [];

  for (const m of all) {
    if (m.year < sinceYear) continue;
    const before = all.filter((x) => x.date < m.date);
    if (before.filter((x) => x.year < m.year).length < 15) continue; // need a prior season of history
    const hist = buildHistory(before, m.year, DEFAULTS);
    const r = fitRatings(before.filter((x) => x.year === m.year), hist, DEFAULTS);
    if (r.att.get(m.home) == null || r.att.get(m.away) == null) continue;

    const pr = predict(m.home, m.away, r, hist, DEFAULTS);
    const s = pr.pH + pr.pD + pr.pA;
    const pHome = pr.pH / s, pDraw = pr.pD / s, pAway = pr.pA / s;
    const outcome: "H" | "D" | "A" = m.hs > m.as ? "H" : m.hs < m.as ? "A" : "D";
    const predicted: "H" | "D" | "A" = pHome >= pDraw && pHome >= pAway ? "H" : pAway >= pDraw ? "A" : "D";
    const pWinner = Math.max(pHome, pDraw, pAway);
    games.push({
      date: m.date, home: m.home, away: m.away, hs: m.hs, as: m.as,
      pHome, pDraw, pAway, expHome: Math.round(pr.expHome * 10) / 10, expAway: Math.round(pr.expAway * 10) / 10,
      outcome, predicted, hit: predicted === outcome, pWinner,
    });
  }

  const n = games.length || 1;
  const hits = games.filter((g) => g.hit).length;
  const logloss = games.reduce((a, g) => a - Math.log(g.outcome === "H" ? g.pHome : g.outcome === "A" ? g.pAway : g.pDraw), 0) / n;
  const brier = games.reduce((a, g) =>
    a + (g.pHome - (g.outcome === "H" ? 1 : 0)) ** 2 + (g.pDraw - (g.outcome === "D" ? 1 : 0)) ** 2 + (g.pAway - (g.outcome === "A" ? 1 : 0)) ** 2, 0) / n;
  const drawShare = games.filter((g) => g.outcome === "D").length / n;

  // Reliability curve: bin by the confidence in the predicted winner, compare to
  // the realized hit-rate in each bin.
  const edges = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0001];
  const calibration: CalibrationBin[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i], hi = edges[i + 1];
    const inBin = games.filter((g) => g.pWinner >= lo && g.pWinner < hi);
    if (inBin.length === 0) continue;
    calibration.push({
      label: `${Math.round(lo * 100)}–${Math.round(Math.min(hi, 1) * 100)}%`,
      predicted: inBin.reduce((a, g) => a + g.pWinner, 0) / inBin.length,
      actual: inBin.filter((g) => g.hit).length / inBin.length,
      count: inBin.length,
    });
  }

  const data: ModelAccuracy = {
    sinceYear,
    generatedAt: new Date().toISOString(),
    summary: { n: games.length, hits, accuracy: hits / n, logloss, brier, drawShare },
    calibration,
    games: [...games].reverse(),
  };
  cache = { data, ts: Date.now(), sinceYear };
  return data;
}
