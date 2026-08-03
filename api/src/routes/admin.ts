import { FastifyInstance } from "fastify";
import { db } from "../db";
import { users, predictions, predictionFixtures, fantasySquads, liveMatches } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getUserFromRequest } from "./auth";
import { fetchAllResults } from "./leveradeResults";

// Verifica que el request venga de un ADMIN. Devuelve el userId o manda la
// respuesta de error y retorna null.
async function requireAdmin(req: any, reply: any): Promise<string | null> {
  const userId = getUserFromRequest(req);
  if (!userId) {
    reply.status(401).send({ error: "No autorizado" });
    return null;
  }
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  if (me?.role !== "ADMIN") {
    reply.status(403).send({ error: "Solo administradores" });
    return null;
  }
  return userId;
}

// Panel de admin: resumen de usuarios y actividad. Solo ADMIN.
export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/overview", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;

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

    // Fecha actual: máxima ronda con resultado en el scrape (best-effort; si el
    // scrape está caído, queda null y el front lo oculta).
    let currentRound: number | null = null;
    try {
      const results = await fetchAllResults();
      const rounds = Object.values(results)
        .map((r) => (r as { round?: number }).round)
        .filter((n): n is number => typeof n === "number");
      if (rounds.length) currentRound = Math.max(...rounds);
    } catch {
      /* scrape no disponible */
    }

    const [live] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(liveMatches)
      .where(eq(liveMatches.status, "LIVE"));

    return reply.send({
      users: userList,
      counts: {
        users: userList.length,
        predictions: pred?.total ?? 0,
        predictors: pred?.predictors ?? 0,
        fantasySquads: squads?.total ?? 0,
        currentRound,
        live: live?.n ?? 0,
      },
      predictionsByRound: byRound,
    });
  });

  // Cambiar el rol de un usuario (promover/quitar admin). Solo ADMIN.
  app.post("/admin/users/:id/role", async (req, reply) => {
    const meId = await requireAdmin(req, reply);
    if (!meId) return;

    const { id } = req.params as { id: string };
    const { role } = req.body as { role?: string };
    if (role !== "ADMIN" && role !== "USER") {
      return reply.status(400).send({ error: "Rol inválido" });
    }
    // No permitir que un admin se quite el admin a sí mismo (evita quedarse sin
    // ningún administrador por accidente).
    if (id === meId && role !== "ADMIN") {
      return reply.status(400).send({ error: "No puedes quitarte admin a ti mismo" });
    }

    const [updated] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
      .returning({ id: users.id, role: users.role });
    if (!updated) return reply.status(404).send({ error: "Usuario no encontrado" });

    return reply.send({ ok: true, id: updated.id, role: updated.role });
  });
}
