/**
 * Barrido por PARES de equipos para juntar todos los resúmenes en video.
 *
 * El buscador de YouTube devuelve ~20 resultados y no es determinista, así que
 * las tres consultas generales del servicio dejan partidos afuera. Acá se
 * consulta par por par (45 combinaciones), que es mucho más exhaustivo, y todo
 * se ACUMULA sobre lo que ya había.
 *
 * Se corre a mano cada tanto; no hace falta que viva en el ciclo:
 *   npx tsx --env-file=.env src/scripts/backfillHighlights.ts
 */
import { buscar, acumular, fetchHighlights, highlightForMatch } from "../services/youtubeHighlights";
import { fetchAllMatchesMeta, LEVERADE_TEAMS } from "../lib/leverade";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const equipos = [...new Set(Object.values(LEVERADE_TEAMS))].sort();
  const pares: [string, string][] = [];
  for (let i = 0; i < equipos.length; i++) {
    for (let j = i + 1; j < equipos.length; j++) pares.push([equipos[i], equipos[j]]);
  }
  console.log(`consultando ${pares.length} pares…\n`);

  let total = 0;
  for (const [a, b] of pares) {
    try {
      const hits = await buscar(`${a} vs ${b} Top 10 Arusa resumen`);
      const nuevos = await acumular(hits);
      total += nuevos;
      if (nuevos > 0) console.log(`  ${a} vs ${b}: +${nuevos}`);
    } catch {
      console.log(`  ${a} vs ${b}: falló`);
    }
    await espera(700); // sin apuro, para no golpear a YouTube
  }

  const todos = await fetchHighlights();
  const meta = await fetchAllMatchesMeta();
  const prim = meta.filter((m) => m.division === "PRIMERA" && m.finished);
  let con = 0;
  for (const m of prim) if (await highlightForMatch(m.homeTeam, m.awayTeam, m.round)) con += 1;

  console.log(`\nvideos nuevos: ${total}  ·  acumulado: ${todos.length}`);
  console.log(`cobertura Primera: ${con}/${prim.length}`);
  process.exit(0);
})();
