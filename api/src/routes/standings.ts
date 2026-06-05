import { FastifyInstance } from "fastify";
import { db } from "../db";
import { standings, teams, clubs } from "../db/schema";
import { eq, asc } from "drizzle-orm";
import { computeStandings, type DivisionKey } from "../services/computeStandings";
import { computeTeamForm } from "../services/computeForm";
import { computeH2H } from "../services/computeH2H";

const DIVISION_KEYS: DivisionKey[] = ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"];

const resolveDivision = (raw: unknown): DivisionKey => {
  const s = String(raw ?? "PRIMERA").toUpperCase();
  return (DIVISION_KEYS.includes(s as DivisionKey) ? s : "PRIMERA") as DivisionKey;
};

export async function standingsRoutes(app: FastifyInstance) {
  // GET /api/v1/standings/computed?division=PRIMERA — name-keyed table derived
  // from the Fecha-4 baseline + FINISHED live_matches. This is what the
  // standings page reads as its base; it advances permanently as matches finish.
  app.get("/standings/computed", async (req) => {
    const division = resolveDivision((req.query as Record<string, string>)?.division);
    const rows = await computeStandings(division);
    return { division, rows };
  });

  // GET /api/v1/form?division=PRIMERA — each team's recent results (newest
  // first), keyed by team name. Feeds the standings form column and the
  // match-sheet head-to-head.
  app.get("/form", async (req) => {
    const division = resolveDivision((req.query as Record<string, string>)?.division);
    const teams = await computeTeamForm(division);
    return { division, teams };
  });

  // GET /api/v1/h2h?division=PRIMERA&a=Old Reds&b=COBS — head-to-head history
  // across all Primera seasons (2021–2026): past meetings + summary record.
  app.get("/h2h", async (req, reply) => {
    const q = req.query as Record<string, string>;
    const division = resolveDivision(q.division);
    if (!q.a || !q.b) return reply.status(400).send({ error: "a and b are required" });
    const h2h = await computeH2H(division, q.a, q.b);
    reply.header("Cache-Control", "public, max-age=300");
    return h2h;
  });

  app.get("/standings", async (req, reply) => {
    const { division = "PRIMERA", season = "2026" } = req.query as Record<string, string>;

    const rows = await db
      .select({
        position: standings.position,
        played: standings.played,
        won: standings.won,
        drawn: standings.drawn,
        lost: standings.lost,
        pointsFor: standings.pointsFor,
        pointsAgainst: standings.pointsAgainst,
        pointsDifference: standings.pointsDifference,
        triesFor: standings.triesFor,
        tryBonus: standings.tryBonusPoints,
        losingBonus: standings.losingBonusPoints,
        totalPoints: standings.totalPoints,
        clubName: clubs.name,
        clubShort: clubs.shortName,
        clubSlug: clubs.slug,
        clubPrimaryColor: clubs.primaryColor,
        clubSecondaryColor: clubs.secondaryColor,
      })
      .from(standings)
      .innerJoin(teams, eq(standings.teamId, teams.id))
      .innerJoin(clubs, eq(teams.clubId, clubs.id))
      .where(eq(standings.division, division as "PRIMERA" | "INTERMEDIA" | "PRE_INTERMEDIA"))
      .orderBy(asc(standings.position));

    return reply.send(rows);
  });
}
