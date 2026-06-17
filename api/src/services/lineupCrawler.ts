import { db } from "../db";
import { matchLineups, predictionFixtures } from "../db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { findLineupPost } from "./instagramScraper";

// Instagram handles for each club (verify against official accounts)
const CLUB_INSTAGRAM: Record<string, string> = {
  "COBS":           "cobs_cogs",
  "Old Boys":       "oldboysrugby",
  "PWCC":           "rugbypwcc",
  "Old Macks":      "oldmackayansrfc",
  "Stade Francais": "rugbystadefrancais",
  "Sporting RC":    "sportingrc",
  "DOBS":           "dunalastairclub",
  "UC":             "rugbyuc",
  "Old Johns":      "oldjohnsrugby",
  "Old Reds":       "oldreds.rugby",
};

/** How many days before a match to start checking for lineups. */
const CHECK_WINDOW_DAYS = 3;

async function upsertLineup(
  division: string,
  round: number,
  homeTeam: string,
  awayTeam: string,
  patch: Partial<{
    homeStarters: string[];
    homeSubs: string[];
    homeInstagramUrl: string;
    homeInstagramCaption: string;
    awayStarters: string[];
    awaySubs: string[];
    awayInstagramUrl: string;
    awayInstagramCaption: string;
    crawledAt: Date;
  }>,
) {
  const existing = await db.query.matchLineups.findFirst({
    where: and(
      eq(matchLineups.division, division),
      eq(matchLineups.round, round),
      eq(matchLineups.homeTeam, homeTeam),
      eq(matchLineups.awayTeam, awayTeam),
    ),
  });

  if (existing) {
    await db
      .update(matchLineups)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(matchLineups.id, existing.id));
  } else {
    await db.insert(matchLineups).values({
      division,
      round,
      homeTeam,
      awayTeam,
      ...patch,
    });
  }
}

/**
 * Crawls Instagram for lineup posts for all upcoming matches
 * scheduled within the next CHECK_WINDOW_DAYS days.
 *
 * Skips clubs whose lineup has already been confirmed (starters already set).
 */
export async function crawlLineups(): Promise<{ checked: number; updated: number; errors: string[] }> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + CHECK_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Find upcoming matches in the check window
  const upcoming = await db
    .select()
    .from(predictionFixtures)
    .where(
      and(
        eq(predictionFixtures.status, "UPCOMING"),
        gte(predictionFixtures.matchDate, now),
        lte(predictionFixtures.matchDate, windowEnd),
      ),
    );

  if (upcoming.length === 0) {
    console.log("[lineupCrawler] No upcoming matches in window");
    return { checked: 0, updated: 0, errors: [] };
  }

  console.log(`[lineupCrawler] Checking ${upcoming.length} upcoming matches`);

  let checked = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const fixture of upcoming) {
    const division = "PRIMERA"; // predictionFixtures only has Primera
    const { round, homeTeam, awayTeam, matchDate } = fixture;

    // Load existing lineup record
    const existing = await db.query.matchLineups.findFirst({
      where: and(
        eq(matchLineups.division, division),
        eq(matchLineups.round, round),
        eq(matchLineups.homeTeam, homeTeam),
        eq(matchLineups.awayTeam, awayTeam),
      ),
    });

    // Posts should be published after the previous match weekend (5 days before this one)
    const afterTimestamp = Math.floor(
      (matchDate!.getTime() - 5 * 24 * 60 * 60 * 1000) / 1000,
    );

    const patch: Parameters<typeof upsertLineup>[4] = { crawledAt: now };
    let anyUpdate = false;

    // ── Home team ──────────────────────────────────────────────────
    const homeHandle = CLUB_INSTAGRAM[homeTeam];
    const homeAlreadySet = existing?.homeStarters && existing.homeStarters.length >= 10;

    if (homeHandle && !homeAlreadySet) {
      try {
        checked++;
        const result = await findLineupPost(homeHandle, afterTimestamp);

        if (result) {
          patch.homeInstagramUrl = result.post.permalink;
          patch.homeInstagramCaption = result.post.caption;
          if (result.parsed) {
            const starters = result.parsed.slice(0, 15);
            const subs = result.parsed.slice(15, 23);
            patch.homeStarters = starters;
            patch.homeSubs = subs.length > 0 ? subs : undefined;
            console.log(`[lineupCrawler] Parsed home lineup for ${homeTeam} vs ${awayTeam} (${starters.filter(Boolean).length} players)`);
          } else {
            console.log(`[lineupCrawler] Found post for ${homeTeam} but couldn't parse names — saving URL only`);
          }
          anyUpdate = true;
        }
      } catch (e: any) {
        const msg = `${homeTeam}: ${e?.message ?? e}`;
        errors.push(msg);
        console.error(`[lineupCrawler] Error checking ${homeTeam}:`, e);
      }

      // Rate limit between clubs
      await new Promise((r) => setTimeout(r, 2000));
    }

    // ── Away team ──────────────────────────────────────────────────
    const awayHandle = CLUB_INSTAGRAM[awayTeam];
    const awayAlreadySet = existing?.awayStarters && existing.awayStarters.length >= 10;

    if (awayHandle && !awayAlreadySet) {
      try {
        checked++;
        const result = await findLineupPost(awayHandle, afterTimestamp);

        if (result) {
          patch.awayInstagramUrl = result.post.permalink;
          patch.awayInstagramCaption = result.post.caption;
          if (result.parsed) {
            const starters = result.parsed.slice(0, 15);
            const subs = result.parsed.slice(15, 23);
            patch.awayStarters = starters;
            patch.awaySubs = subs.length > 0 ? subs : undefined;
            console.log(`[lineupCrawler] Parsed away lineup for ${homeTeam} vs ${awayTeam} (${starters.filter(Boolean).length} players)`);
          } else {
            console.log(`[lineupCrawler] Found post for ${awayTeam} but couldn't parse names — saving URL only`);
          }
          anyUpdate = true;
        }
      } catch (e: any) {
        const msg = `${awayTeam}: ${e?.message ?? e}`;
        errors.push(msg);
        console.error(`[lineupCrawler] Error checking ${awayTeam}:`, e);
      }

      await new Promise((r) => setTimeout(r, 2000));
    }

    if (anyUpdate) {
      await upsertLineup(division, round, homeTeam, awayTeam, patch);
      updated++;
    } else if (!existing) {
      // Record that we checked, even with no result, so we don't spam Instagram
      await upsertLineup(division, round, homeTeam, awayTeam, { crawledAt: now });
    } else {
      await db
        .update(matchLineups)
        .set({ crawledAt: now, updatedAt: new Date() })
        .where(eq(matchLineups.id, existing.id));
    }
  }

  console.log(`[lineupCrawler] Done: checked=${checked}, updated=${updated}, errors=${errors.length}`);
  return { checked, updated, errors };
}
