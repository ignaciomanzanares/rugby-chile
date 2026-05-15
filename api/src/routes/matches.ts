import { FastifyInstance } from "fastify";
import { db } from "../db";
import { matches, teams, clubs } from "../db/schema";
import { eq, desc, and } from "drizzle-orm";

const home = clubs;
const away = { ...clubs, id: clubs.id };

export async function matchesRoutes(app: FastifyInstance) {
  // All matches (filterable by division, round, status)
  app.get("/matches", async (req, reply) => {
    const { division, round, status } = req.query as Record<string, string>;

    const homeTeams = db
      .select({
        id: teams.id,
        clubId: teams.clubId,
        division: teams.division,
      })
      .from(teams)
      .as("homeTeams");

    const awayTeams = db
      .select({
        id: teams.id,
        clubId: teams.clubId,
        division: teams.division,
      })
      .from(teams)
      .as("awayTeams");

    const homeClubs = db
      .select({ id: clubs.id, name: clubs.name, shortName: clubs.shortName, primaryColor: clubs.primaryColor, secondaryColor: clubs.secondaryColor })
      .from(clubs)
      .as("homeClubs");

    const awayClubs = db
      .select({ id: clubs.id, name: clubs.name, shortName: clubs.shortName, primaryColor: clubs.primaryColor, secondaryColor: clubs.secondaryColor })
      .from(clubs)
      .as("awayClubs");

    // Raw query for clarity
    const rows = await db.query.matches.findMany({
      where: and(
        division ? eq(matches.division, division as "PRIMERA" | "INTERMEDIA" | "PRE_INTERMEDIA") : undefined,
        round ? eq(matches.round, parseInt(round)) : undefined,
        status ? eq(matches.status, status as "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED") : undefined,
      ),
      with: {
        homeTeam: { with: { club: true } },
        awayTeam: { with: { club: true } },
      },
      orderBy: [desc(matches.scheduledDate)],
    });

    return reply.send(rows);
  });

  // Live matches
  app.get("/matches/live", async (_req, reply) => {
    const rows = await db.query.matches.findMany({
      where: eq(matches.status, "LIVE"),
      with: {
        homeTeam: { with: { club: true } },
        awayTeam: { with: { club: true } },
        matchEvents: { with: { player: true } },
      },
      orderBy: [desc(matches.scheduledDate)],
    });
    return reply.send(rows);
  });

  // Single match
  app.get("/matches/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, id),
      with: {
        homeTeam: { with: { club: true } },
        awayTeam: { with: { club: true } },
        matchEvents: { with: { player: true, team: true } },
      },
    });
    if (!match) return reply.status(404).send({ error: "Match not found" });
    return reply.send(match);
  });
}
