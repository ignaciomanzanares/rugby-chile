import { FastifyInstance } from "fastify";
import {
  type DivisionKey,
  type MatchMeta,
  type StandingRow,
  DIVISION_TO_GROUP,
  fetchAllMatchesMeta,
  fetchStandings,
  batchScrapeScores,
  batchScrapeTries,
  scrapeArusaScore,
  scrapeArusaEvents,
  resolveDivision,
  canonicalTeam,
} from "../lib/leverade";
import { readCache, writeCache } from "../lib/arusaCache";
import { applyEventCorrections } from "../lib/eventCorrections";
import { db } from "../db";
import { liveMatches } from "../db/schema";
import { liveDivisionKey } from "../services/computeStandings";

export interface MatchResult {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  division: DivisionKey;
  round: number;
  finished: boolean;
  homeScore?: number;
  awayScore?: number;
  datetime: string | null;
}

// Combined results cache — short TTL because today's matches transition from
// in-progress to finished and we want that picked up quickly.
let combinedCache: { data: Record<string, MatchResult>; ts: number } | null = null;
const COMBINED_TTL = 60 * 1000;

export interface VenueRow {
  pos: number; team: string; pj: number; pg: number; pe: number; pp: number;
  pf: number; pc: number; diff: number; pts: number;
}

// Per-division home/away tables. Try-bonus scraping is heavy, so cache longer
// than the combined results; try counts themselves are immutable once final.
const venueCache: Partial<Record<DivisionKey, { data: { home: VenueRow[]; away: VenueRow[] }; ts: number }>> = {};
const VENUE_TTL = 5 * 60 * 1000;

export async function fetchAllResults(): Promise<Record<string, MatchResult>> {
  if (combinedCache && Date.now() - combinedCache.ts < COMBINED_TTL) {
    return combinedCache.data;
  }

  try {
    const meta: MatchMeta[] = await fetchAllMatchesMeta();
    // Leverade's `finished` flag sometimes lags for hours after a match ends
    // (e.g. lower divisions get closed but the Primera fixture is left open),
    // which hides a result arusa.cl already published. So we also scrape any
    // match whose kickoff was long enough ago to be over, and treat it as
    // finished once arusa actually returns a score.
    const POST_MATCH_MS = 3 * 60 * 60 * 1000; // a rugby match is over ~3h after kickoff
    const now = Date.now();
    const kickoffPassed = (m: MatchMeta) => {
      if (!m.datetime) return false;
      const t = new Date(m.datetime.replace(" ", "T")).getTime();
      return Number.isFinite(t) && t + POST_MATCH_MS < now;
    };
    const toScrape = meta.filter((m) => m.finished || kickoffPassed(m));
    const scores = await batchScrapeScores(toScrape);

    const results: Record<string, MatchResult> = {};
    for (const m of meta) {
      const s = scores.get(m.matchId);
      // arusa is primary (fresher, minute-by-minute); Leverade's own score
      // (folded into MatchMeta) is the fallback when arusa is blocked/down.
      const homeScore = s?.homeScore ?? m.homeScore;
      const awayScore = s?.awayScore ?? m.awayScore;
      const hasScore = homeScore != null && awayScore != null;
      // Key by division too — the same pair (e.g. "COBS|DOBS") plays in all
      // three divisions, so the unqualified key collides.
      results[`${m.division}|${m.homeTeam}|${m.awayTeam}`] = {
        matchId: m.matchId,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        division: m.division,
        round: m.round,
        // A past match with a published score is final even if Leverade's
        // flag hasn't flipped yet.
        finished: m.finished || (hasScore && kickoffPassed(m)),
        datetime: m.datetime,
        homeScore,
        awayScore,
      };
    }

    // Only treat this as a good read if we actually got scores from somewhere
    // (arusa or Leverade); otherwise fall back to the last captured snapshot.
    const withScores = meta.filter((m) => {
      const s = scores.get(m.matchId);
      return (s?.homeScore ?? m.homeScore) != null;
    }).length;
    if (withScores === 0) throw new Error("no scores from arusa or Leverade");

    combinedCache = { data: results, ts: Date.now() };
    void writeCache("results", results); // persist last-good
    return results;
  } catch (err) {
    const persisted = await readCache<Record<string, MatchResult>>("results");
    if (persisted && Object.keys(persisted).length > 0) {
      combinedCache = { data: persisted, ts: Date.now() };
      return persisted;
    }
    throw err;
  }
}

// Apply one finished result's deltas onto a canonical-name-keyed table. Rugby
// points: win=4, draw=2, loss=0, +1 try bonus (4+ tries), +1 losing bonus
// (margin ≤7). Mirrors the live overlay on the client so values agree.
function applyOneResult(
  byTeam: Map<string, StandingRow>,
  m: { homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; homeTries: number; awayTries: number },
): void {
  const home = byTeam.get(m.homeTeam);
  const away = byTeam.get(m.awayTeam);
  if (!home || !away) return; // unknown team name — skip rather than invent a row

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

// arusa publishes a match's score on its results page before it recomputes the
// ranking table, so the table can trail its own results feed by a round (teams
// show one fewer PJ than they've actually played). Detect finished results the
// scraped table hasn't counted yet and overlay them, so the table leads the lag
// instead of trailing it — the same idea as the client's live overlay.
async function reconcileStandings(
  division: DivisionKey,
  scraped: StandingRow[],
): Promise<StandingRow[]> {
  let results: Record<string, MatchResult>;
  try {
    results = await fetchAllResults();
  } catch {
    return scraped; // no results feed to reconcile against
  }

  // Finished, scored matches for this division, newest round first.
  const finished = Object.values(results)
    .filter((r) => r.division === division && r.finished && r.homeScore != null && r.awayScore != null)
    .sort((a, b) => b.round - a.round);

  const byTeam = new Map(scraped.map((r) => [canonicalTeam(r.team), { ...r }]));

  // Pairings currently LIVE/HT — the client applies its own live overlay for
  // these, so reconciling their (possibly already-finished-in-feed) result here
  // too would double-count them at full time. Skip applying, but still spend the
  // missing-match budget so other lagging rounds are picked correctly.
  const livePairs = new Set<string>();
  try {
    const rows = await db
      .select({ home: liveMatches.homeTeam, away: liveMatches.awayTeam, division: liveMatches.division, status: liveMatches.status })
      .from(liveMatches);
    for (const r of rows) {
      if ((r.status === "LIVE" || r.status === "HT") && liveDivisionKey(r.division) === division) {
        livePairs.add(`${canonicalTeam(r.home)}|${canonicalTeam(r.away)}`);
        livePairs.add(`${canonicalTeam(r.away)}|${canonicalTeam(r.home)}`);
      }
    }
  } catch {
    // DB unreachable — fall back to applying all lagging matches.
  }
  const isLive = (m: MatchResult) => livePairs.has(`${m.homeTeam}|${m.awayTeam}`);

  // How many of each team's matches the feed says are finished vs. how many the
  // scraped table already counts → per-team budget of missing recent matches.
  const missing = new Map<string, number>();
  for (const m of finished) {
    missing.set(m.homeTeam, (missing.get(m.homeTeam) ?? 0) + 1);
    missing.set(m.awayTeam, (missing.get(m.awayTeam) ?? 0) + 1);
  }
  for (const [team, row] of byTeam) {
    missing.set(team, (missing.get(team) ?? 0) - row.pj);
  }

  // Greedily pick lagging matches (newest first) where both teams still have a
  // missing-match budget, so we apply exactly the rounds the table skipped.
  // Spend the budget on live matches too, but let the client overlay apply them.
  const lagging: MatchResult[] = [];
  for (const m of finished) {
    if ((missing.get(m.homeTeam) ?? 0) > 0 && (missing.get(m.awayTeam) ?? 0) > 0) {
      missing.set(m.homeTeam, missing.get(m.homeTeam)! - 1);
      missing.set(m.awayTeam, missing.get(m.awayTeam)! - 1);
      if (!isLive(m)) lagging.push(m);
    }
  }

  if (lagging.length === 0) return scraped; // table already up to date

  // Tries decide bonus points and the results feed doesn't carry them, so scrape
  // just the lagging matches to keep the overlaid points exact.
  const tries = await batchScrapeTries(lagging.map((m) => ({ matchId: m.matchId }))).catch(
    () => new Map<string, { home: number; away: number }>(),
  );

  for (const m of lagging) {
    const t = tries.get(m.matchId);
    applyOneResult(byTeam, {
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeScore: m.homeScore!,
      awayScore: m.awayScore!,
      homeTries: t?.home ?? 0,
      awayTries: t?.away ?? 0,
    });
  }

  // Re-sort/re-rank by arusa's ordering (pts, then diff, then points-for).
  return [...byTeam.values()]
    .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.pf - a.pf)
    .map((r, i) => ({ ...r, pos: i + 1 }));
}

// The current, lag-corrected standings for a division (arusa's scraped table
// with any just-finished result overlaid). Same value the /leverade/standings
// route serves — exported so the season projection can seed its simulation from
// the real table (correct bonus points and all) rather than recomputing it.
export async function getReconciledStandings(division: DivisionKey): Promise<StandingRow[] | null> {
  const scraped = await fetchStandings(division);
  if (!scraped) return null;
  return reconcileStandings(division, scraped);
}

export async function leveradeResultsRoutes(app: FastifyInstance) {
  // GET /api/v1/leverade/results — results across all three divisions,
  // keyed by `${homeTeam}|${awayTeam}`. Optional ?division= filter.
  app.get("/leverade/results", async (req, reply) => {
    try {
      const data = await fetchAllResults();
      const divisionRaw = (req.query as any)?.division;
      const filterDivision: DivisionKey | null =
        typeof divisionRaw === "string" && divisionRaw.toUpperCase() in DIVISION_TO_GROUP
          ? (divisionRaw.toUpperCase() as DivisionKey)
          : null;

      const out: Record<string, MatchResult> = {};
      for (const [k, v] of Object.entries(data)) {
        if (!filterDivision || v.division === filterDivision) out[k] = v;
      }
      reply.header("Cache-Control", "no-store");
      return out;
    } catch {
      reply.status(503).send({ error: "Tournament data unavailable" });
    }
  });

  // GET /api/v1/leverade/standings?division=PRIMERA — parsed standings rows
  app.get("/leverade/standings", async (req, reply) => {
    const division = resolveDivision((req.query as any)?.division);
    const scraped = await fetchStandings(division);
    if (!scraped) return reply.status(503).send({ error: "Standings unavailable" });
    // Lead arusa's table-vs-results lag: overlay any finished result the scraped
    // table hasn't counted yet (e.g. COBS/Sporting after they've played).
    const rows = await reconcileStandings(division, scraped);
    reply.header("Cache-Control", "no-store");
    return { division, rows };
  });

  // GET /api/v1/match/events?division=&home=&away= — minute-by-minute timeline +
  // current/final score for a match, scraped from arusa. Events are returned
  // oriented to the requested home/away (arusa may label them the other way).
  // Finished-match events are persisted so they survive arusa outages.
  app.get("/match/events", async (req, reply) => {
    const q = req.query as Record<string, string>;
    const division = resolveDivision(q.division);
    const home = q.home, away = q.away;
    // Round is required to disambiguate the two legs of a double round-robin —
    // without it we'd match the first meeting (the ida) and show its timeline for
    // the vuelta. Optional for back-compat, but the client always sends it now.
    const round = q.round != null && q.round !== "" ? Number(q.round) : null;
    if (!home || !away) return reply.status(400).send({ error: "home and away are required" });

    let meta: MatchMeta[];
    try {
      meta = await fetchAllMatchesMeta();
    } catch {
      return { finished: false, events: [], homeScore: undefined, awayScore: undefined };
    }
    const pairMatches = (x: MatchMeta) =>
      x.division === division &&
      ((x.homeTeam === home && x.awayTeam === away) || (x.homeTeam === away && x.awayTeam === home));
    // Prefer the exact round; fall back to the pairing if the round wasn't given.
    const m = (round != null && meta.find((x) => pairMatches(x) && x.round === round)) || meta.find(pairMatches);
    if (!m) return { finished: false, events: [], homeScore: undefined, awayScore: undefined };

    const reversed = m.homeTeam !== home; // arusa's home/away is the other way round
    const cacheKey = `events:${m.matchId}`;

    let events;
    try {
      events = await scrapeArusaEvents(m.matchId, { force: !m.finished });
      if (events.length > 0) void writeCache(cacheKey, events);
      else if (m.finished) events = (await readCache<typeof events>(cacheKey)) ?? [];
    } catch {
      events = (await readCache<any[]>(cacheKey)) ?? [];
    }

    let score: { homeScore?: number; awayScore?: number; referees?: string[] };
    try {
      score = await scrapeArusaScore(m.matchId, { force: !m.finished });
    } catch {
      score = {};
    }

    let referees = score.referees ?? [];
    if (referees.length > 0) void writeCache(`refs:${m.matchId}`, referees);
    else referees = (await readCache<string[]>(`refs:${m.matchId}`)) ?? [];

    // arusa returns events in chronological order but resets the clock each
    // half (2nd-half events come back as 1'..40' again). Walk them in order and
    // add 40' once the clock drops, so the timeline sorts as running game time.
    let offset = 0;
    let prevMinute = -1;
    const oriented = events.map((e) => {
      if (prevMinute >= 0 && e.minute + 1 < prevMinute) offset = 40;
      prevMinute = e.minute;
      return {
        minute: e.minute + offset,
        type: e.type,
        playerName: e.playerName,
        team: reversed ? (e.team === "home" ? "away" : "home") : e.team,
        homeScore: reversed ? e.awayScore : e.homeScore,
        awayScore: reversed ? e.homeScore : e.awayScore,
        half: offset === 0 ? 1 : 2,
      };
    });

    return {
      finished: m.finished,
      homeScore: reversed ? score.awayScore : score.homeScore,
      awayScore: reversed ? score.homeScore : score.awayScore,
      referees,
      // Fix arusa's known scorer mis-attributions before serving (no-op otherwise).
      events: applyEventCorrections(division, round, home, away, oriented),
    };
  });

  // GET /api/v1/leverade/venue-standings?division=PRIMERA — home-only and
  // away-only tables with full rugby bonus points. The offensive (try) bonus
  // needs per-match tries, which only the minute-by-minute timeline exposes, so
  // this is computed on demand and cached (try counts are cached forever once
  // scraped). Returns { division, home, away }.
  app.get("/leverade/venue-standings", async (req, reply) => {
    const division = resolveDivision((req.query as any)?.division);
    const cached = venueCache[division];
    if (cached && Date.now() - cached.ts < VENUE_TTL) {
      reply.header("Cache-Control", "no-store");
      return { division, ...cached.data };
    }
    try {
      const all = await fetchAllResults();
      const inDiv = Object.values(all).filter((r) => r.division === division);
      const finished = inDiv.filter(
        (r) => r.finished && r.homeScore != null && r.awayScore != null,
      );
      const tries = await batchScrapeTries(finished.map((r) => ({ matchId: r.matchId })));
      const teams = [...new Set(inDiv.flatMap((r) => [r.homeTeam, r.awayTeam]))];

      const build = (venue: "home" | "away"): VenueRow[] => {
        const rows = new Map<string, VenueRow>(
          teams.map((t) => [t, { pos: 0, team: t, pj: 0, pg: 0, pe: 0, pp: 0, pf: 0, pc: 0, diff: 0, pts: 0 }]),
        );
        for (const r of finished) {
          const team = venue === "home" ? r.homeTeam : r.awayTeam;
          const row = rows.get(team);
          if (!row) continue;
          const tf = (venue === "home" ? r.homeScore : r.awayScore) as number;
          const ta = (venue === "home" ? r.awayScore : r.homeScore) as number;
          const t = tries.get(r.matchId);
          const teamTries = t ? (venue === "home" ? t.home : t.away) : 0;
          row.pj += 1;
          row.pf += tf;
          row.pc += ta;
          if (tf > ta) { row.pg += 1; row.pts += 4; }
          else if (tf === ta) { row.pe += 1; row.pts += 2; }
          else { row.pp += 1; if (ta - tf <= 7) row.pts += 1; }
          if (teamTries >= 4) row.pts += 1; // offensive (try) bonus
          row.diff = row.pf - row.pc;
        }
        return [...rows.values()]
          .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.pf - a.pf)
          .map((r, i) => ({ ...r, pos: i + 1 }));
      };

      const data = { home: build("home"), away: build("away") };
      venueCache[division] = { data, ts: Date.now() };
      void writeCache(`venue:${division}`, data);
      reply.header("Cache-Control", "no-store");
      return { division, ...data };
    } catch {
      const persisted = await readCache<{ home: VenueRow[]; away: VenueRow[] }>(`venue:${division}`);
      if (persisted) return { division, ...persisted };
      return reply.status(503).send({ error: "Venue standings unavailable" });
    }
  });
}
