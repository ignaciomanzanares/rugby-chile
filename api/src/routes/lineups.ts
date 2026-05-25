import { FastifyInstance } from "fastify";
import { db } from "../db";
import { matchLineups, users } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { getUserFromRequest } from "./auth";
import { crawlLineups } from "../services/lineupCrawler";

export async function lineupsRoutes(app: FastifyInstance) {
  // GET a lineup for a specific match
  app.get("/lineups", async (req, reply) => {
    const { division, round, home, away } = req.query as Record<string, string>;
    if (!division || !round || !home || !away) {
      return reply.status(400).send({ error: "division, round, home, away are required" });
    }

    const row = await db.query.matchLineups.findFirst({
      where: and(
        eq(matchLineups.division, division),
        eq(matchLineups.round, parseInt(round)),
        eq(matchLineups.homeTeam, home),
        eq(matchLineups.awayTeam, away),
      ),
    });

    return reply.send(row ?? null);
  });

  // Upsert a lineup (admin only)
  app.put("/lineups", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "No autorizado" });
    const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (me?.role !== "ADMIN") return reply.status(403).send({ error: "Solo administradores" });

    const { division, round, homeTeam, awayTeam, homeStarters, homeSubs, awayStarters, awaySubs } =
      req.body as {
        division: string;
        round: number;
        homeTeam: string;
        awayTeam: string;
        homeStarters?: string[];
        homeSubs?: string[];
        awayStarters?: string[];
        awaySubs?: string[];
      };

    if (!division || !round || !homeTeam || !awayTeam) {
      return reply.status(400).send({ error: "division, round, homeTeam, awayTeam are required" });
    }

    const existing = await db.query.matchLineups.findFirst({
      where: and(
        eq(matchLineups.division, division),
        eq(matchLineups.round, round),
        eq(matchLineups.homeTeam, homeTeam),
        eq(matchLineups.awayTeam, awayTeam),
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(matchLineups)
        .set({
          homeStarters: homeStarters ?? null,
          homeSubs: homeSubs ?? null,
          awayStarters: awayStarters ?? null,
          awaySubs: awaySubs ?? null,
          updatedAt: new Date(),
        })
        .where(eq(matchLineups.id, existing.id))
        .returning();
      return reply.send(updated);
    }

    const [created] = await db
      .insert(matchLineups)
      .values({ division, round, homeTeam, awayTeam, homeStarters, homeSubs, awayStarters, awaySubs })
      .returning();
    return reply.status(201).send(created);
  });

  // Manually trigger lineup crawl (admin only)
  app.post("/lineups/crawl", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "No autorizado" });
    const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (me?.role !== "ADMIN") return reply.status(403).send({ error: "Solo administradores" });

    // Run in background, return immediately
    crawlLineups()
      .then((r) => console.log("[lineups/crawl] Done:", r))
      .catch(console.error);

    return reply.send({ ok: true, message: "Crawl iniciado en background" });
  });

  // DELETE a lineup (admin only)
  app.delete("/lineups", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "No autorizado" });
    const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (me?.role !== "ADMIN") return reply.status(403).send({ error: "Solo administradores" });

    const { division, round, home, away } = req.query as Record<string, string>;
    if (!division || !round || !home || !away) {
      return reply.status(400).send({ error: "division, round, home, away are required" });
    }

    await db.delete(matchLineups).where(
      and(
        eq(matchLineups.division, division),
        eq(matchLineups.round, parseInt(round)),
        eq(matchLineups.homeTeam, home),
        eq(matchLineups.awayTeam, away),
      ),
    );

    return reply.send({ ok: true });
  });
}
