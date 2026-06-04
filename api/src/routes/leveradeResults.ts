import { FastifyInstance } from "fastify";
import {
  type DivisionKey,
  type MatchMeta,
  DIVISION_TO_GROUP,
  fetchAllMatchesMeta,
  fetchStandings,
  batchScrapeScores,
  scrapeArusaScore,
  scrapeArusaEvents,
  resolveDivision,
} from "../lib/leverade";
import { readCache, writeCache } from "../lib/arusaCache";

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

export async function fetchAllResults(): Promise<Record<string, MatchResult>> {
  if (combinedCache && Date.now() - combinedCache.ts < COMBINED_TTL) {
    return combinedCache.data;
  }

  try {
    const meta: MatchMeta[] = await fetchAllMatchesMeta();
    const finished = meta.filter((m) => m.finished);
    const scores = await batchScrapeScores(finished);

    const results: Record<string, MatchResult> = {};
    for (const m of meta) {
      const s = scores.get(m.matchId);
      // Key by division too — the same pair (e.g. "COBS|DOBS") plays in all
      // three divisions, so the unqualified key collides.
      results[`${m.division}|${m.homeTeam}|${m.awayTeam}`] = {
        matchId: m.matchId,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        division: m.division,
        round: m.round,
        finished: m.finished,
        datetime: m.datetime,
        homeScore: s?.homeScore,
        awayScore: s?.awayScore,
      };
    }

    // Only treat this as a good read if the arusa score scrape actually
    // returned scores; otherwise fall back to the last captured snapshot.
    const withScores = finished.filter((m) => scores.get(m.matchId)?.homeScore != null).length;
    if (withScores === 0) throw new Error("no scores from arusa");

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
      reply.header("Cache-Control", "public, max-age=60");
      return out;
    } catch {
      reply.status(503).send({ error: "Tournament data unavailable" });
    }
  });

  // GET /api/v1/leverade/standings?division=PRIMERA — parsed standings rows
  app.get("/leverade/standings", async (req, reply) => {
    const division = resolveDivision((req.query as any)?.division);
    const rows = await fetchStandings(division);
    if (!rows) return reply.status(503).send({ error: "Standings unavailable" });
    reply.header("Cache-Control", "public, max-age=60");
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
    if (!home || !away) return reply.status(400).send({ error: "home and away are required" });

    let meta: MatchMeta[];
    try {
      meta = await fetchAllMatchesMeta();
    } catch {
      return { finished: false, events: [], homeScore: undefined, awayScore: undefined };
    }
    const m = meta.find(
      (x) => x.division === division &&
        ((x.homeTeam === home && x.awayTeam === away) || (x.homeTeam === away && x.awayTeam === home)),
    );
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
      };
    });

    return {
      finished: m.finished,
      homeScore: reversed ? score.awayScore : score.homeScore,
      awayScore: reversed ? score.homeScore : score.awayScore,
      referees,
      events: oriented,
    };
  });
}
