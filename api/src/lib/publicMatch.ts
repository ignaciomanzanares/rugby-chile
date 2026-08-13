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
    events,
  };
}
