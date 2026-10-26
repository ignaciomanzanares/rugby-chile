import { FastifyInstance } from "fastify";
import { fetchSeven } from "../lib/seven";

export async function sevenRoutes(app: FastifyInstance) {
  // GET /api/v1/seven — el circuito entero: tabla acumulada, etapas y copas.
  //
  // Una sola ruta porque el circuito es chico (un torneo, tres etapas) y la
  // pantalla los muestra juntos. Sale de Leverade, no de arusa: el scrape de
  // /ranking/ que alimenta la tabla del XV cayó detrás del proof-of-work.
  app.get("/seven", async (_req, reply) => {
    const data = await fetchSeven().catch(() => null);
    if (!data) {
      reply.header("Cache-Control", "no-store");
      return reply.code(503).send({ error: "sin datos del circuito" });
    }
    reply.header("Cache-Control", "public, max-age=300");
    return reply.send(data);
  });
}
