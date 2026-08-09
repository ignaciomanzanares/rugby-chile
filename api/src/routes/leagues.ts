import { FastifyInstance } from "fastify";
import { sql, eq, and, inArray, desc } from "drizzle-orm";
import { db } from "../db";
import { leagues, leagueMembers } from "../db/schema";
import { getUserFromRequest } from "./auth";

// Crea las tablas de ligas si no existen (idempotente). Se llama al boot, así no
// hace falta correr una migración a mano (mismo patrón que push/arusa_cache).
export async function ensureLeaguesTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS leagues (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(80) NOT NULL,
      code varchar(12) NOT NULL UNIQUE,
      created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS league_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS league_members_league_user_idx
    ON league_members (league_id, user_id)
  `);
}

// Código para unirse: 6 chars sin ambigüedades (sin O/0/I/1).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

/** IDs de los miembros de una liga (o null si la liga no existe). Exportado para
 *  que los leaderboards (predicciones/fantasy) filtren por liga. */
export async function leagueMemberIds(leagueId: string): Promise<string[] | null> {
  const [lg] = await db.select({ id: leagues.id }).from(leagues).where(eq(leagues.id, leagueId));
  if (!lg) return null;
  const rows = await db.select({ userId: leagueMembers.userId }).from(leagueMembers).where(eq(leagueMembers.leagueId, leagueId));
  return rows.map((r) => r.userId);
}

export async function leaguesRoutes(app: FastifyInstance) {
  // GET /leagues/mine — ligas a las que pertenece el usuario (con nº de miembros).
  app.get("/leagues/mine", async (req, reply) => {
    const userId = getUserFromRequest(req as never);
    if (!userId) return reply.send([]);
    const mine = await db
      .select({ id: leagues.id, name: leagues.name, code: leagues.code, createdBy: leagues.createdBy })
      .from(leagues)
      .innerJoin(leagueMembers, eq(leagueMembers.leagueId, leagues.id))
      .where(eq(leagueMembers.userId, userId))
      .orderBy(desc(leagues.createdAt));
    if (mine.length === 0) return reply.send([]);
    const counts = await db
      .select({ leagueId: leagueMembers.leagueId, n: sql<number>`count(*)` })
      .from(leagueMembers)
      .where(inArray(leagueMembers.leagueId, mine.map((l) => l.id)))
      .groupBy(leagueMembers.leagueId);
    const countMap = new Map(counts.map((c) => [c.leagueId, Number(c.n)]));
    return reply.send(mine.map((l) => ({ ...l, members: countMap.get(l.id) ?? 1, isOwner: l.createdBy === userId })));
  });

  // POST /leagues — crear liga { name }. El creador queda como miembro.
  app.post("/leagues", async (req, reply) => {
    const userId = getUserFromRequest(req as never);
    if (!userId) return reply.status(401).send({ error: "Debes iniciar sesión" });
    const name = String((req.body as { name?: string })?.name ?? "").trim().slice(0, 80);
    if (!name) return reply.status(400).send({ error: "Falta el nombre de la liga" });

    // Genera un código único (reintenta ante una colisión rarísima).
    let code = genCode();
    for (let i = 0; i < 5; i++) {
      const [dup] = await db.select({ id: leagues.id }).from(leagues).where(eq(leagues.code, code));
      if (!dup) break;
      code = genCode();
    }
    const [league] = await db.insert(leagues).values({ name, code, createdBy: userId }).returning();
    await db.insert(leagueMembers).values({ leagueId: league.id, userId });
    return reply.status(201).send({ id: league.id, name: league.name, code: league.code, members: 1, isOwner: true });
  });

  // POST /leagues/join — unirse con { code }.
  app.post("/leagues/join", async (req, reply) => {
    const userId = getUserFromRequest(req as never);
    if (!userId) return reply.status(401).send({ error: "Debes iniciar sesión" });
    const code = String((req.body as { code?: string })?.code ?? "").trim().toUpperCase();
    if (!code) return reply.status(400).send({ error: "Falta el código" });
    const [league] = await db.select().from(leagues).where(eq(leagues.code, code));
    if (!league) return reply.status(404).send({ error: "No existe una liga con ese código" });
    // Idempotente: si ya es miembro, no duplica.
    const [existing] = await db
      .select({ id: leagueMembers.id })
      .from(leagueMembers)
      .where(and(eq(leagueMembers.leagueId, league.id), eq(leagueMembers.userId, userId)));
    if (!existing) await db.insert(leagueMembers).values({ leagueId: league.id, userId });
    return reply.send({ id: league.id, name: league.name, code: league.code });
  });

  // POST /leagues/:id/leave — salir de una liga.
  app.post<{ Params: { id: string } }>("/leagues/:id/leave", async (req, reply) => {
    const userId = getUserFromRequest(req as never);
    if (!userId) return reply.status(401).send({ error: "Debes iniciar sesión" });
    await db.delete(leagueMembers).where(and(eq(leagueMembers.leagueId, req.params.id), eq(leagueMembers.userId, userId)));
    return reply.send({ ok: true });
  });
}
