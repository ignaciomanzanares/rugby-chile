import { db } from "../db";
import { predictionFixtures } from "../db/schema";
import { and, eq } from "drizzle-orm";

const FIXTURES_2026 = [
  // Fecha 1 – April 11-12
  { round: 1, homeTeam: "Old Boys",      awayTeam: "Stade Francais", matchDate: "2026-04-11T14:30:00", venue: "Old Grangonian Club",          homeScoreActual: 40, awayScoreActual: 29, status: "COMPLETED" },
  { round: 1, homeTeam: "Old Macks",     awayTeam: "Sporting RC",    matchDate: "2026-04-11T15:30:00", venue: "The Mackay School",            homeScoreActual: 26, awayScoreActual: 9,  status: "COMPLETED" },
  { round: 1, homeTeam: "Old Reds",      awayTeam: "UC",             matchDate: "2026-04-11T15:30:00", venue: "Cancha Federación",            homeScoreActual: 32, awayScoreActual: 27, status: "COMPLETED" },
  { round: 1, homeTeam: "PWCC",          awayTeam: "Old Johns",      matchDate: "2026-04-12T15:30:00", venue: "Prince of Wales Country Club", homeScoreActual: 26, awayScoreActual: 24, status: "COMPLETED" },
  { round: 1, homeTeam: "COBS",          awayTeam: "DOBS",           matchDate: "2026-04-12T15:30:00", venue: "Estadio COBS",                 homeScoreActual: 36, awayScoreActual: 29, status: "COMPLETED" },
  // Fecha 2 – April 18-19
  { round: 2, homeTeam: "Old Johns",     awayTeam: "UC",             matchDate: "2026-04-18T14:30:00", venue: "Colegio Saint John's",         homeScoreActual: 36, awayScoreActual: 21, status: "COMPLETED" },
  { round: 2, homeTeam: "Old Macks",     awayTeam: "COBS",           matchDate: "2026-04-18T15:30:00", venue: "The Mackay School",            homeScoreActual: 13, awayScoreActual: 16, status: "COMPLETED" },
  { round: 2, homeTeam: "DOBS",          awayTeam: "Old Boys",       matchDate: "2026-04-19T15:30:00", venue: "Dunalastair School",           homeScoreActual: 17, awayScoreActual: 52, status: "COMPLETED" },
  { round: 2, homeTeam: "Sporting RC",   awayTeam: "Old Reds",       matchDate: "2026-04-19T15:30:00", venue: "Sporting Club",                homeScoreActual: 25, awayScoreActual: 19, status: "COMPLETED" },
  { round: 2, homeTeam: "PWCC",          awayTeam: "Stade Francais", matchDate: "2026-04-19T17:00:00", venue: "Prince of Wales Country Club", homeScoreActual: 34, awayScoreActual: 34, status: "COMPLETED" },
  // Fecha 3 – April 25-26
  { round: 3, homeTeam: "Stade Francais",awayTeam: "Old Macks",      matchDate: "2026-04-25T14:30:00", venue: "Club Stade Français",          homeScoreActual: 18, awayScoreActual: 23, status: "COMPLETED" },
  { round: 3, homeTeam: "Sporting RC",   awayTeam: "DOBS",           matchDate: "2026-04-25T15:30:00", venue: "Sporting Club",                homeScoreActual: 14, awayScoreActual: 29, status: "COMPLETED" },
  { round: 3, homeTeam: "Old Boys",      awayTeam: "Old Reds",       matchDate: "2026-04-26T15:30:00", venue: "Old Grangonian Club",          homeScoreActual: 28, awayScoreActual: 12, status: "COMPLETED" },
  { round: 3, homeTeam: "PWCC",          awayTeam: "UC",             matchDate: "2026-04-26T15:30:00", venue: "Prince of Wales Country Club", homeScoreActual: 26, awayScoreActual: 22, status: "COMPLETED" },
  { round: 3, homeTeam: "COBS",          awayTeam: "Old Johns",      matchDate: "2026-04-26T15:30:00", venue: "Estadio COBS",                 homeScoreActual: 52, awayScoreActual: 12, status: "COMPLETED" },
  // Fecha 4 – May 8-10
  { round: 4, homeTeam: "Old Boys",      awayTeam: "COBS",           matchDate: "2026-05-08T19:00:00", venue: "Old Grangonian Club",          homeScoreActual: 20, awayScoreActual: 22, status: "COMPLETED" },
  { round: 4, homeTeam: "Sporting RC",   awayTeam: "Old Johns",      matchDate: "2026-05-09T15:30:00", venue: "Sporting Club",                homeScoreActual: 25, awayScoreActual: 23, status: "COMPLETED" },
  { round: 4, homeTeam: "DOBS",          awayTeam: "UC",             matchDate: "2026-05-10T15:30:00", venue: "Dunalastair School",           homeScoreActual: 28, awayScoreActual: 45, status: "COMPLETED" },
  { round: 4, homeTeam: "Old Macks",     awayTeam: "PWCC",           matchDate: "2026-05-10T17:00:00", venue: "The Mackay School",            homeScoreActual: 26, awayScoreActual: 29, status: "COMPLETED" },
  { round: 4, homeTeam: "Stade Francais",awayTeam: "Old Reds",       matchDate: "2026-05-10T17:00:00", venue: "Club Stade Français",          homeScoreActual: 24, awayScoreActual: 16, status: "COMPLETED" },
  // Fecha 5 – May 16-17  (UPCOMING – accepting predictions)
  { round: 5, homeTeam: "Old Johns",     awayTeam: "Stade Francais", matchDate: "2026-05-17T14:30:00", venue: "Colegio Saint John's",         status: "UPCOMING" },
  { round: 5, homeTeam: "PWCC",          awayTeam: "COBS",           matchDate: "2026-05-17T15:30:00", venue: "Prince of Wales Country Club", status: "UPCOMING" },
  { round: 5, homeTeam: "UC",            awayTeam: "Old Macks",      matchDate: "2026-05-17T15:30:00", venue: "San Carlos de Apoquindo",      status: "UPCOMING" },
  { round: 5, homeTeam: "Old Boys",      awayTeam: "Sporting RC",    matchDate: "2026-05-17T17:00:00", venue: "Old Grangonian Club",          status: "UPCOMING" },
  { round: 5, homeTeam: "Old Reds",      awayTeam: "DOBS",           matchDate: "2026-05-18T15:30:00", venue: "Cancha Federación",            status: "UPCOMING" },
];

export async function seedFixtures() {
  let inserted = 0;
  for (const f of FIXTURES_2026) {
    const exists = await db
      .select({ id: predictionFixtures.id })
      .from(predictionFixtures)
      .where(and(
        eq(predictionFixtures.season, 2026),
        eq(predictionFixtures.round, f.round),
        eq(predictionFixtures.homeTeam, f.homeTeam),
        eq(predictionFixtures.awayTeam, f.awayTeam),
      ));
    if (exists.length > 0) continue;

    await db.insert(predictionFixtures).values({
      season: 2026,
      round: f.round,
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      matchDate: f.matchDate ? new Date(f.matchDate) : undefined,
      venue: f.venue,
      homeScoreActual: (f as any).homeScoreActual ?? null,
      awayScoreActual: (f as any).awayScoreActual ?? null,
      status: f.status,
    });
    inserted++;
  }
  if (inserted > 0) console.log(`[seedFixtures] Inserted ${inserted} fixtures`);
}
