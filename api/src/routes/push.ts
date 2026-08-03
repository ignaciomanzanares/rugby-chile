import { FastifyInstance } from "fastify";
import { db } from "../db";
import { pushSubscriptions, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { getUserFromRequest } from "./auth";
import { vapidPublicKey, pushEnabled, sendPushToAll } from "../services/push";

type IncomingSub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function pushRoutes(app: FastifyInstance) {
  // La web pide la llave pública acá (evita configurar env en Vercel).
  app.get("/push/public-key", async (_req, reply) => {
    return reply.send({ key: vapidPublicKey(), enabled: pushEnabled });
  });

  app.post("/push/subscribe", async (req, reply) => {
    const { subscription } = (req.body ?? {}) as { subscription?: IncomingSub };
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return reply.status(400).send({ error: "Suscripción inválida" });
    }
    const userId = getUserFromRequest(req as any); // puede ser null (visitante)
    await db
      .insert(pushSubscriptions)
      .values({ endpoint, p256dh, auth, userId: userId ?? null })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { p256dh, auth, userId: userId ?? null },
      });
    return reply.send({ ok: true });
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
