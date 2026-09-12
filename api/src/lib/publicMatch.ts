import type { InferSelectModel } from "drizzle-orm";
import type { liveMatches, liveEvents } from "../db/schema";

type MatchRow = InferSelectModel<typeof liveMatches>;
type EventRow = InferSelectModel<typeof liveEvents>;

/**
 * Forma pública de un partido en vivo: sólo los campos que el cliente usa.
 * Evita filtrar `scorerToken`/`scorerTokenExpiresAt` (¡token sensible!) y campos
 * internos (leveradeMatchId, createdAt/updatedAt) en el feed `/live` y en los
 * emits de Socket.IO. De paso achica el payload que se re-envía en cada poll.
 */
/**
 * Orden cronológico de la cronología.
 *
 * El minuto NO alcanza: cuando el planillero carga varias jugadas de una sola
 * vez, todas quedan con el mismo minuto derivado (el instante en que las vimos),
 * y como el id es un uuid aleatorio Postgres las devolvía en cualquier orden. Se
 * veía el 22-27 antes que el 5-0 del mismo partido.
 *
 * El desempate sale de los propios datos: el marcador TOTAL sólo puede subir,
 * así que ordenar por la suma reconstruye la secuencia real sin depender de cómo
 * se guardaron.
 */
function cronologico(events: EventRow[]): EventRow[] {
  const total = (e: EventRow) => (e.homeScore ?? 0) + (e.awayScore ?? 0);
  return [...events].sort(
    (a, b) =>
      a.minute - b.minute ||
      total(a) - total(b) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

export function publicMatch(m: MatchRow, events: EventRow[]) {
  return {
    id: m.id,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    division: m.division,
    venue: m.venue,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    homeTries: m.homeTries,
    awayTries: m.awayTries,
    minute: m.minute,
    status: m.status,
    events: cronologico(events),
  };
}
