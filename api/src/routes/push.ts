import { FastifyInstance } from "fastify";
import { db } from "../db";
import { pushSubscriptions, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { getUserFromRequest } from "./auth";
import { vapidPublicKey, pushEnabled, sendPushToAll, ALL_DIVISIONS, type DivisionPref } from "../services/push";

type IncomingSub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

// Sanea la lista de categorías: solo valores válidos; si queda vacía → todas.
function cleanDivisions(input: unknown): DivisionPref[] {
  if (!Array.isArray(input)) return [...ALL_DIVISIONS];
  const valid = input.filter((d): d is DivisionPref => ALL_DIVISIONS.includes(d as DivisionPref));
  return valid.length > 0 ? valid : [...ALL_DIVISIONS];
}

export async function pushRoutes(app: FastifyInstance) {
  // La web pide la llave pública acá (evita configurar env en Vercel).
  app.get("/push/public-key", async (_req, reply) => {
    return reply.send({ key: vapidPublicKey(), enabled: pushEnabled });
  });

  app.post("/push/subscribe", async (req, reply) => {
    const { subscription, divisions } = (req.body ?? {}) as { subscription?: IncomingSub; divisions?: unknown };
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return reply.status(400).send({ error: "Suscripción inválida" });
    }
    const divs = cleanDivisions(divisions);
    const userId = getUserFromRequest(req as any); // puede ser null (visitante)
    await db
      .insert(pushSubscriptions)
      .values({ endpoint, p256dh, auth, userId: userId ?? null, divisions: divs })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { p256dh, auth, userId: userId ?? null, divisions: divs },
      });
    return reply.send({ ok: true, divisions: divs });
  });

  // Devuelve las categorías guardadas para un endpoint (o todas si no existe).
  app.get("/push/preferences", async (req, reply) => {
    const endpoint = (req.query as { endpoint?: string })?.endpoint;
    if (!endpoint) return reply.status(400).send({ error: "Falta endpoint" });
    const [row] = await db
      .select({ divisions: pushSubscriptions.divisions })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
    return reply.send({ divisions: row?.divisions ?? ALL_DIVISIONS, subscribed: Boolean(row) });
  });

  // Actualiza solo las categorías de una suscripción existente.
  app.post("/push/preferences", async (req, reply) => {
    const { endpoint, divisions } = (req.body ?? {}) as { endpoint?: string; divisions?: unknown };
    if (!endpoint) return reply.status(400).send({ error: "Falta endpoint" });
    const divs = cleanDivisions(divisions);
    await db.update(pushSubscriptions).set({ divisions: divs }).where(eq(pushSubscriptions.endpoint, endpoint));
    return reply.send({ ok: true, divisions: divs });
  });

  app.post("/push/unsubscribe", async (req, reply) => {
    const { endpoint } = (req.body ?? {}) as { endpoint?: string };
    if (endpoint) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    return reply.send({ ok: true });
  });

  // Broadcast manual a todos (ADMIN). Sirve para avisos y para probar.
  app.post("/push/broadcast", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "No autorizado" });
    const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (me?.role !== "ADMIN") return reply.status(403).send({ error: "Solo administradores" });

    const { title, body, url } = (req.body ?? {}) as { title?: string; body?: string; url?: string };
    if (!title?.trim()) return reply.status(400).send({ error: "Falta el título" });
    const res = await sendPushToAll({ title: title.trim(), body: body?.trim(), url });
    return reply.send({ ok: true, ...res });
  });
}
