/**
 * Re-calibración de los pesos del modelo.
 *
 * Corre el mismo backtest walk-forward (services/backtestCore) sobre TODO el
 * dataset disponible y busca, por descenso de coordenadas, los pesos que
 * minimizan el log-loss fuera de muestra. Compara contra los DEFAULTS actuales
 * y propone el cambio.
 *
 *   npm run recalibrate            → propone (dry-run, no toca nada)
 *   npm run recalibrate -- --write → aplica el cambio a services/modelCore.ts
 *
 * Nunca reescribe en silencio: en modo --write muestra el diff y te recuerda
 * commitear. Solo aplica si la mejora en log-loss supera el umbral (evita
 * perseguir ruido de unas pocas fechas nuevas).
 */
import "dotenv/config";
import dns from "node:dns"; dns.setDefaultResultOrder("ipv4first");
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Params, DEFAULTS, assembleMatchDataset } from "../services/modelCore";
import { evaluate, calibrate } from "../services/backtestCore";

// Mínima mejora en log-loss para molestarse en cambiar los pesos.
const MIN_IMPROVEMENT = 0.003;

// npm run recalibrate ejecuta con cwd = carpeta api.
const MODEL_CORE = resolve(process.cwd(), "src/services/modelCore.ts");

// Reproduce el bloque DEFAULTS con el MISMO formato que el archivo original,
// para que el diff sea sólo los números que cambian.
function renderDefaults(p: Params): string {
  const n = (v: number) => String(v);
  return `export const DEFAULTS: Params = {
  hfa: ${n(p.hfa)}, sdMargin: ${n(p.sdMargin)}, h2hWeight: ${n(p.h2hWeight)}, resultBlend: ${n(p.resultBlend)}, decay: ${n(p.decay)},
  priorGames: ${n(p.priorGames)}, priorFullHistory: ${n(p.priorFullHistory)}, h2hMarginCap: ${n(p.h2hMarginCap)}, h2hFullConf: ${n(p.h2hFullConf)},
  scoreWinsor: ${n(p.scoreWinsor)}, fitIters: ${n(p.fitIters)},
};`;
}

function writeDefaults(next: Params) {
  const src = readFileSync(MODEL_CORE, "utf8");
  const re = /export const DEFAULTS: Params = \{[\s\S]*?\n\};/;
  if (!re.test(src)) throw new Error("No encontré el bloque DEFAULTS en modelCore.ts — ¿cambió el formato?");
  writeFileSync(MODEL_CORE, src.replace(re, renderDefaults(next)), "utf8");
}

async function main() {
  const write = process.argv.includes("--write");
  // Por defecto se respeta el peso de H2H (decisión editorial por las rivalidades).
  // Con --include-h2h se deja que el optimizador también lo mueva.
  const pinned = process.argv.includes("--include-h2h")
    ? new Set<keyof Params>()
    : new Set<keyof Params>(["h2hWeight"]);
  const all = await assembleMatchDataset();
  const years = [...new Set(all.map((m) => m.year))].sort();
  console.log(`dataset: ${all.length} partidos — años ${years.join(", ")}`);
  if (pinned.size) console.log(`fijos (no se optimizan): ${[...pinned].join(", ")}  ·  liberá con --include-h2h`);

  const cur = evaluate(all, DEFAULTS);
  console.log(`\nactuales:    logloss ${cur.logloss.toFixed(4)} · brier ${cur.brier.toFixed(4)} · acc ${(cur.acc * 100).toFixed(1)}% · n=${cur.n}`);

  console.log("\ncalibrando (descenso de coordenadas sobre log-loss)…");
  const best = calibrate(all, pinned);
  const nu = evaluate(all, best);
  console.log(`calibrados:  logloss ${nu.logloss.toFixed(4)} · brier ${nu.brier.toFixed(4)} · acc ${(nu.acc * 100).toFixed(1)}% · n=${nu.n}`);

  const changed = (Object.keys(DEFAULTS) as (keyof Params)[]).filter((k) => best[k] !== DEFAULTS[k]);
  const improvement = cur.logloss - nu.logloss;

  console.log("\nPESOS:");
  for (const k of Object.keys(DEFAULTS) as (keyof Params)[]) {
    const diff = best[k] !== DEFAULTS[k];
    console.log(`  ${k.padEnd(18)} ${String(DEFAULTS[k]).padStart(6)}  →  ${String(best[k]).padStart(6)}${diff ? "   *" : ""}`);
  }
  console.log(`\nmejora en log-loss: ${improvement >= 0 ? "-" : "+"}${Math.abs(improvement).toFixed(4)} (umbral ${MIN_IMPROVEMENT})`);

  if (changed.length === 0) {
    console.log("\n✓ Los pesos actuales ya son óptimos para el grid. No hay nada que cambiar.");
    process.exit(0);
  }
  if (improvement < MIN_IMPROVEMENT) {
    console.log(`\n✓ Hay pesos ligeramente distintos pero la mejora (${improvement.toFixed(4)}) no supera el umbral (${MIN_IMPROVEMENT}).`);
    console.log("  No conviene cambiar: probablemente sea ruido de pocas fechas nuevas.");
    console.log("  Si aun así querés forzarlo, editá DEFAULTS a mano en services/modelCore.ts.");
    process.exit(0);
  }

  if (!write) {
    console.log(`\n► Mejora significativa (${improvement.toFixed(4)}). Para aplicarla:`);
    console.log("    npm run recalibrate -- --write");
    console.log("  (dry-run: no toqué ningún archivo)");
    process.exit(0);
  }

  writeDefaults(best);
  console.log("\n✔ Escribí los pesos nuevos en services/modelCore.ts");
  console.log("  Revisá el diff y commiteá para dejar traza:");
  console.log("    git diff api/src/services/modelCore.ts");
  console.log(`    git commit -am \"tune(modelo): recalibración (logloss ${cur.logloss.toFixed(4)} → ${nu.logloss.toFixed(4)})\"`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
