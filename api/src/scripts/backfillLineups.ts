/**
 * Persiste la nómina de todos los partidos ya jugados, en las tres divisiones.
 *
 * Los partidos jugados son inmutables, así que una vez guardada la nómina queda
 * para siempre y /lineups la sirve sin volver a consultar Leverade.
 *
 *   npx tsx --env-file=.env src/scripts/backfillLineups.ts
 */
import { fetchAllMatchesMeta, DIVISION_TO_GROUP, type DivisionKey } from "../lib/leverade";
import { backfillLineups } from "../services/leveradeLineups";

(async () => {
  const meta = await fetchAllMatchesMeta();
  const divisions: DivisionKey[] = ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"];

  for (const d of divisions) {
    const jugados = meta.filter((m) => m.division === d && m.finished && !m.postponed && !m.canceled);
    const r = await backfillLineups(
      DIVISION_TO_GROUP[d],
      meta.filter((m) => m.division === d)
        .map((m) => ({ matchId: m.matchId, homeTeam: m.homeTeam, awayTeam: m.awayTeam, finished: m.finished })),
    );
    const conNomina = r.yaEstaban + r.guardados;
    const pct = r.total ? Math.round((conNomina / r.total) * 100) : 0;
    console.log(
      `${d.padEnd(15)} partidos ${String(r.total).padStart(3)} (jugados ${jugados.length})  ` +
      `guardadas ${String(r.guardados).padStart(3)}  ya estaban ${String(r.yaEstaban).padStart(3)}  ` +
      `sin nómina ${String(r.sinNomina).padStart(3)}  → cobertura ${pct}%`,
    );
  }
  process.exit(0);
})();
