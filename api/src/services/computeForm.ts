/**
 * Per-team form (recent results) for the form guide and head-to-head.
 *
 * Primary source is the live arusa feed (authoritative, real-time, all three
 * grades) via the Leverade match metadata + arusa score scrape. When arusa is
 * unreachable it falls back to the DB (prediction_fixtures + finished
 * live_matches). Name-keyed, newest-first.
 */
import { db } from "../db";
import { predictionFixtures, liveMatches } from "../db/schema";
import { eq } from "drizzle-orm";
import { liveDivisionKey, type DivisionKey } from "./computeStandings";
import { fetchAllMatchesMeta, batchScrapeScores } from "../lib/leverade";

export interface FormMatch {
  opponent: string;
  home: boolean;
  scoreFor: number;
  scoreAgainst: number;
  result: "W" | "D" | "L";
  round?: number;
  date?: string;
}

type Entry = FormMatch & { _ts: number };

const resultOf = (forScore: number, againstScore: number): FormMatch["result"] =>
  forScore > againstScore ? "W" : forScore < againstScore ? "L" : "D";

function finalize(byTeam: Record<string, Entry[]>): Record<string, FormMatch[]> {
  const out: Record<string, FormMatch[]> = {};
  for (const [team, list] of Object.entries(byTeam)) {
    list.sort((a, b) => b._ts - a._ts); // newest first
    out[team] = list.map(({ _ts, ...fm }) => fm);
  }
  return out;
}

// Live arusa feed — covers all three grades in real time.
async function formFromArusa(division: DivisionKey): Promise<Record<string, FormMatch[]> | null> {
  const meta = await fetchAllMatchesMeta();
  const finished = meta.filter((m) => m.division === division && m.finished);
  if (finished.length === 0) return null;

  const scores = await batchScrapeScores(finished);
  const byTeam: Record<string, Entry[]> = {};
  const push = (team: string, e: Entry) => { (byTeam[team] ??= []).push(e); };

  for (const m of finished) {
    const s = scores.get(m.matchId);
    if (!s || s.homeScore == null || s.awayScore == null) continue;
    const date = m.datetime ?? undefined;
    const ts = m.datetime ? new Date(m.datetime).getTime() : 0;
    push(m.homeTeam, {
      opponent: m.awayTeam, home: true,
      scoreFor: s.homeScore, scoreAgainst: s.awayScore,
      result: resultOf(s.homeScore, s.awayScore), date, _ts: ts,
    });
    push(m.awayTeam, {
      opponent: m.homeTeam, home: false,
      scoreFor: s.awayScore, scoreAgainst: s.homeScore,
      result: resultOf(s.awayScore, s.homeScore), date, _ts: ts,
    });
  }

  return Object.keys(byTeam).length > 0 ? finalize(byTeam) : null;
}

// DB fallback — prediction_fixtures (Primera, with round + date) + finished
// live_matches. Used when arusa is unreachable.
async function formFromDb(division: DivisionKey): Promise<Record<string, FormMatch[]>> {
  const byTeam: Record<string, Entry[]> = {};
  const push = (team: string, e: Entry) => { (byTeam[team] ??= []).push(e); };

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

  return finalize(byTeam);
}

export async function computeTeamForm(division: DivisionKey): Promise<Record<string, FormMatch[]>> {
  try {
    const fromArusa = await formFromArusa(division);
    if (fromArusa) return fromArusa;
  } catch {
    // arusa unreachable — fall back to the DB
  }
  return formFromDb(division);
}
