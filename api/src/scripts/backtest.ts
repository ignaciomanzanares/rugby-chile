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
import { type Score, evaluate, baseline, calibrate, GRID } from "../services/backtestCore";

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
