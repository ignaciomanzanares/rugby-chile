/**
 * Server-computed standings.
 *
 * The table is derived from a post-Fecha-4 baseline plus every FINISHED row in
 * `live_matches` (whether scored live through the app or synced from arusa by
 * the poller). Because finished matches live in the DB, the table advances
 * permanently as matches complete — the standings page applies only the
 * temporary LIVE/HT overlay on top of this.
 *
 * Everything is keyed by team name (matching the rest of the app), so no
 * clubs/teams/standings FK rows are required.
 */
import { db } from "../db";
import { liveMatches } from "../db/schema";
import { eq } from "drizzle-orm";

export type DivisionKey = "PRIMERA" | "INTERMEDIA" | "PRE_INTERMEDIA";

export interface StandingRow {
  pos: number; team: string; pj: number; pg: number; pe: number; pp: number;
  pf: number; pc: number; diff: number; pts: number;
}

// Baseline through Fecha 4 — mirrors STANDINGS in web/src/lib/tournament.ts.
// Live FINISHED results are applied on top, so keep these as the season-to-date
// snapshot the live feed extends (not a from-scratch zero table).
const BASELINE: Record<DivisionKey, StandingRow[]> = {
  PRIMERA: [
    { pos: 1, team: "COBS", pj: 4, pg: 4, pe: 0, pp: 0, pf: 126, pc: 74, diff: 52, pts: 18 },
    { pos: 2, team: "Old Boys", pj: 4, pg: 3, pe: 0, pp: 1, pf: 140, pc: 80, diff: 60, pts: 15 },
    { pos: 3, team: "PWCC", pj: 4, pg: 3, pe: 1, pp: 0, pf: 115, pc: 106, diff: 9, pts: 15 },
    { pos: 4, team: "Old Macks", pj: 4, pg: 2, pe: 0, pp: 2, pf: 88, pc: 72, diff: 16, pts: 12 },
    { pos: 5, team: "Stade Francais", pj: 4, pg: 1, pe: 1, pp: 2, pf: 105, pc: 113, diff: -8, pts: 8 },
    { pos: 6, team: "Sporting RC", pj: 4, pg: 2, pe: 0, pp: 2, pf: 73, pc: 97, diff: -24, pts: 8 },
    { pos: 7, team: "DOBS", pj: 4, pg: 1, pe: 0, pp: 3, pf: 103, pc: 147, diff: -44, pts: 8 },
    { pos: 8, team: "UC", pj: 4, pg: 1, pe: 0, pp: 3, pf: 115, pc: 122, diff: -7, pts: 7 },
    { pos: 9, team: "Old Johns", pj: 4, pg: 1, pe: 0, pp: 3, pf: 95, pc: 124, diff: -29, pts: 7 },
    { pos: 10, team: "Old Reds", pj: 4, pg: 1, pe: 0, pp: 3, pf: 79, pc: 104, diff: -25, pts: 6 },
  ],
  INTERMEDIA: [
    { pos: 1, team: "Old Macks", pj: 4, pg: 4, pe: 0, pp: 0, pf: 167, pc: 48, diff: 119, pts: 20 },
    { pos: 2, team: "Old Johns", pj: 4, pg: 4, pe: 0, pp: 0, pf: 201, pc: 102, diff: 99, pts: 20 },
    { pos: 3, team: "Old Boys", pj: 4, pg: 3, pe: 0, pp: 1, pf: 152, pc: 89, diff: 63, pts: 16 },
    { pos: 4, team: "COBS", pj: 4, pg: 2, pe: 0, pp: 2, pf: 161, pc: 99, diff: 62, pts: 13 },
    { pos: 5, team: "PWCC", pj: 4, pg: 2, pe: 0, pp: 2, pf: 107, pc: 115, diff: -8, pts: 10 },
    { pos: 6, team: "DOBS", pj: 4, pg: 2, pe: 0, pp: 2, pf: 121, pc: 168, diff: -47, pts: 10 },
    { pos: 7, team: "Old Reds", pj: 4, pg: 1, pe: 0, pp: 3, pf: 115, pc: 154, diff: -39, pts: 9 },
    { pos: 8, team: "UC", pj: 4, pg: 1, pe: 0, pp: 3, pf: 114, pc: 175, diff: -61, pts: 7 },
    { pos: 9, team: "Stade Francais", pj: 4, pg: 1, pe: 0, pp: 3, pf: 82, pc: 139, diff: -57, pts: 6 },
    { pos: 10, team: "Sporting RC", pj: 4, pg: 0, pe: 0, pp: 4, pf: 77, pc: 208, diff: -131, pts: 1 },
  ],
  PRE_INTERMEDIA: [
    { pos: 1, team: "Old Macks", pj: 4, pg: 3, pe: 1, pp: 0, pf: 167, pc: 88, diff: 79, pts: 18 },
    { pos: 2, team: "COBS", pj: 4, pg: 3, pe: 0, pp: 1, pf: 130, pc: 118, diff: 12, pts: 15 },
    { pos: 3, team: "PWCC", pj: 3, pg: 2, pe: 1, pp: 0, pf: 172, pc: 55, diff: 117, pts: 13 },
    { pos: 4, team: "Sporting RC", pj: 4, pg: 2, pe: 0, pp: 2, pf: 84, pc: 75, diff: 9, pts: 11 },
    { pos: 5, team: "Old Boys", pj: 3, pg: 2, pe: 0, pp: 1, pf: 78, pc: 40, diff: 38, pts: 10 },
    { pos: 6, team: "DOBS", pj: 3, pg: 1, pe: 0, pp: 2, pf: 71, pc: 71, diff: 0, pts: 6 },
    { pos: 7, team: "UC", pj: 2, pg: 1, pe: 0, pp: 1, pf: 63, pc: 62, diff: 1, pts: 5 },
    { pos: 8, team: "Old Johns", pj: 3, pg: 1, pe: 0, pp: 2, pf: 47, pc: 125, diff: -78, pts: 5 },
    { pos: 9, team: "Stade Francais", pj: 4, pg: 1, pe: 0, pp: 3, pf: 83, pc: 162, diff: -79, pts: 5 },
    { pos: 10, team: "Old Reds", pj: 4, pg: 0, pe: 0, pp: 4, pf: 82, pc: 181, diff: -99, pts: 2 },
  ],
};

// `live_matches.division` is free-form ("Primera XV", "Intermedia", …). Check
// PRE before INTERMEDIA because "Pre-Intermedia" contains "Intermedia".
export function liveDivisionKey(raw: string): DivisionKey | null {
  const s = raw.toLowerCase();
  if (s.includes("pre")) return "PRE_INTERMEDIA";
  if (s.includes("intermedia")) return "INTERMEDIA";
  if (s.includes("primera")) return "PRIMERA";
  return null;
}

interface ResultInput {
  homeTeam: string; awayTeam: string;
  homeScore: number; awayScore: number;
  homeTries: number; awayTries: number;
}

// Apply finished results onto a name-keyed table. Rugby points: win=4, draw=2,
// loss=0, +1 try bonus (4+ tries), +1 losing bonus (margin ≤7). Mirrors the
// client overlay in web/src/app/standings/page.tsx so live and final agree.
function applyResults(base: StandingRow[], results: ResultInput[]): StandingRow[] {
  const byTeam = new Map(base.map((r) => [r.team, { ...r }]));
  for (const m of results) {
    const home = byTeam.get(m.homeTeam);
    const away = byTeam.get(m.awayTeam);
    if (!home || !away) continue; // unknown team name — skip rather than invent a row

    const { homeScore: hs, awayScore: as, homeTries: ht, awayTries: at } = m;
    home.pj += 1; away.pj += 1;
    home.pf += hs; home.pc += as;
    away.pf += as; away.pc += hs;

    const homeWin = hs > as;
    const draw = hs === as;
    if (draw) { home.pe += 1; away.pe += 1; }
    else if (homeWin) { home.pg += 1; away.pp += 1; }
    else { away.pg += 1; home.pp += 1; }

    let homePts = draw ? 2 : homeWin ? 4 : 0;
    let awayPts = draw ? 2 : homeWin ? 0 : 4;
    if (ht >= 4) homePts += 1;
    if (at >= 4) awayPts += 1;
    if (!draw && !homeWin && as - hs <= 7) homePts += 1;
    if (!draw && homeWin && hs - as <= 7) awayPts += 1;

    home.pts += homePts; away.pts += awayPts;
    home.diff = home.pf - home.pc;
    away.diff = away.pf - away.pc;
  }

  return [...byTeam.values()]
    .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.pf - a.pf)
    .map((r, i) => ({ ...r, pos: i + 1 }));
}

export async function computeStandings(division: DivisionKey): Promise<StandingRow[]> {
  const base = BASELINE[division];
  if (!base) return [];

  const finished = await db
    .select()
    .from(liveMatches)
    .where(eq(liveMatches.status, "FINISHED"));

  const results: ResultInput[] = finished
    .filter((m) => liveDivisionKey(m.division) === division)
    .map((m) => ({
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      homeTries: m.homeTries,
      awayTries: m.awayTries,
    }));

  return applyResults(base, results);
}
