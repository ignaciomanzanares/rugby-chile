/**
 * Tournament poller — auto-creates/updates live_matches rows for today's
 * games and broadcasts them over Socket.IO together with their event timeline.
 *
 * Data sources (all auth-free):
 *  - Match metadata: Leverade's public /tournaments endpoint
 *  - Score:          arusa.cl match results page (server-rendered HTML)
 *  - Event timeline: arusa.cl /change-tab "minute_by_minute" (session + CSRF)
 *
 * No manual scoring required — everything originates from arusa.
 */

import { db } from "../db";
import { liveMatches, liveEvents } from "../db/schema";
import { eq } from "drizzle-orm";
import { getIo } from "../plugins/live";
import {
  type MatchMeta,
  type ArusaEvent,
  fetchAllMatchesMeta,
  scrapeArusaScore,
  scrapeArusaEvents,
  pointsForEventType,
} from "../lib/leverade";

function broadcastUpdate(match: any) {
  getIo()?.emit("match:update", match);
}

/** Kept for backwards compat; io is now sourced from plugins/live. */
export function setIo(_io: any) {}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function minutesSince(datetime: string | null): number {
  if (!datetime) return 0;
  const ms = Date.now() - new Date(datetime).getTime();
  return Math.floor(ms / 60000);
}

function statusFor(m: MatchMeta): "FINISHED" | "LIVE" | "SCHEDULED" {
  if (m.finished) return "FINISHED";
  return minutesSince(m.datetime) >= 0 ? "LIVE" : "SCHEDULED";
}

function countTries(events: ArusaEvent[], team: "home" | "away"): number {
  return events.filter((e) => e.team === team && e.type === "TRY").length;
}

/**
 * Process one match: sync metadata, score, and events from arusa, then
 * broadcast the full match payload (with its event timeline) over Socket.IO.
 */
async function processMatch(m: MatchMeta): Promise<void> {
  const force = !m.finished; // refresh fresh while in progress
  const [score, events] = await Promise.all([
    scrapeArusaScore(m.matchId, { force }),
    scrapeArusaEvents(m.matchId, { force }),
  ]);

  const newStatus = statusFor(m);
  const minute = Math.max(0, Math.min(80, minutesSince(m.datetime)));
  const homeTries = countTries(events, "home");
  const awayTries = countTries(events, "away");

  const existing = await db.query.liveMatches.findFirst({
    where: eq(liveMatches.leveradeMatchId, m.matchId),
  });

  let live;
  if (!existing) {
    [live] = await db
      .insert(liveMatches)
      .values({
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        division: m.division,
        venue: "",
        status: newStatus,
        minute,
        homeScore: score.homeScore ?? 0,
        awayScore: score.awayScore ?? 0,
        homeTries,
        awayTries,
        leveradeMatchId: m.matchId,
      })
      .returning();
    console.log(
      `[poller] Created live match: ${m.homeTeam} vs ${m.awayTeam} (${m.division})`,
    );
  } else {
    [live] = await db
      .update(liveMatches)
      .set({
        status: newStatus,
        minute,
        homeScore: score.homeScore ?? existing.homeScore,
        awayScore: score.awayScore ?? existing.awayScore,
        homeTries,
        awayTries,
        updatedAt: new Date(),
      })
      .where(eq(liveMatches.id, existing.id))
      .returning();
  }

  // arusa is the authoritative event log — wipe and rewrite. Carry the running
  // score per event and tag the half (arusa resets the clock at the break, so a
  // minute that drops back marks the start of the 2nd half).
  await db.delete(liveEvents).where(eq(liveEvents.matchId, live.id));
  if (events.length > 0) {
    let prevMinute = -1;
    let half = 1;
    await db.insert(liveEvents).values(
      events.map((e) => {
        if (prevMinute >= 0 && e.minute + 1 < prevMinute) half = 2;
        prevMinute = e.minute;
        return {
          matchId: live.id,
          team: e.team,
          type: e.type,
          minute: e.minute,
          playerName: e.playerName,
          points: pointsForEventType(e.type),
          homeScore: e.homeScore,
          awayScore: e.awayScore,
          half,
        };
      }),
    );
  }

  const dbEvents = await db
    .select()
    .from(liveEvents)
    .where(eq(liveEvents.matchId, live.id));

  broadcastUpdate({ ...live, events: dbEvents });
}

/**
 * Poll today's matches on a cron tick. Currently scheduled every minute on
 * Thu–Sun via api/src/index.ts.
 */
export async function pollLeverade(): Promise<void> {
  const today = todayStr();

  try {
    const all = await fetchAllMatchesMeta();
    const todays = all.filter((m) => m.datetime?.startsWith(today));
    if (todays.length === 0) return;

    // Run sequentially to keep load on arusa modest. ~5–15 matches per day.
    for (const m of todays) {
      try {
        await processMatch(m);
      } catch (e) {
        console.error(`[poller] match ${m.matchId} failed:`, e);
      }
    }
  } catch (e) {
    console.error("[poller] error:", e);
  }
}
