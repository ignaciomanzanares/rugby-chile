import webpush from "web-push";
import { sql, eq } from "drizzle-orm";
import { db } from "../db";
import { pushSubscriptions } from "../db/schema";

const PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:ignacio.manzanares00@gmail.com";

// Push queda deshabilitado (endpoints responden pero no envían) si faltan las
// llaves VAPID, así la API no crashea sin la config.
export const pushEnabled = Boolean(PUBLIC && PRIVATE);
if (pushEnabled) webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);

export function vapidPublicKey() {
  return PUBLIC;
}

// Crea la tabla si no existe (idempotente). Se llama al boot de la API para no
// depender de coordinar migraciones contra Neon.
export async function ensurePushTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      endpoint text NOT NULL UNIQUE,
      p256dh text NOT NULL,
      auth text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
}

export type PushPayload = { title: string; body?: string; url?: string; tag?: string; icon?: string };

// Envía a todas las suscripciones. Borra las expiradas (404/410) para no
// acumular basura. Devuelve conteos.
export async function sendPushToAll(payload: PushPayload) {
  if (!pushEnabled) return { sent: 0, pruned: 0, total: 0 };
  const subs = await db.select().from(pushSubscriptions);
  const data = JSON.stringify(payload);
  let sent = 0;
  let pruned = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data);
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
          pruned++;
        }
      }
    }),
  );
  return { sent, pruned, total: subs.length };
}
