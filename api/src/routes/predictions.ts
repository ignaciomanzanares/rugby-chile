import type { FastifyInstance } from "fastify";
import { db } from "../db";
import { predictions, predictionFixtures, users } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getUserFromRequest } from "./auth";
import { getSeasonProjection } from "../services/simulateSeason";
import { getModelAccuracy } from "../services/validateModel";

// ── Scoring ─────────────────────────────────────────────────────────────────
export function calcPoints(
  predHome: number, predAway: number,
  actualHome: number, actualAway: number,
): number {
  // Exact score
  if (predHome === actualHome && predAway === actualAway) return 5;

  const predWinner = predHome > predAway ? "H" : predAway > predHome ? "A" : "D";
  const actualWinner = actualHome > actualAway ? "H" : actualAway > actualHome ? "A" : "D";

  if (predWinner !== actualWinner) return 0;

  // Correct winner — check diff
  const predDiff = Math.abs(predHome - predAway);
  const actualDiff = Math.abs(actualHome - actualAway);
  if (Math.abs(predDiff - actualDiff) <= 3) return 3;

  return 2;
}

export async function predictionsRoutes(api: FastifyInstance) {
  // GET /predict/fixtures?round=5&season=2026
  api.get("/predict/fixtures", async (req, reply) => {
    const { round, season = 2026 } = req.query as { round?: string; season?: string };
    const userId = getUserFromRequest(req as any);

    let fixturesQuery = db.select().from(predictionFixtures)
      .where(eq(predictionFixtures.season, Number(season)))
      .orderBy(predictionFixtures.round, predictionFixtures.matchDate);

    if (round) {
      fixturesQuery = db.select().from(predictionFixtures)
        .where(and(
          eq(predictionFixtures.season, Number(season)),
          eq(predictionFixtures.round, Number(round)),
        ))
        .orderBy(predictionFixtures.matchDate);
    }

    const fixtures = await fixturesQuery;

    // Attach user's predictions if logged in
    let userPredictions: Record<string, { homeScore: number; awayScore: number; pointsEarned: number | null }> = {};
    if (userId) {
      const preds = await db.select().from(predictions).where(eq(predictions.userId, userId));
      for (const p of preds) {
        userPredictions[p.fixtureId] = { homeScore: p.homeScore, awayScore: p.awayScore, pointsEarned: p.pointsEarned };
      }
    }

    const result = fixtures.map((f) => ({
      ...f,
      prediction: userPredictions[f.id] ?? null,
    }));

    return reply.send(result);
  });

  // GET /predict/rounds — list available rounds, each flagged `completed` when
  // all its fixtures are final, so the client can default to the current
  // matchday (the first not-yet-completed round) instead of the last.
  api.get("/predict/rounds", async (_req, reply) => {
    const rows = await db
      .select({
        round: predictionFixtures.round,
        season: predictionFixtures.season,
        pending: sql<number>`count(*) filter (where ${predictionFixtures.status} <> 'COMPLETED')`,
      })
      .from(predictionFixtures)
      .groupBy(predictionFixtures.season, predictionFixtures.round)
      .orderBy(predictionFixtures.season, predictionFixtures.round);
    return reply.send(rows.map((r) => ({ round: r.round, season: r.season, completed: Number(r.pending) === 0 })));
  });

  // POST /predict — submit/update predictions for a round
  api.post("/predict", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "Debes iniciar sesión para predecir" });

    const { predictions: preds } = req.body as {
      predictions: Array<{ fixtureId: string; homeScore: number; awayScore: number }>;
    };
    if (!Array.isArray(preds) || preds.length === 0) {
      return reply.status(400).send({ error: "predictions array requerido" });
    }

    const saved = [];
    for (const p of preds) {
      const [fixture] = await db.select().from(predictionFixtures).where(eq(predictionFixtures.id, p.fixtureId));
      if (!fixture) continue;
      if (fixture.status === "LOCKED" || fixture.status === "COMPLETED") continue;

      // Upsert
      const [existing] = await db.select({ id: predictions.id })
        .from(predictions)
        .where(and(eq(predictions.userId, userId), eq(predictions.fixtureId, p.fixtureId)));

      if (existing) {
        const [updated] = await db.update(predictions)
          .set({ homeScore: p.homeScore, awayScore: p.awayScore, updatedAt: new Date() })
          .where(eq(predictions.id, existing.id))
          .returning();
        saved.push(updated);
      } else {
        const [created] = await db.insert(predictions)
          .values({ userId, fixtureId: p.fixtureId, homeScore: p.homeScore, awayScore: p.awayScore })
          .returning();
        saved.push(created);
      }
    }
    return reply.send({ saved: saved.length });
  });

  // POST /predict/results — admin: enter actual results + score predictions
  api.post("/predict/results", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "No autorizado" });

    const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (me?.role !== "ADMIN") return reply.status(403).send({ error: "Solo administradores" });

    const { fixtureId, homeScore, awayScore } = req.body as {
      fixtureId: string; homeScore: number; awayScore: number;
    };

    await db.update(predictionFixtures)
      .set({ homeScoreActual: homeScore, awayScoreActual: awayScore, status: "COMPLETED" })
      .where(eq(predictionFixtures.id, fixtureId));

    // Score all predictions for this fixture
    const preds = await db.select().from(predictions).where(eq(predictions.fixtureId, fixtureId));
    for (const p of preds) {
      const pts = calcPoints(p.homeScore, p.awayScore, homeScore, awayScore);
      await db.update(predictions).set({ pointsEarned: pts }).where(eq(predictions.id, p.id));
    }

    return reply.send({ scored: preds.length });
  });

  // GET /predict/leaderboard
  api.get("/predict/leaderboard", async (_req, reply) => {
    const rows = await db
      .select({
        userId: predictions.userId,
        name: users.name,
        email: users.email,
        // coalesce → 0: incluye también a quienes predijeron pero cuyos partidos
        // aún no se puntúan (pointsEarned null). Antes un `isNotNull` los dejaba
        // fuera de la tabla hasta que se jugara/puntuara su primer partido.
        totalPoints: sql<number>`coalesce(sum(${predictions.pointsEarned}), 0)`.as("total_points"),
        predictions: sql<number>`count(${predictions.id})`.as("predictions"),
        exact: sql<number>`count(case when ${predictions.pointsEarned} = 5 then 1 end)`.as("exact"),
        correct: sql<number>`count(case when ${predictions.pointsEarned} >= 2 then 1 end)`.as("correct"),
      })
      .from(predictions)
      .innerJoin(users, eq(predictions.userId, users.id))
      .groupBy(predictions.userId, users.name, users.email)
      .orderBy(
        desc(sql`coalesce(sum(${predictions.pointsEarned}), 0)`),
        desc(sql`count(case when ${predictions.pointsEarned} = 5 then 1 end)`),
      )
      .limit(50);

    return reply.send(rows.map((r, i) => ({ ...r, rank: i + 1 })));
  });

  // GET /predict/my — user's own predictions + points
  api.get("/predict/my", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "No autenticado" });

    const rows = await db
      .select({
        prediction: predictions,
        fixture: predictionFixtures,
      })
      .from(predictions)
      .innerJoin(predictionFixtures, eq(predictions.fixtureId, predictionFixtures.id))
      .where(eq(predictions.userId, userId))
      .orderBy(desc(predictionFixtures.round));

    const totalPoints = rows.reduce((s, r) => s + (r.prediction.pointsEarned ?? 0), 0);

    return reply.send({ predictions: rows, totalPoints });
  });

  // PATCH /predict/fixture/:id/lock — lock a fixture (admin)
  api.patch("/predict/fixture/:id/lock", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "No autorizado" });
    const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (me?.role !== "ADMIN") return reply.status(403).send({ error: "Solo administradores" });

    const { id } = req.params as { id: string };
    await db.update(predictionFixtures).set({ status: "LOCKED" }).where(eq(predictionFixtures.id, id));
    return reply.send({ ok: true });
  });

  // GET /predict/season — Monte Carlo projection of how the regular phase ends:
  // per-club title / playoff / repechaje / descenso odds and a full finishing
  // position distribution. Simulated from the current table + team ratings.
  api.get("/predict/season", async (req, reply) => {
    const q = req.query as { sims?: string };
    const sims = Math.max(2000, Math.min(100000, Number(q.sims) || 50000));
    try {
      const data = await getSeasonProjection(sims);
      reply.header("Cache-Control", "public, max-age=120");
      return reply.send(data);
    } catch (err) {
      req.log.error({ err }, "season projection failed");
      return reply.status(503).send({ error: "Proyección no disponible" });
    }
  });

  // GET /predict/accuracy — cómo le fue al modelo: para cada partido ya jugado,
  // el pronóstico reconstruido (sin fuga) vs. el resultado real, con resumen y
  // curva de calibración.
  api.get("/predict/accuracy", async (req, reply) => {
    const q = req.query as { since?: string };
    const since = Math.max(2021, Math.min(2026, Number(q.since) || 2025));
    try {
      const data = await getModelAccuracy(since);
      reply.header("Cache-Control", "public, max-age=300");
      return reply.send(data);
    } catch (err) {
      req.log.error({ err }, "model accuracy failed");
      return reply.status(503).send({ error: "Validación no disponible" });
    }
  });
}
