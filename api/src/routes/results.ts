import { FastifyInstance } from "fastify";
import { db } from "../db";
import { predictionFixtures, liveMatches } from "../db/schema";
import { eq } from "drizzle-orm";
import { liveDivisionKey } from "../services/computeStandings";

export interface FixtureResult {
  finished: boolean;
  homeScore: number;
  awayScore: number;
  division: string;
  round?: number;
}

/**
 * Reliable, offline final-score source for the schedule page.
 *
 * Keyed by `${DIVISION}|${home}|${away}` (the same pair plays in all three
 * divisions). Sourced from prediction_fixtures (historical results entered into
 * the DB — accurate and not dependent on the flaky arusa/Leverade scrape) and
 * FINISHED live_matches (app/poller-scored). Live matches win when both exist,
 * since they're the most up-to-date. Mirrors the leverade/results shape so the
 * schedule page can use this as its primary and fall back to Leverade.
 */
export async function resultsRoutes(app: FastifyInstance) {
  app.get("/results", async () => {
    const out: Record<string, FixtureResult> = {};

    const fixtures = await db.select().from(predictionFixtures);
    for (const f of fixtures) {
      if (f.status !== "COMPLETED" || f.homeScoreActual == null || f.awayScoreActual == null) continue;
      const division = liveDivisionKey(f.division);
      if (!division) continue;
      out[`${division}|${f.homeTeam}|${f.awayTeam}`] = {
        finished: true,
        homeScore: f.homeScoreActual,
        awayScore: f.awayScoreActual,
        division,
        round: f.round,
      };
    }

    const finishedLive = await db
      .select()
      .from(liveMatches)
      .where(eq(liveMatches.status, "FINISHED"));
    for (const m of finishedLive) {
      const division = liveDivisionKey(m.division);
      if (!division) continue;
      out[`${division}|${m.homeTeam}|${m.awayTeam}`] = {
        finished: true,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        division,
      };
    }

    return out;
  });
}
