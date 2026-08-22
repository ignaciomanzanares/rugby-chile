import { db } from "../db";
import { fantasyGameweekScores, fantasySquads, fantasySquadPlayers } from "../db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { fetchPlayerStats, type DivisionKey, type PlayerStatRow } from "../lib/leverade";
import { calcSquadTotalPoints } from "../lib/fantasyScoring";

/**
 * Auto-scorer del fantasy: computa los puntos de cada jugador desde sus TOTALES
 * de temporada (stats de arusa) y actualiza los totales de todos los squads.
 *
 * El squad es de temporada completa (un equipo por usuario/división que puntúa
 * toda la temporada), así que guardamos UNA fila por jugador con su acumulado.
 * Antes el scoring era 100% manual (admin cargaba stats por fecha) y nunca se
 * hizo → todos los equipos quedaban en 0. Esto lo llena solo con los datos que
 * ya scrapeamos, y se refresca al correr (incluye lo que sumen los partidos de
 * hoy a medida que arusa actualiza).
 */

// Ronda sentinela para el acumulado de temporada. El leaderboard/squad suman
// pointsEarned de TODAS las filas del jugador, así que una sola fila alcanza.
const SEASON_ROUND = 0;

const FANTASY_DIVS: { fantasy: string; key: DivisionKey }[] = [
  { fantasy: "primera", key: "PRIMERA" },
  { fantasy: "intermedia", key: "INTERMEDIA" },
  { fantasy: "pre-intermedia", key: "PRE_INTERMEDIA" },
];

/** Puntos fantasy de un jugador desde sus totales de temporada. */
function seasonPoints(p: PlayerStatRow): number {
  return (
    p.matches * 1 +                         // +1 por partido jugado (aparición)
    (p.tries + p.penaltyTries) * 4 +
    p.conversions * 1 +
    p.penalties * 2 +
    p.drops * 3 +
    p.mvp * 3 -
    p.yellowCards * 1 -
    p.redCards * 3
  );
  // (arusa no trackea asistencias → 0)
}

export async function autoScoreFantasy(): Promise<{ divisions: number; players: number; squads: number }> {
  let players = 0;
  let divisions = 0;

  for (const { fantasy, key } of FANTASY_DIVS) {
    const stats = await fetchPlayerStats(key);
    if (!stats || stats.length === 0) continue;
    divisions++;

    for (const p of stats) {
      const row = {
        season: 2026,
        division: fantasy,
        round: SEASON_ROUND,
        arusaId: p.id,
        clubSlug: p.teamSlug,
        playerName: p.name,
        tries: p.tries + p.penaltyTries,
        assists: 0,
        conversions: p.conversions,
        penalties: p.penalties,
        drops: p.drops,
        yellowCards: p.yellowCards,
        redCards: p.redCards,
        isMvp: p.mvp > 0,
        played: p.matches > 0,
        pointsEarned: seasonPoints(p),
      };
      const [existing] = await db
        .select({ id: fantasyGameweekScores.id })
        .from(fantasyGameweekScores)
        .where(and(
          eq(fantasyGameweekScores.round, SEASON_ROUND),
          eq(fantasyGameweekScores.division, fantasy),
          eq(fantasyGameweekScores.arusaId, p.id),
        ));
      if (existing) {
        await db.update(fantasyGameweekScores).set(row).where(eq(fantasyGameweekScores.id, existing.id));
      } else {
        await db.insert(fantasyGameweekScores).values(row);
      }
      players++;
    }
  }

  const squads = await recalcSquadTotals();
  return { divisions, players, squads };
}

/** Recalcula fantasy_squads.totalPoints para todos los squads (con capitán). */
async function recalcSquadTotals(): Promise<number> {
  const squads = await db.select().from(fantasySquads);
  if (squads.length === 0) return 0;

  const squadPlayers = await db.select().from(fantasySquadPlayers)
    .where(inArray(fantasySquadPlayers.squadId, squads.map((s) => s.id)));
  const bySquad = new Map<string, typeof squadPlayers>();
  for (const p of squadPlayers) {
    const arr = bySquad.get(p.squadId) ?? [];
    arr.push(p);
    bySquad.set(p.squadId, arr);
  }

  const allArusaIds = [...new Set(squadPlayers.map((p) => p.arusaId))];
  const scoresByDiv = new Map<string, Array<{ arusaId: string; pointsEarned: number }>>();
  if (allArusaIds.length > 0) {
    const rows = await db
      .select({ division: fantasyGameweekScores.division, arusaId: fantasyGameweekScores.arusaId, pointsEarned: fantasyGameweekScores.pointsEarned })
      .from(fantasyGameweekScores)
      .where(inArray(fantasyGameweekScores.arusaId, allArusaIds));
    for (const r of rows) {
      const arr = scoresByDiv.get(r.division) ?? [];
      arr.push({ arusaId: r.arusaId, pointsEarned: r.pointsEarned });
      scoresByDiv.set(r.division, arr);
    }
  }

  let updated = 0;
  for (const squad of squads) {
    const sp = bySquad.get(squad.id) ?? [];
    const scores = scoresByDiv.get(squad.division) ?? [];
    const totalPoints = calcSquadTotalPoints(sp, squad.captainId, squad.viceCaptainId, scores);
    await db.update(fantasySquads).set({ totalPoints, updatedAt: new Date() }).where(eq(fantasySquads.id, squad.id));
    updated++;
  }
  return updated;
}
