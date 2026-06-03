import { FastifyInstance } from "fastify";
import { db } from "../db";
import { playerStats, players, teams, clubs } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { computeLivePlayerStats } from "../services/computePlayerStats";
import type { DivisionKey } from "../services/computeStandings";
import { fetchPlayerStats, resolveDivision } from "../lib/leverade";

const DIVISION_KEYS: DivisionKey[] = ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"];

export async function statsRoutes(app: FastifyInstance) {
  // GET /api/v1/stats/players?division=PRIMERA — full per-player season stats
  // scraped from arusa (all 3 grades), persisted through outages. Feeds the
  // estadísticas leaderboards and club player tables.
  app.get("/stats/players", async (req, reply) => {
    const division = resolveDivision((req.query as Record<string, string>)?.division);
    const players = await fetchPlayerStats(division);
    if (!players) return reply.status(503).send({ error: "Player stats unavailable" });
    reply.header("Cache-Control", "public, max-age=60");
    return { division, players };
  });

  // GET /api/v1/stats/live?division=PRIMERA — per-player stat lines aggregated
  // from live_events (incl. finished matches). The web stats page merges these
  // onto its static baseline by name; unmatched scorers appear as live rows.
  app.get("/stats/live", async (req) => {
    const raw = String((req.query as Record<string, string>)?.division ?? "PRIMERA").toUpperCase();
    const division = (DIVISION_KEYS.includes(raw as DivisionKey) ? raw : "PRIMERA") as DivisionKey;
    const players = await computeLivePlayerStats(division);
    return { division, players };
  });

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
