import { db } from "../db";
import { matchLineups, predictionFixtures } from "../db/schema";
import { and, eq, asc } from "drizzle-orm";
import { getIgUserId, getRecentPosts } from "./instagramScraper";

// Correct club Instagram handles (verified — same as lineupCrawler).
const CLUB_INSTAGRAM: Record<string, string> = {
  COBS: "cobs_cogs", "Old Boys": "oldboysrugby", PWCC: "rugbypwcc",
  "Old Macks": "oldmackayansrfc", "Stade Francais": "rugbystadefrancais",
  "Sporting RC": "sportingrc", DOBS: "dunalastairclub", UC: "rugbyuc",
  "Old Johns": "oldjohnsrugby", "Old Reds": "oldreds.rugby",
};

// Clubs post their matchday squads ("nómina"/"team list") as an image carousel.
const NOMINA_RE = /n[oó]mina|team\s*list|teamlist|formaci[oó]n|formaciones|equipo definido|as[ií] disputaremos|los elegidos|primera xv|nómina oficial|presenta la n|los citados|planteles/i;

// Find a club's most recent nómina post (carousel of images) within `days`.
async function fetchClubNomina(handle: string, sinceTs: number) {
  const uid = await getIgUserId(handle);
  if (!uid) return null;
  const posts = await getRecentPosts(uid, 12);
  for (const p of posts) {
    if (p.timestamp < sinceTs) break;            // newest-first; stop once too old
    if (p.images.length >= 1 && NOMINA_RE.test(p.caption)) {
      return { images: p.images, permalink: p.permalink, caption: p.caption.slice(0, 200) };
    }
  }
  return null;
}

/**
 * Runs Fri/Sat: for the upcoming matchday's Primera fixtures, fetch each club's
 * latest nómina graphic and store the image URLs so the match-detail sheet can
 * show the formation for the match you're about to watch.
 */
export async function scrapeUpcomingLineups(): Promise<{ matches: number; filled: number }> {
  // Upcoming round = the lowest round that still has fixtures accepting predictions.
  const upcoming = await db.select().from(predictionFixtures)
    .where(and(eq(predictionFixtures.season, 2026), eq(predictionFixtures.status, "UPCOMING")))
    .orderBy(asc(predictionFixtures.round));
  if (!upcoming.length) { console.log("[upcomingLineups] no upcoming fixtures"); return { matches: 0, filled: 0 }; }
  const round = upcoming[0].round;
  const fixtures = upcoming.filter((f) => f.round === round);

  // Only this matchday's nómina: a 3-day window (run Fri/Sat) excludes last
  // weekend's post but covers Wed–Sat, when clubs publish the upcoming XV.
  const sinceTs = Math.floor(Date.now() / 1000) - 3 * 24 * 3600;
  const cache = new Map<string, Awaited<ReturnType<typeof fetchClubNomina>>>();
  const nomina = async (team: string) => {
    if (cache.has(team)) return cache.get(team)!;
    const handle = CLUB_INSTAGRAM[team];
    const r = handle ? await fetchClubNomina(handle, sinceTs).catch(() => null) : null;
    cache.set(team, r);
    return r;
  };

  let filled = 0;
  for (const fx of fixtures) {
    const home = await nomina(fx.homeTeam);
    const away = await nomina(fx.awayTeam);
    if (!home && !away) continue;
    const patch = {
      homeImages: home?.images ?? null, awayImages: away?.images ?? null,
      homeInstagramUrl: home?.permalink ?? null, awayInstagramUrl: away?.permalink ?? null,
      homeInstagramCaption: home?.caption ?? null, awayInstagramCaption: away?.caption ?? null,
      crawledAt: new Date(), updatedAt: new Date(),
    };
    const [existing] = await db.select({ id: matchLineups.id }).from(matchLineups).where(and(
      eq(matchLineups.division, "PRIMERA"), eq(matchLineups.round, round),
      eq(matchLineups.homeTeam, fx.homeTeam), eq(matchLineups.awayTeam, fx.awayTeam),
    ));
    if (existing) await db.update(matchLineups).set(patch).where(eq(matchLineups.id, existing.id));
    else await db.insert(matchLineups).values({
      division: "PRIMERA", round, homeTeam: fx.homeTeam, awayTeam: fx.awayTeam, ...patch,
    });
    filled++;
  }
  console.log(`[upcomingLineups] round ${round}: ${filled}/${fixtures.length} matches with a nómina`);
  return { matches: fixtures.length, filled };
}
