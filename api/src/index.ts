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
import { crawlLineups } from "./services/lineupCrawler";
import { createSocketServer } from "./plugins/live";
import { scrapeNews } from "./services/newsScraper";
import { seedFixtures } from "./services/seedFixtures";
import { pollLeverade } from "./services/leveradePoller";

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

  await app.ready();

  // Attach Socket.IO to Fastify's own HTTP server after ready
  createSocketServer(app.server, WEB_URL);

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`\n🏉  Rugby Chile API ready at http://localhost:${PORT}`);
  console.log(`⚡  Socket.IO live scoring active`);
  console.log(`📡  CORS allowed for ${WEB_URL}\n`);

  // Seed fixtures once on startup
  seedFixtures().catch(console.error);

  // Scrape news immediately on startup, then every 6 hours
  scrapeNews().catch(console.error);
  cron.schedule("0 */6 * * *", () => {
    scrapeNews().catch(console.error);
  });

  // Crawl Instagram for lineups at 09:00, 13:00, and 18:00 Chile time (UTC-4 → UTC+0 = add 4h)
  // Thu–Sun (4,5,6,0) to cover the 3-day window before/during weekend matches
  for (const hour of ["13", "17", "22"]) {
    cron.schedule(`0 ${hour} * * 4,5,6,0`, () => {
      crawlLineups().catch(console.error);
    });
  }

  // Leverade auto-score poller — every 60 seconds on Sat+Sun during match hours (12:00–22:00 Chile = 16:00–02:00 UTC)
  // Also runs on match creation days Thu+Fri to auto-create records
  cron.schedule("* * * * 4,5,6,0", () => {
    pollLeverade().catch(console.error);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
