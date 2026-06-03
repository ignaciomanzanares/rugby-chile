/**
 * Per-team form (recent results) for the form guide and head-to-head.
 *
 * Builds each team's chronological result list from prediction_fixtures
 * (historical, with round + date) and FINISHED live_matches (app/poller-scored,
 * ordered by createdAt). Name-keyed, newest-first. As with the rest of the live
 * system, only Primera has historical fixtures; other divisions return whatever
 * finished live matches exist.
 */
import { db } from "../db";
import { predictionFixtures, liveMatches } from "../db/schema";
import { eq } from "drizzle-orm";
import { liveDivisionKey, type DivisionKey } from "./computeStandings";

export interface FormMatch {
  opponent: string;
  home: boolean;
  scoreFor: number;
  scoreAgainst: number;
  result: "W" | "D" | "L";
  round?: number;
  date?: string;
}

const resultOf = (forScore: number, againstScore: number): FormMatch["result"] =>
  forScore > againstScore ? "W" : forScore < againstScore ? "L" : "D";

export async function computeTeamForm(division: DivisionKey): Promise<Record<string, FormMatch[]>> {
  type Entry = FormMatch & { _ts: number };
  const byTeam: Record<string, Entry[]> = {};
  const push = (team: string, e: Entry) => {
    (byTeam[team] ??= []).push(e);
  };

  // Historical results (round + date) from prediction_fixtures.
  const fixtures = await db.select().from(predictionFixtures);
  for (const f of fixtures) {
    if (f.status !== "COMPLETED" || f.homeScoreActual == null || f.awayScoreActual == null) continue;
    if (liveDivisionKey(f.division) !== division) continue;
    const date = f.matchDate ? new Date(f.matchDate).toISOString() : undefined;
    const ts = f.matchDate ? new Date(f.matchDate).getTime() : (f.round ?? 0);
    push(f.homeTeam, {
      opponent: f.awayTeam, home: true,
      scoreFor: f.homeScoreActual, scoreAgainst: f.awayScoreActual,
      result: resultOf(f.homeScoreActual, f.awayScoreActual), round: f.round, date, _ts: ts,
    });
    push(f.awayTeam, {
      opponent: f.homeTeam, home: false,
      scoreFor: f.awayScoreActual, scoreAgainst: f.homeScoreActual,
      result: resultOf(f.awayScoreActual, f.homeScoreActual), round: f.round, date, _ts: ts,
    });
  }

  // Finished live matches (no round; order by createdAt).
  const finished = await db.select().from(liveMatches).where(eq(liveMatches.status, "FINISHED"));
  for (const m of finished) {
    if (liveDivisionKey(m.division) !== division) continue;
    const date = new Date(m.createdAt).toISOString();
    const ts = new Date(m.createdAt).getTime();
    push(m.homeTeam, {
      opponent: m.awayTeam, home: true,
      scoreFor: m.homeScore, scoreAgainst: m.awayScore,
      result: resultOf(m.homeScore, m.awayScore), date, _ts: ts,
    });
    push(m.awayTeam, {
      opponent: m.homeTeam, home: false,
      scoreFor: m.awayScore, scoreAgainst: m.homeScore,
      result: resultOf(m.awayScore, m.homeScore), date, _ts: ts,
    });
  }

  const out: Record<string, FormMatch[]> = {};
  for (const [team, list] of Object.entries(byTeam)) {
    list.sort((a, b) => b._ts - a._ts); // newest first
    out[team] = list.map(({ _ts, ...fm }) => fm);
  }
  return out;
}
