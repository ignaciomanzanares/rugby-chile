// Congela la alineación de las fechas ya puntuadas.
//
// Una fecha SIN alineación guardada se puntúa con el plantel de hoy (la
// alineación por defecto: los primeros 15 del plantel). Eso hacía que tocar el
// equipo para la fecha próxima moviera los puntos de las anteriores: el usuario
// editaba pensando en la 18 y le cambiaban los puntos de la 17.
//
// Guardando una alineación por cada fecha ya puntuada, el pasado queda fijo.
// Se llama ANTES de tocar el plantel (guardar equipo, transferencias) y después
// de puntuar una fecha, que son los dos momentos en que el historial podría
// moverse.
import { db } from "../db";
import {
  fantasySquads,
  fantasySquadPlayers,
  fantasyLineups,
  fantasyGameweekScores,
} from "../db/schema";
import { and, eq, gt, inArray } from "drizzle-orm";
import { FANTASY_RULES } from "./fantasyEngine";

export async function freezeScoredRounds(division: string, soloSquads?: string[]): Promise<number> {
  const squads = await db
    .select({ id: fantasySquads.id, captainId: fantasySquads.captainId, viceCaptainId: fantasySquads.viceCaptainId })
    .from(fantasySquads)
    .where(
      soloSquads?.length
        ? and(eq(fantasySquads.division, division), inArray(fantasySquads.id, soloSquads))
        : eq(fantasySquads.division, division),
    );
  if (squads.length === 0) return 0;

  // round 0 = agregado de temporada, no es una fecha jugable.
  const scored = await db
    .selectDistinct({ round: fantasyGameweekScores.round })
    .from(fantasyGameweekScores)
    .where(and(eq(fantasyGameweekScores.division, division), gt(fantasyGameweekScores.round, 0)));
  if (scored.length === 0) return 0;

  const ids = squads.map((s) => s.id);
  // Sin ORDER BY a propósito: este es el mismo orden con el que se armó la
  // alineación por defecto, así que congelar reproduce exactamente lo que la
  // tabla venía mostrando.
  const players = await db
    .select({ squadId: fantasySquadPlayers.squadId, arusaId: fantasySquadPlayers.arusaId })
    .from(fantasySquadPlayers)
    .where(inArray(fantasySquadPlayers.squadId, ids));
  const yaHay = new Set(
    (await db.select({ squadId: fantasyLineups.squadId, round: fantasyLineups.round })
      .from(fantasyLineups).where(inArray(fantasyLineups.squadId, ids)))
      .map((l) => `${l.squadId}:${l.round}`),
  );

  const roster = new Map<string, string[]>();
  for (const p of players) {
    const arr = roster.get(p.squadId) ?? [];
    arr.push(p.arusaId);
    roster.set(p.squadId, arr);
  }

  const nuevas = [];
  for (const s of squads) {
    const rosterIds = roster.get(s.id) ?? [];
    if (rosterIds.length === 0) continue;
    for (const { round } of scored) {
      if (yaHay.has(`${s.id}:${round}`)) continue;
      nuevas.push({
        squadId: s.id,
        round,
        starters: rosterIds.slice(0, FANTASY_RULES.STARTERS),
        bench: rosterIds.slice(FANTASY_RULES.STARTERS, FANTASY_RULES.SQUAD_SIZE),
        captainId: s.captainId,
        viceCaptainId: s.viceCaptainId,
      });
    }
  }
  if (nuevas.length) await db.insert(fantasyLineups).values(nuevas);
  return nuevas.length;
}
