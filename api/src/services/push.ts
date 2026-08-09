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

// Categorías válidas para las preferencias de push.
export type DivisionPref = "primera" | "intermedia" | "pre";
export const ALL_DIVISIONS: DivisionPref[] = ["primera", "intermedia", "pre"];

// Normaliza cualquier etiqueta de división (scrape o live) a la clave de pref.
export function normDivision(raw?: string | null): DivisionPref | null {
  if (!raw) return null;
  const s = raw.toUpperCase();
  if (s.includes("PRE")) return "pre";
  if (s.includes("INTER")) return "intermedia";
  if (s.includes("PRIMERA")) return "primera";
  return null;
}

export const DIVISION_LABEL: Record<DivisionPref, string> = {
  primera: "Primera",
  intermedia: "Intermedia",
  pre: "Pre-Intermedia",
};

// Etiqueta bonita de la categoría para el texto de las notificaciones
// (Primera / Intermedia / Pre-Intermedia), o null si no se reconoce.
export function divisionLabel(raw?: string | null): string | null {
  const d = normDivision(raw);
  return d ? DIVISION_LABEL[d] : null;
}

// Crea la tabla si no existe (idempotente) y agrega la columna divisions si
// falta (para tablas ya creadas antes de esta feature). Se llama al boot.
export async function ensurePushTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      endpoint text NOT NULL UNIQUE,
      p256dh text NOT NULL,
      auth text NOT NULL,
      divisions jsonb NOT NULL DEFAULT '["primera","intermedia","pre"]'::jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    ALTER TABLE push_subscriptions
    ADD COLUMN IF NOT EXISTS divisions jsonb NOT NULL DEFAULT '["primera","intermedia","pre"]'::jsonb
  `);
  await db.execute(sql`
    ALTER TABLE push_subscriptions
    ADD COLUMN IF NOT EXISTS clubs jsonb NOT NULL DEFAULT '[]'::jsonb
  `);
}

export type PushPayload = { title: string; body?: string; url?: string; tag?: string; icon?: string };

// Envía a las suscripciones. Con `division`/`teamSlugs` (partido) filtra: una
// suscripción recibe si tiene la división en sus categorías O sigue a uno de los
// clubes del partido. Sin opts (p. ej. broadcast admin) va a todas. Borra las
// expiradas (404/410). Devuelve conteos.
export async function sendPushToAll(
  payload: PushPayload,
  opts?: { division?: DivisionPref; teamSlugs?: string[] },
) {
  if (!pushEnabled) return { sent: 0, pruned: 0, total: 0 };
  const all = await db.select().from(pushSubscriptions);
  const { division, teamSlugs } = opts ?? {};
  const filtering = Boolean(division || (teamSlugs && teamSlugs.length));
  const subs = filtering
    ? all.filter((s) => {
        const prefs = Array.isArray(s.divisions) ? s.divisions : [];
        const clubs = Array.isArray(s.clubs) ? s.clubs : [];
        const divMatch = division ? prefs.includes(division) : false;
        const clubMatch = Boolean(teamSlugs && teamSlugs.some((t) => clubs.includes(t)));
        return divMatch || clubMatch;
      })
    : all;
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
