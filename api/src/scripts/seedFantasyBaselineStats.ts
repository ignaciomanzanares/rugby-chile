/**
 * Siembra la línea de stats en el baseline del fantasy.
 *
 * El baseline guardaba solo puntos y partidos, así que del delta de una fecha se
 * sabía CUÁNTO sumó cada jugador pero no por qué. Esto completa la foto del
 * corte actual para que la próxima fecha puntuada ya traiga el desglose.
 *
 * Solo toca a los jugadores cuyo acumulado sigue igual que en el corte: si
 * cambió, el corte no es "ahora" y sembrar con lo de hoy mentiría.
 *
 *   npx tsx --env-file=.env src/scripts/seedFantasyBaselineStats.ts
 */
import { db } from "../db";
import { fantasyStatBaseline } from "../db/schema";
import { and, eq, sql } from "drizzle-orm";
import { fetchPlayerStats, type DivisionKey, type PlayerStatRow } from "../lib/leverade";

const DIVS: { fantasy: string; key: DivisionKey }[] = [
  { fantasy: "primera", key: "PRIMERA" },
  { fantasy: "intermedia", key: "INTERMEDIA" },
  { fantasy: "pre-intermedia", key: "PRE_INTERMEDIA" },
];

function seasonPoints(p: PlayerStatRow): number {
  return p.matches * 2 + (p.tries + p.penaltyTries) * 10 + p.conversions * 2 +
    p.penalties * 3 + p.drops * 4 + p.mvp * 8 - p.yellowCards * 1 - p.redCards * 4;
}

(async () => {
  await db.execute(sql`ALTER TABLE fantasy_stat_baseline ADD COLUMN IF NOT EXISTS stats json`);
  for (const { fantasy, key } of DIVS) {
    const stats = await fetchPlayerStats(key);
    const rows = await db.select().from(fantasyStatBaseline).where(eq(fantasyStatBaseline.division, fantasy));
    const base = new Map(rows.map((r) => [r.arusaId, r]));
    let sembrados = 0, distintos = 0;
    for (const p of stats ?? []) {
      const b = base.get(p.id);
      if (!b || b.stats) continue;
      if (b.points !== seasonPoints(p) || b.matches !== p.matches) { distintos++; continue; }
      await db.update(fantasyStatBaseline)
        .set({ stats: { matches: p.matches, tries: p.tries, penaltyTries: p.penaltyTries, conversions: p.conversions, penalties: p.penalties, drops: p.drops, mvp: p.mvp, yellowCards: p.yellowCards, redCards: p.redCards } })
        .where(and(eq(fantasyStatBaseline.division, fantasy), eq(fantasyStatBaseline.arusaId, p.id)));
      sembrados++;
    }
    console.log(`${fantasy}: ${sembrados} sembrados, ${distintos} con acumulado distinto al corte (se dejan sin desglose)`);
  }
  process.exit(0);
})();
