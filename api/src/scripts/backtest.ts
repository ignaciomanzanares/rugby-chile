/**
 * Backtest + weight calibration for the season-projection model.
 *
 * Walk-forward: for every PRIMERA match from 2023 on, fit the model on ONLY the
 * matches played strictly before it and predict 1/X/2, then score against what
 * actually happened. No leakage. The model math is imported from
 * services/modelCore.ts — the SAME code production and the live-validation
 * endpoint use, so the calibration can't drift from what's deployed.
 *
 * Rugby UNION scoring (not league). A sanity check reproduces production's
 * COBS–Old Reds number.
 *
 *   npx tsx src/scripts/backtest.ts
 */
import "dotenv/config";
import dns from "node:dns"; dns.setDefaultResultOrder("ipv4first");
import {
  type Match, type Params, DEFAULTS, buildHistory, fitRatings, predict, assembleMatchDataset,
} from "../services/modelCore";

// ── Walk-forward scoring ─────────────────────────────────────────────────────
interface Score { n: number; logloss: number; brier: number; acc: number; marginSE: number }
function evaluate(all: Match[], p: Params, fromYear = 2023, minCurrentGames = 0): Score {
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

// ── Coordinate-descent calibration on out-of-sample log-loss ─────────────────
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
        const loss = evaluate(all, { ...best, [key]: v }).logloss;
        if (loss < localLoss) { localLoss = loss; localBest = v; }
      }
      best = { ...best, [key]: localBest }; bestLoss = localLoss;
    }
  }
  return best;
}

// ── Últimos resultados vs. lo que el modelo habría dado ──────────────────────
function validateRecent(all: Match[], p: Params, n = 8) {
  const recent = [...all].sort((a, b) => b.date.localeCompare(a.date)).slice(0, n).reverse();
  console.log("\n── Últimos resultados vs. pronóstico (reconstruido con datos previos) ──");
  let brier = 0, ll = 0, hits = 0, cnt = 0;
  for (const m of recent) {
    const before = all.filter((x) => x.date < m.date);
    if (before.filter((x) => x.year < m.year).length < 15) continue;
    const hist = buildHistory(before, m.year, p);
    const r = fitRatings(before.filter((x) => x.year === m.year), hist, p);
    if (r.att.get(m.home) == null || r.att.get(m.away) == null) continue;
    const { pH, pD, pA } = predict(m.home, m.away, r, hist, p);
    const s = pH + pD + pA; const qH = pH / s, qD = pD / s, qA = pA / s;
    const outcome = m.hs > m.as ? "H" : m.hs < m.as ? "A" : "D";
    const pTrue = outcome === "H" ? qH : outcome === "A" ? qA : qD;
    const hit = (qH >= qD && qH >= qA ? "H" : qA >= qD ? "A" : "D") === outcome;
    ll += -Math.log(pTrue); brier += (qH - (outcome === "H" ? 1 : 0)) ** 2 + (qD - (outcome === "D" ? 1 : 0)) ** 2 + (qA - (outcome === "A" ? 1 : 0)) ** 2;
    hits += hit ? 1 : 0; cnt++;
    console.log(`\n  ${m.home} vs ${m.away}  (${m.date})`);
    console.log(`    modelo:  1 ${(qH * 100).toFixed(0)}% · X ${(qD * 100).toFixed(0)}% · 2 ${(qA * 100).toFixed(0)}%   (favorito: ${qH >= qA ? m.home : m.away})`);
    console.log(`    real:    ${m.home} ${m.hs}-${m.as} ${m.away}  → ${hit ? "ACIERTO ✓" : "falló ✗"}  (le daba ${(pTrue * 100).toFixed(0)}% a lo que pasó)`);
  }
  if (cnt) console.log(`\n  Resumen ${cnt} partidos: aciertos ${hits}/${cnt} · logloss ${(ll / cnt).toFixed(3)} · brier ${(brier / cnt).toFixed(3)}`);
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const all = await assembleMatchDataset();
  console.log(`dataset: ${all.length} partidos — años ${[...new Set(all.map((m) => m.year))].sort().join(", ")}`);
  const fmt = (s: Score) => `logloss ${s.logloss.toFixed(4)} · brier ${s.brier.toFixed(4)} · acc ${(s.acc * 100).toFixed(1)}% · margenRMSE ${isNaN(s.marginSE) ? "—" : s.marginSE.toFixed(1)} · n=${s.n}`;

  console.log("\n── Backtest walk-forward (partidos 2023+) ──");
  console.log("baseline (tasa base):      ", fmt(baseline(all)));
  console.log("params actuales:           ", fmt(evaluate(all, DEFAULTS)));

  console.log("\ncalibrando (descenso de coordenadas sobre log-loss)…");
  const best = calibrate(all);
  console.log("params calibrados:         ", fmt(evaluate(all, best)));
  console.log("\nPESOS CALIBRADOS:");
  for (const k of Object.keys(DEFAULTS) as (keyof Params)[]) {
    console.log(`  ${k.padEnd(18)} ${String(DEFAULTS[k]).padStart(6)}  →  ${String(best[k]).padStart(6)}${best[k] !== DEFAULTS[k] ? "   *" : ""}`);
  }

  console.log("\nSENSIBILIDAD (log-loss variando un peso, resto = calibrado):");
  for (const key of Object.keys(GRID) as (keyof Params)[]) {
    const cells = GRID[key]!.map((v) => `${v}:${evaluate(all, { ...best, [key]: v }).logloss.toFixed(4)}${v === best[key] ? "◄" : " "}`);
    console.log(`  ${key.padEnd(14)} ${cells.join("  ")}`);
  }

  console.log("\n── Régimen fecha avanzada (≥7 partidos jugados este año) ──");
  const lateBase = evaluate(all, best, 2023, 7);
  console.log(`calibrado en este régimen: logloss ${lateBase.logloss.toFixed(4)} · acc ${(lateBase.acc * 100).toFixed(1)}% · n=${lateBase.n}`);
  for (const key of ["priorGames", "sdMargin", "h2hWeight", "decay"] as (keyof Params)[]) {
    const cells = GRID[key]!.map((v) => `${v}:${evaluate(all, { ...best, [key]: v }, 2023, 7).logloss.toFixed(4)}`);
    console.log(`  ${key.padEnd(14)} ${cells.join("  ")}`);
  }

  validateRecent(all, DEFAULTS);

  // Sanity: production predicts COBS home vs Old Reds ~81%.
  const hist = buildHistory(all, 2026, DEFAULTS);
  const r = fitRatings(all.filter((m) => m.year === 2026), hist, DEFAULTS);
  if (r.att.get("COBS") != null && r.att.get("Old Reds") != null) {
    const pr = predict("COBS", "Old Reds", r, hist, DEFAULTS);
    const s = pr.pH + pr.pD + pr.pA;
    console.log(`\nsanity COBS vs Old Reds (defaults): ${(pr.pH / s * 100).toFixed(0)}% / ${(pr.pD / s * 100).toFixed(0)}% / ${(pr.pA / s * 100).toFixed(0)}%  (producción ≈ 81/2/17)`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
