import { FastifyInstance } from "fastify";
import {
  type DivisionKey,
  type MatchMeta,
  DIVISION_TO_GROUP,
  fetchAllMatchesMeta,
  fetchStandings,
  batchScrapeScores,
  resolveDivision,
} from "../lib/leverade";

export interface MatchResult {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  division: DivisionKey;
  finished: boolean;
  homeScore?: number;
  awayScore?: number;
  datetime: string | null;
}

// Combined results cache — short TTL because today's matches transition from
// in-progress to finished and we want that picked up quickly.
let combinedCache: { data: Record<string, MatchResult>; ts: number } | null = null;
const COMBINED_TTL = 60 * 1000;

async function fetchAllResults(): Promise<Record<string, MatchResult>> {
  if (combinedCache && Date.now() - combinedCache.ts < COMBINED_TTL) {
    return combinedCache.data;
  }

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
      finished: m.finished,
      datetime: m.datetime,
      homeScore: s?.homeScore,
      awayScore: s?.awayScore,
    };
  }

  combinedCache = { data: results, ts: Date.now() };
  return results;
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
}
