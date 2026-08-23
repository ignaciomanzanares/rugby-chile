import "dotenv/config";
import { createHash } from "crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import compress from "@fastify/compress";
import cron from "node-cron";
import { standingsRoutes } from "./routes/standings";
import { matchesRoutes } from "./routes/matches";
import { clubsRoutes } from "./routes/clubs";
import { statsRoutes } from "./routes/stats";
import { liveRoutes } from "./routes/live";
import { newsRoutes } from "./routes/news";
import { authRoutes } from "./routes/auth";
import { predictionsRoutes } from "./routes/predictions";
import { fantasyRoutes } from "./routes/fantasy";
import { lineupsRoutes } from "./routes/lineups";
import { leveradeResultsRoutes } from "./routes/leveradeResults";
import { resultsRoutes } from "./routes/results";
import { adminRoutes } from "./routes/admin";
import { pushRoutes } from "./routes/push";
import { ensurePushTable, pushEnabled } from "./services/push";
import { leaguesRoutes, ensureLeaguesTables } from "./routes/leagues";
import { createSocketServer } from "./plugins/live";
import { scrapeNews } from "./services/newsScraper";
import { syncPredictionFixtures } from "./services/syncPredictionFixtures";
import { pollLeverade, finalizeStaleMatches } from "./services/leveradePoller";
import { startArusaSync } from "./services/arusaSync";
import { prewarmSeasonHistory } from "./services/seasonHistory";
import { getSeasonProjection } from "./services/simulateSeason";
import { SCHEDULES } from "./config";

// The ten Primera clubs (canonical names) — used to warm the multi-season
// history cache at boot.
const PRIMERA_CLUBS = [
  "COBS", "Old Boys", "PWCC", "Old Macks", "Stade Francais",
  "Sporting RC", "DOBS", "UC", "Old Johns", "Old Reds",
];

const PORT = parseInt(process.env.PORT ?? "4000");
// WEB_URL may list several allowed origins (comma-separated) so a domain change
// (e.g. a new *.vercel.app alias) doesn't break the old links. Each is trimmed of
// a trailing slash: the CORS allow-origin must EXACTLY equal the browser's Origin
// header (which never has one), or cross-site requests + cookies silently fail.
const WEB_URLS = (process.env.WEB_URL ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

async function start() {
  // bodyLimit 8MB: el endpoint de lectura de nómina recibe la foto en base64.
  const app = Fastify({ logger: true, bodyLimit: 8 * 1024 * 1024 });

  await app.register(cors, {
    origin: WEB_URLS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  await app.register(cookie);

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // Diagnóstico de la DB: SELECT 1 y devuelve el error REAL de Postgres si falla
  // (para distinguir Neon suspendido / límite de cómputo / SSL / conexión).
  app.get("/health/db", async (_req, reply) => {
    const { checkDb } = await import("./db");
    const r = await checkDb();
    return reply.status(r.ok ? 200 : 503).send(r);
  });

  // API routes
  await app.register(async (api) => {
    // ETag + 304 para GET: ahorra bandwidth cuando el dato no cambió entre polls
    // (la mayoría del tiempo). El cliente usa `cache:"no-cache"` → revalida en
    // CADA request, así que la frescura es idéntica a antes; sólo se evita
    // reenviar el JSON completo cuando el hash coincide (respuesta 304 sin body).
    // Los endpoints con `public, max-age=…` (H2H, standings históricos) se dejan
    // como están; el resto (antes `no-store`) pasa a `no-cache` para que el
    // navegador guarde el ETag y pueda revalidar.
    api.addHook("onSend", async (req, reply, payload) => {
      if (req.method !== "GET" || reply.statusCode !== 200) return payload;
      if (typeof payload !== "string" || payload.length === 0) return payload;

      const cc = reply.getHeader("cache-control");
      if (!cc || String(cc).includes("no-store")) {
        reply.header("Cache-Control", "no-cache");
      }

      const etag = `"${createHash("sha1").update(payload).digest("base64")}"`;
      reply.header("ETag", etag);

      // Comparación débil: @fastify/compress marca el ETag como débil (`W/"…"`)
      // cuando comprime, y el navegador nos lo reenvía así en If-None-Match. Si
      // comparáramos crudo (`W/"x" === "x"`) el 304 NUNCA matchearía con
      // compresión activa. Normalizamos el prefijo `W/` en ambos lados (y toleramos
      // listas separadas por coma).
      const inm = req.headers["if-none-match"];
      if (inm) {
        const norm = (s: string) => s.trim().replace(/^W\//, "");
        const target = norm(etag);
        if (inm.split(",").some((t) => norm(t) === target)) {
          reply.code(304);
          return ""; // 304 Not Modified: sin cuerpo
        }
      }
      return payload;
    });

    // Compresión gzip/brotli. Se registra DESPUÉS del hook de ETag para que el
    // orden de onSend sea: ETag (sobre el JSON crudo, así el 304 sigue matcheando)
    // → compresión. Sólo comprime respuestas > 1KB con Accept-Encoding; el
    // grueso del bandwidth es JSON (stats, tabla, resultados) → baja ~70-80%.
    await api.register(compress, { global: true, threshold: 1024 });

    await standingsRoutes(api);
    await matchesRoutes(api);
    await clubsRoutes(api);
    await statsRoutes(api);
    await liveRoutes(api);
    await newsRoutes(api);
    await authRoutes(api);
    await predictionsRoutes(api);
    await fantasyRoutes(api);
    await lineupsRoutes(api);
    await leveradeResultsRoutes(api);
    await resultsRoutes(api);
    await adminRoutes(api);
    await pushRoutes(api);
    await leaguesRoutes(api);
  }, { prefix: "/api/v1" });

  // Crea la tabla de suscripciones push si no existe (idempotente).
  await ensurePushTable().catch((e) => console.error("ensurePushTable:", e));
  // Crea las tablas de ligas si no existen (idempotente).
  await ensureLeaguesTables().catch((e) => console.error("ensureLeaguesTables:", e));

  await app.ready();

  // Attach Socket.IO to Fastify's own HTTP server after ready
  createSocketServer(app.server, WEB_URLS);

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`\n🏉  Rugby Chile API ready at http://localhost:${PORT}`);
  console.log(`⚡  Socket.IO live scoring active`);
  console.log(`📡  CORS allowed for ${WEB_URLS.join(", ")}`);
  console.log(`🔔  Push notifications ${pushEnabled ? "enabled" : "DISABLED (set VAPID_* env)"}\n`);

  // Cron schedules live in api/src/config.ts (SCHEDULES), not as string literals
  // here, so every scheduled job is auditable in one place.

  // Keep the predictions game in sync with the live Leverade feed (all rounds,
  // real dates + results) — once on startup, then on schedule.
  syncPredictionFixtures().catch(console.error);
  cron.schedule(SCHEDULES.syncPredictionFixtures, () => {
    syncPredictionFixtures().catch(console.error);
  });

  // Warm-sync arusa standings/results into the DB cache whenever it's reachable,
  // so the site keeps serving the latest real data through arusa outages.
  startArusaSync();

  // Build the multi-season history (H2H + past-season strength) in the
  // background so the season projection carries it without blocking requests.
  prewarmSeasonHistory(PRIMERA_CLUBS);

  // Calienta la proyección Monte Carlo tras el arranque (fire-and-forget), para
  // que el primer request al home no espere los ~7s del cálculo. Damos margen a
  // que arusaSync + el historial dejen la tabla/resultados listos. De ahí en más
  // el SWR de getSeasonProjection la mantiene fresca sin bloquear a nadie.
  setTimeout(() => void getSeasonProjection().catch(() => {}), 20_000);

  // Scrape news immediately on startup, then on schedule.
  scrapeNews().catch(console.error);
  cron.schedule(SCHEDULES.scrapeNews, () => {
    scrapeNews().catch(console.error);
  });

  // NB: NO hacemos un backfill masivo de eventos en el arranque. Scrapear ~215
  // partidos seguidos gatilla el ban por IP de arusa (que dura horas) y bloquea el
  // en vivo. El minuto a minuto se rellena solo, de a 12 por llamada, vía el tope
  // de batchScrapeTries (scrapeArusaEvents persiste al obtener). Para forzar el
  // backfill se corre scripts/backfillEvents.ts desde una IP no baneada.

  // Leverade auto-score poller — every minute Thu–Sun (match creation + live days).
  cron.schedule(SCHEDULES.pollLeverade, () => {
    pollLeverade().catch(console.error);
  });

  // Finalize abandoned LIVE/HT matches — the poller only runs Thu–Sun, so a
  // match left "EN VIVO" after the weekend needs a periodic sweep to flip to FINAL.
  finalizeStaleMatches().catch(console.error);
  cron.schedule(SCHEDULES.finalizeStaleMatches, () => {
    finalizeStaleMatches().catch(console.error);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
