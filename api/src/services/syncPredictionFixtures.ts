import { db } from "../db";
import { predictionFixtures, predictions } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { fetchAllResults } from "../routes/leveradeResults";
import { calcPoints } from "../routes/predictions";

const SEASON = 2026;

// Keep the predictions game in lockstep with the live Leverade feed instead of
// a hand-maintained fixture list. Pulls every PRIMERA fixture (all rounds, with
// real kickoff dates and results) and upserts it into prediction_fixtures, then
// scores any pending predictions for matches that have just finished.
//
// status: UPCOMING (accepting predictions) → LOCKED (kickoff passed, no final
// score yet) → COMPLETED (final score in). Mirrors the rest of the site, so the
// predict page is always current without manual seeding.
export async function syncPredictionFixtures(): Promise<{ upserts: number; scored: number }> {
  let all: Awaited<ReturnType<typeof fetchAllResults>>;
  try {
    all = await fetchAllResults();
  } catch (err) {
    console.error("[syncPredictionFixtures] feed unavailable:", err);
    return { upserts: 0, scored: 0 };
  }

  const primera = Object.values(all).filter((m) => m.division === "PRIMERA");
  const now = Date.now();
  let upserts = 0;
  let scored = 0;

  for (const m of primera) {
    const hasScore = m.homeScore != null && m.awayScore != null;
    const kickoff = m.datetime ? new Date(m.datetime.replace(" ", "T")).getTime() : NaN;
    const started = Number.isFinite(kickoff) && kickoff <= now;

    const status = m.finished && hasScore ? "COMPLETED" : started ? "LOCKED" : "UPCOMING";
    const homeScoreActual = m.finished && hasScore ? m.homeScore! : null;
    const awayScoreActual = m.finished && hasScore ? m.awayScore! : null;
    const matchDate = m.datetime ? new Date(m.datetime.replace(" ", "T")) : null;

    const [existing] = await db
      .select()
      .from(predictionFixtures)
      .where(and(
        eq(predictionFixtures.season, SEASON),
        eq(predictionFixtures.round, m.round),
        eq(predictionFixtures.homeTeam, m.homeTeam),
        eq(predictionFixtures.awayTeam, m.awayTeam),
      ));

    if (!existing) {
      const [row] = await db.insert(predictionFixtures).values({
        season: SEASON, round: m.round, homeTeam: m.homeTeam, awayTeam: m.awayTeam,
        matchDate, homeScoreActual, awayScoreActual, status,
      }).returning();
      upserts++;
      if (status === "COMPLETED") scored += await scoreFixture(row.id, homeScoreActual!, awayScoreActual!);
      continue;
    }

    // Only write when something actually changed, so we don't churn the table.
    const changed =
      existing.status !== status ||
      existing.homeScoreActual !== homeScoreActual ||
      existing.awayScoreActual !== awayScoreActual ||
      existing.matchDate?.getTime() !== matchDate?.getTime();

    if (changed) {
      await db.update(predictionFixtures)
        .set({ matchDate, homeScoreActual, awayScoreActual, status })
        .where(eq(predictionFixtures.id, existing.id));
      upserts++;
    }

    // Score predictions when a fixture first reaches a final score.
    const newlyComplete = status === "COMPLETED" && existing.status !== "COMPLETED";
    if (newlyComplete) scored += await scoreFixture(existing.id, homeScoreActual!, awayScoreActual!);
  }

  if (upserts || scored) console.log(`[syncPredictionFixtures] upserts=${upserts} scored=${scored}`);
  return { upserts, scored };
}

// Compute pointsEarned for every prediction on a now-final fixture.
async function scoreFixture(fixtureId: string, actualHome: number, actualAway: number): Promise<number> {
  const preds = await db.select().from(predictions).where(eq(predictions.fixtureId, fixtureId));
  let n = 0;
  for (const p of preds) {
    const pts = calcPoints(p.homeScore, p.awayScore, actualHome, actualAway);
    await db.update(predictions).set({ pointsEarned: pts }).where(eq(predictions.id, p.id));
    n++;
  }
  return n;
}
