import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
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
import { scrapeUpcomingLineups } from "./services/scrapeUpcomingLineups";
import { createSocketServer } from "./plugins/live";
import { scrapeNews } from "./services/newsScraper";
import { syncPredictionFixtures } from "./services/syncPredictionFixtures";
import { pollLeverade, finalizeStaleMatches } from "./services/leveradePoller";
import { startArusaSync } from "./services/arusaSync";
import { prewarmSeasonHistory } from "./services/seasonHistory";

// The ten Primera clubs (canonical names) — used to warm the multi-season
// history cache at boot.
const PRIMERA_CLUBS = [
  "COBS", "Old Boys", "PWCC", "Old Macks", "Stade Francais",
  "Sporting RC", "DOBS", "UC", "Old Johns", "Old Reds",
];

const PORT = parseInt(process.env.PORT ?? "4000");
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

async function start() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: WEB_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });

  await app.register(cookie);

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // API routes
  await app.register(async (api) => {
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
  }, { prefix: "/api/v1" });

  // Liveness probe — no DB, for Render's health check and a keep-awake ping.
  app.get("/health", async () => ({ ok: true, ts: Date.now() }));

  await app.ready();

  // Attach Socket.IO to Fastify's own HTTP server after ready
  createSocketServer(app.server, WEB_URL);

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`\n🏉  Rugby Chile API ready at http://localhost:${PORT}`);
  console.log(`⚡  Socket.IO live scoring active`);
  console.log(`📡  CORS allowed for ${WEB_URL}\n`);

  // Keep the predictions game in sync with the live Leverade feed (all rounds,
  // real dates + results) — once on startup, then every 15 minutes.
  syncPredictionFixtures().catch(console.error);
  cron.schedule("*/15 * * * *", () => {
    syncPredictionFixtures().catch(console.error);
  });

  // Warm-sync arusa standings/results into the DB cache whenever it's reachable,
  // so the site keeps serving the latest real data through arusa outages.
  startArusaSync();

  // Build the multi-season history (H2H + past-season strength) in the
  // background so the season projection carries it without blocking requests.
  prewarmSeasonHistory(PRIMERA_CLUBS);

  // Scrape news immediately on startup, then every 6 hours
  scrapeNews().catch(console.error);
  cron.schedule("0 */6 * * *", () => {
    scrapeNews().catch(console.error);
  });

  // Scrape Instagram for the upcoming matchday's nómina graphics on Friday and
  // Saturday (Chile UTC-4 → +4h), at 10:00 / 14:00 / 18:00 Chile, so the
  // match-detail sheet can show the formation for the match you're about to watch.
  if ([5, 6].includes(new Date().getUTCDay())) scrapeUpcomingLineups().catch(console.error);  // boot-run only Fri/Sat
  cron.schedule("0 14,18,22 * * 5,6", () => {
    scrapeUpcomingLineups().catch(console.error);
  });

  // Leverade auto-score poller — every 60 seconds on Sat+Sun during match hours (12:00–22:00 Chile = 16:00–02:00 UTC)
  // Also runs on match creation days Thu+Fri to auto-create records
  cron.schedule("* * * * 4,5,6,0", () => {
    pollLeverade().catch(console.error);
  });

  // Finalize abandoned LIVE/HT matches — the poller only runs Thu–Sun, so a
  // match left "EN VIVO" after the weekend needs a daily sweep to flip to FINAL.
  // Run once on startup and every 15 minutes, every day.
  finalizeStaleMatches().catch(console.error);
  cron.schedule("*/15 * * * *", () => {
    finalizeStaleMatches().catch(console.error);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
