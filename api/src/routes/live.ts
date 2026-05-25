import { FastifyInstance } from "fastify";
import { randomBytes } from "crypto";
import { db } from "../db";
import { liveMatches, liveEvents } from "../db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { getUserFromRequest } from "./auth";

export async function liveRoutes(app: FastifyInstance) {
  // GET /api/v1/live — all active matches
  app.get("/live", async () => {
    const matches = await db
      .select()
      .from(liveMatches)
      .where(inArray(liveMatches.status, ["LIVE", "HT", "SCHEDULED"]))
      .orderBy(desc(liveMatches.createdAt));

    const events = matches.length
      ? await db
          .select()
          .from(liveEvents)
          .where(inArray(liveEvents.matchId, matches.map((m) => m.id)))
          .orderBy(liveEvents.minute)
      : [];

    return matches.map((m) => ({
      ...m,
      events: events.filter((e) => e.matchId === m.id),
    }));
  });

  // GET /api/v1/live/finished — recent finished matches
  app.get("/live/finished", async () => {
    const matches = await db
      .select()
      .from(liveMatches)
      .where(eq(liveMatches.status, "FINISHED"))
      .orderBy(desc(liveMatches.createdAt))
      .limit(10);

    const events = matches.length
      ? await db
          .select()
          .from(liveEvents)
          .where(inArray(liveEvents.matchId, matches.map((m) => m.id)))
          .orderBy(liveEvents.minute)
      : [];

    return matches.map((m) => ({
      ...m,
      events: events.filter((e) => e.matchId === m.id),
    }));
  });

  // POST /api/v1/live/matches — create a match (admin)
  app.post<{
    Body: {
      homeTeam: string;
      awayTeam: string;
      division: string;
      venue?: string;
    };
  }>("/live/matches", async (req) => {
    const { homeTeam, awayTeam, division, venue = "" } = req.body;
    const [match] = await db
      .insert(liveMatches)
      .values({ homeTeam, awayTeam, division, venue, status: "SCHEDULED" })
      .returning();
    return match;
  });

  // DELETE /api/v1/live/matches/:id — remove a match (admin)
  app.delete<{ Params: { id: string } }>("/live/matches/:id", async (req) => {
    await db.delete(liveMatches).where(eq(liveMatches.id, req.params.id));
    return { ok: true };
  });

  // POST /api/v1/live/matches/:id/scorer-token — generate a scorer token (admin)
  app.post<{ Params: { id: string } }>("/live/matches/:id/scorer-token", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const token = randomBytes(24).toString("hex"); // 48-char hex
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    const [updated] = await db
      .update(liveMatches)
      .set({ scorerToken: token, scorerTokenExpiresAt: expiresAt, updatedAt: new Date() })
      .where(eq(liveMatches.id, req.params.id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Match not found" });
    return { token, expiresAt };
  });

  // GET /api/v1/scorer/:token — get match info for scorer PWA (public)
  app.get<{ Params: { token: string } }>("/scorer/:token", async (req, reply) => {
    const [match] = await db
      .select()
      .from(liveMatches)
      .where(eq(liveMatches.scorerToken, req.params.token));

    if (!match) return reply.status(404).send({ error: "Token inválido" });
    if (match.scorerTokenExpiresAt && match.scorerTokenExpiresAt < new Date()) {
      return reply.status(410).send({ error: "Token expirado" });
    }

    const events = await db.select().from(liveEvents).where(eq(liveEvents.matchId, match.id));
    return { ...match, events };
  });

  // POST /api/v1/scorer/:token/event — add scoring event via scorer token (public)
  app.post<{
    Params: { token: string };
    Body: {
      team: "home" | "away";
      type: "TRY" | "CONVERSION" | "PENALTY" | "DROP_GOAL" | "YELLOW_CARD" | "RED_CARD";
      minute: number;
      playerName?: string;
    };
  }>("/scorer/:token/event", async (req, reply) => {
    const [match] = await db
      .select()
      .from(liveMatches)
      .where(eq(liveMatches.scorerToken, req.params.token));

    if (!match) return reply.status(404).send({ error: "Token inválido" });
    if (match.scorerTokenExpiresAt && match.scorerTokenExpiresAt < new Date()) {
      return reply.status(410).send({ error: "Token expirado" });
    }
    if (match.status === "FINISHED") {
      return reply.status(400).send({ error: "El partido ya terminó" });
    }

    const POINTS: Record<string, number> = {
      TRY: 5, CONVERSION: 2, PENALTY: 3, DROP_GOAL: 3, YELLOW_CARD: 0, RED_CARD: 0,
    };
    const points = POINTS[req.body.type] ?? 0;

    await db.insert(liveEvents).values({
      matchId: match.id,
      team: req.body.team,
      type: req.body.type,
      minute: req.body.minute,
      playerName: req.body.playerName ?? null,
      points,
    });

    const isHome = req.body.team === "home";
    const isTry = req.body.type === "TRY";
    const [updated] = await db
      .update(liveMatches)
      .set({
        homeScore: isHome ? match.homeScore + points : match.homeScore,
        awayScore: !isHome ? match.awayScore + points : match.awayScore,
        homeTries: isHome && isTry ? match.homeTries + 1 : match.homeTries,
        awayTries: !isHome && isTry ? match.awayTries + 1 : match.awayTries,
        updatedAt: new Date(),
      })
      .where(eq(liveMatches.id, match.id))
      .returning();

    const events = await db.select().from(liveEvents).where(eq(liveEvents.matchId, match.id));
    const payload = { ...updated, events };

    // Broadcast via Socket.IO if available
    const { getIo } = await import("../plugins/live");
    getIo()?.emit("match:update", payload);

    return payload;
  });

  // POST /api/v1/scorer/:token/status — update match status via scorer token
  app.post<{
    Params: { token: string };
    Body: { status: "LIVE" | "HT" | "FINISHED"; minute?: number };
  }>("/scorer/:token/status", async (req, reply) => {
    const [match] = await db
      .select()
      .from(liveMatches)
      .where(eq(liveMatches.scorerToken, req.params.token));

    if (!match) return reply.status(404).send({ error: "Token inválido" });
    if (match.scorerTokenExpiresAt && match.scorerTokenExpiresAt < new Date()) {
      return reply.status(410).send({ error: "Token expirado" });
    }

    const [updated] = await db
      .update(liveMatches)
      .set({
        status: req.body.status,
        minute: req.body.minute ?? match.minute,
        updatedAt: new Date(),
      })
      .where(eq(liveMatches.id, match.id))
      .returning();

    const events = await db.select().from(liveEvents).where(eq(liveEvents.matchId, match.id));
    const payload = { ...updated, events };

    const { getIo } = await import("../plugins/live");
    getIo()?.emit("match:update", payload);

    return payload;
  });
}
