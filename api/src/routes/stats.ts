import { FastifyInstance } from "fastify";
import { db } from "../db";
import { playerStats, players, teams, clubs } from "../db/schema";
import { eq, desc } from "drizzle-orm";

export async function statsRoutes(app: FastifyInstance) {
  app.get("/stats/top-scorers", async (req, reply) => {
    const { season = "2026", limit = "10" } = req.query as Record<string, string>;

    const rows = await db
      .select({
        tries: playerStats.tries,
        conversions: playerStats.conversions,
        penalties: playerStats.penalties,
        dropGoals: playerStats.dropGoals,
        totalPoints: playerStats.totalPoints,
        matchesPlayed: playerStats.matchesPlayed,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.position,
        clubName: clubs.name,
        clubShort: clubs.shortName,
        clubPrimaryColor: clubs.primaryColor,
      })
      .from(playerStats)
      .innerJoin(players, eq(playerStats.playerId, players.id))
      .innerJoin(teams, eq(playerStats.teamId, teams.id))
      .innerJoin(clubs, eq(teams.clubId, clubs.id))
      .where(eq(playerStats.seasonYear, parseInt(season)))
      .orderBy(desc(playerStats.totalPoints))
      .limit(parseInt(limit));

    return reply.send(rows);
  });

  app.get("/stats/top-try-scorers", async (req, reply) => {
    const { season = "2026", limit = "10" } = req.query as Record<string, string>;

    const rows = await db
      .select({
        tries: playerStats.tries,
        matchesPlayed: playerStats.matchesPlayed,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.position,
        clubName: clubs.name,
        clubShort: clubs.shortName,
        clubPrimaryColor: clubs.primaryColor,
      })
      .from(playerStats)
      .innerJoin(players, eq(playerStats.playerId, players.id))
      .innerJoin(teams, eq(playerStats.teamId, teams.id))
      .innerJoin(clubs, eq(teams.clubId, clubs.id))
      .where(eq(playerStats.seasonYear, parseInt(season)))
      .orderBy(desc(playerStats.tries))
      .limit(parseInt(limit));

    return reply.send(rows);
  });
}
