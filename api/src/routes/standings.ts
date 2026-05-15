import { FastifyInstance } from "fastify";
import { db } from "../db";
import { standings, teams, clubs } from "../db/schema";
import { eq, asc } from "drizzle-orm";

export async function standingsRoutes(app: FastifyInstance) {
  app.get("/standings", async (req, reply) => {
    const { division = "PRIMERA", season = "2026" } = req.query as Record<string, string>;

    const rows = await db
      .select({
        position: standings.position,
        played: standings.played,
        won: standings.won,
        drawn: standings.drawn,
        lost: standings.lost,
        pointsFor: standings.pointsFor,
        pointsAgainst: standings.pointsAgainst,
        pointsDifference: standings.pointsDifference,
        triesFor: standings.triesFor,
        tryBonus: standings.tryBonusPoints,
        losingBonus: standings.losingBonusPoints,
        totalPoints: standings.totalPoints,
        clubName: clubs.name,
        clubShort: clubs.shortName,
        clubSlug: clubs.slug,
        clubPrimaryColor: clubs.primaryColor,
        clubSecondaryColor: clubs.secondaryColor,
      })
      .from(standings)
      .innerJoin(teams, eq(standings.teamId, teams.id))
      .innerJoin(clubs, eq(teams.clubId, clubs.id))
      .where(eq(standings.division, division as "PRIMERA" | "INTERMEDIA" | "PRE_INTERMEDIA"))
      .orderBy(asc(standings.position));

    return reply.send(rows);
  });
}
