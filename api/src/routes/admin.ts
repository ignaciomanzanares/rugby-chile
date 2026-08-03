import { FastifyInstance } from "fastify";
import { db } from "../db";
import { users, predictions, predictionFixtures, fantasySquads } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getUserFromRequest } from "./auth";

// Panel de admin: resumen de usuarios y actividad. Solo ADMIN.
export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/overview", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "No autorizado" });
    const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (me?.role !== "ADMIN") return reply.status(403).send({ error: "Solo administradores" });

    // Lista de usuarios (sin password_hash), más nuevo primero.
    const userList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    const [pred] = await db
      .select({
        total: sql<number>`count(*)::int`,
        predictors: sql<number>`count(distinct ${predictions.userId})::int`,
      })
      .from(predictions);

    const [squads] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(fantasySquads);

    // Predicciones por fecha (join a fixtures para sacar el round).
    const byRound = await db
      .select({
        round: predictionFixtures.round,
        predictions: sql<number>`count(${predictions.id})::int`,
        users: sql<number>`count(distinct ${predictions.userId})::int`,
      })
      .from(predictions)
      .innerJoin(predictionFixtures, eq(predictions.fixtureId, predictionFixtures.id))
      .groupBy(predictionFixtures.round)
      .orderBy(predictionFixtures.round);

    return reply.send({
      users: userList,
      counts: {
        users: userList.length,
        predictions: pred?.total ?? 0,
        predictors: pred?.predictors ?? 0,
        fantasySquads: squads?.total ?? 0,
      },
      predictionsByRound: byRound,
    });
  });
}
