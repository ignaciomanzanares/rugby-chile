/**
 * Live player-stat aggregation.
 *
 * Rolls up `live_events` into per-player stat lines, resolving each player's
 * club from their match (event.team -> home/away team name). Only IN-PROGRESS
 * matches (LIVE/HT) are counted: this is a real-time overlay on top of the
 * authoritative arusa season stats, which already include finished matches.
 * Counting finished matches here too would double-count a scorer's line once
 * arusa picks the match up (e.g. showing 9 played in an 8-round season).
 *
 * Keyed by name + club. live_events only carry a free-text playerName (no arusa
 * player id), so the web layer merges these onto its static season baseline by
 * normalised name; unmatched scorers show up as new "live" rows. `matches` here
 * counts distinct matches in which the player had a recorded event (live_events
 * has no lineup data), which is a deliberate approximation.
 */
import { db } from "../db";
import { liveMatches, liveEvents } from "../db/schema";
import { liveDivisionKey, type DivisionKey } from "./computeStandings";

const TEAM_SLUGS: Record<string, string> = {
  "COBS": "cobs",
  "Old Boys": "old-boys",
  "PWCC": "pwcc",
  "Old Macks": "old-macks",
  "Stade Francais": "stade-francais",
  "Sporting RC": "sporting-rc",
  "DOBS": "dobs",
  "UC": "uc",
  "Old Johns": "old-johns",
  "Old Reds": "old-reds",
};

export interface LivePlayerStat {
  name: string;
  team: string;
  teamSlug: string;
  matches: number;
  points: number;
  tries: number;
  conversions: number;
  penalties: number;
  drops: number;
  yellowCards: number;
  redCards: number;
}

export async function computeLivePlayerStats(division: DivisionKey): Promise<LivePlayerStat[]> {
  const [matches, events] = await Promise.all([
    db.select().from(liveMatches),
    db.select().from(liveEvents),
  ]);

  const matchById = new Map(matches.map((m) => [m.id, m]));

  type Agg = LivePlayerStat & { _matchIds: Set<string> };
  const agg = new Map<string, Agg>();

  for (const ev of events) {
    const name = ev.playerName?.trim();
    if (!name) continue; // cards/conversions without a named player are skipped
    const match = matchById.get(ev.matchId);
    if (!match || liveDivisionKey(match.division) !== division) continue;
    // Only in-progress matches; finished ones are already in the arusa base.
    if (match.status !== "LIVE" && match.status !== "HT") continue;

    const club = ev.team === "home" ? match.homeTeam : match.awayTeam;
    const key = `${club}␟${name}`;
    let row = agg.get(key);
    if (!row) {
      row = {
        name, team: club, teamSlug: TEAM_SLUGS[club] ?? "",
        matches: 0, points: 0, tries: 0, conversions: 0,
        penalties: 0, drops: 0, yellowCards: 0, redCards: 0,
        _matchIds: new Set<string>(),
      };
      agg.set(key, row);
    }

    row._matchIds.add(ev.matchId);
    row.points += ev.points ?? 0;
    switch (ev.type) {
      case "TRY": row.tries++; break;
      case "CONVERSION": row.conversions++; break;
      case "PENALTY": row.penalties++; break;
      case "DROP_GOAL": row.drops++; break;
      case "YELLOW_CARD": row.yellowCards++; break;
      case "RED_CARD": row.redCards++; break;
    }
  }

  return [...agg.values()].map(({ _matchIds, ...r }) => ({ ...r, matches: _matchIds.size }));
}
