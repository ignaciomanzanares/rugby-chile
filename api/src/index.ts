import "dotenv/config";
import { createServer } from "http";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { standingsRoutes } from "./routes/standings";
import { matchesRoutes } from "./routes/matches";
import { clubsRoutes } from "./routes/clubs";
import { statsRoutes } from "./routes/stats";
import { createSocketServer } from "./plugins/live";

const PORT = parseInt(process.env.PORT ?? "4000");
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

async function start() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: WEB_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // API routes
  await app.register(async (api) => {
    await standingsRoutes(api);
    await matchesRoutes(api);
    await clubsRoutes(api);
    await statsRoutes(api);
  }, { prefix: "/api/v1" });

  // Attach Socket.IO to the same HTTP server
  const httpServer = createServer(app.server);
  createSocketServer(httpServer, WEB_URL);

  await app.ready();

  httpServer.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`\n🏉  Rugby Chile API ready at http://localhost:${PORT}`);
    console.log(`⚡  Socket.IO live scoring active`);
    console.log(`📡  CORS allowed for ${WEB_URL}\n`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
