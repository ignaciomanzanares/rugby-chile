/**
 * Compara las posiciones del fantasy contra las planillas oficiales de Leverade.
 *
 * `web/src/data/player-positions.ts` se genera hoy desde observaciones
 * transcritas A MANO de las imágenes de formación que publican los clubes
 * (buildPlayerPositions.ts), o sea cubre solo las fechas que alguien alcanzó a
 * transcribir. Leverade tiene la planilla de TODAS las fechas, así que la moda
 * de números por jugador sale de muchísima más evidencia.
 *
 * Esto SOLO REPORTA. No escribe nada: cambiar la posición de un jugador en
 * mitad de la temporada puede invalidar los equipos de fantasy ya armados, así
 * que la decisión de aplicarlo es humana y fuera de fecha en juego.
 *
 *   npx tsx --env-file=.env src/scripts/comparePositionsWithLeverade.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildPlayerCensus } from "../services/leveradePlayers";
import { fetchPlayerStats, DIVISION_TO_GROUP, type DivisionKey } from "../lib/leverade";

const POSITIONS_FILE = resolve(__dirname, "../../../web/src/data/player-positions.ts");

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

function currentPositions(): Map<string, string> {
  const src = readFileSync(POSITIONS_FILE, "utf8");
  const out = new Map<string, string>();
  for (const m of src.matchAll(/"(\d+)":\s*\{\s*primary:\s*"([A-Z_]+)"/g)) out.set(m[1], m[2]);
  return out;
}

(async () => {
  const division: DivisionKey = "PRIMERA";
  const [census, stats, current] = [
    await buildPlayerCensus(DIVISION_TO_GROUP[division]),
    (await fetchPlayerStats(division)) ?? [],
    currentPositions(),
  ];
  const byName = new Map(stats.map((s) => [norm(s.name), s]));

  let same = 0;
  const diffs: string[] = [];
  const missing: string[] = [];
  for (const c of census) {
    const s = byName.get(norm(c.name));
    if (!s) continue;                       // no está en el pool del fantasy
    const now = current.get(String(s.id));
    if (!now) { missing.push(`${c.name} (${c.team}) → ${c.position}`); continue; }
    if (now === c.position) same += 1;
    else diffs.push(
      `${c.name.slice(0, 30).padEnd(30)} ${c.team ?? ""}  ${now} → ${c.position}` +
      `   [${JSON.stringify(c.numbers)}]`,
    );
  }

  console.log(`censo Leverade: ${census.length} | en el pool de arusa: ${byName.size} | con posición hoy: ${current.size}\n`);
  console.log(`coinciden:            ${same}`);
  console.log(`difieren:             ${diffs.length}`);
  console.log(`sin posición todavía: ${missing.length}\n`);
  if (diffs.length) { console.log("DIFERENCIAS (actual → según Leverade, con sus números reales):"); for (const d of diffs.slice(0, 40)) console.log("  " + d); }
  if (missing.length) { console.log("\nSIN POSICIÓN HOY (Leverade sí la tiene):"); for (const m of missing.slice(0, 20)) console.log("  " + m); }
  process.exit(0);
})();
