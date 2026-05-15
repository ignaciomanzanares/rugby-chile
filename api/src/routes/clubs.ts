import { FastifyInstance } from "fastify";
import { db } from "../db";
import { clubs, teams } from "../db/schema";
import { eq } from "drizzle-orm";

export async function clubsRoutes(app: FastifyInstance) {
  app.get("/clubs", async (_req, reply) => {
    const rows = await db.query.clubs.findMany({
      orderBy: (clubs, { asc }) => [asc(clubs.name)],
    });
    return reply.send(rows);
  });

  app.get("/clubs/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const club = await db.query.clubs.findFirst({
      where: eq(clubs.slug, slug),
      with: {
        teams: {
          with: {
            players: true,
            standings: true,
          },
        },
      },
    });
    if (!club) return reply.status(404).send({ error: "Club not found" });
    return reply.send(club);
  });
}
