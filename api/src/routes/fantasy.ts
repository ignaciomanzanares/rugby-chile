import type { FastifyInstance } from "fastify";
import { db } from "../db";
import {
  fantasySquads,
  fantasySquadPlayers,
  fantasyGameweekScores,
  users,
} from "../db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { getUserFromRequest } from "./auth";
import { leagueMemberIds } from "./leagues";
import { calcFantasyPoints, calcSquadTotalPoints } from "../lib/fantasyScoring";
import { autoScoreFantasy } from "../services/fantasyAutoScore";

const VALID_DIVISIONS = ["primera", "intermedia", "pre-intermedia"] as const;
type Division = typeof VALID_DIVISIONS[number];

function isValidDivision(d: string): d is Division {
  return VALID_DIVISIONS.includes(d as Division);
}


export async function fantasyRoutes(api: FastifyInstance) {

  // GET /fantasy/squad?division=primera
  api.get("/fantasy/squad", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "Debes iniciar sesión" });

    const { division = "primera" } = req.query as { division?: string };
    if (!isValidDivision(division)) return reply.status(400).send({ error: "División inválida" });

    const [squad] = await db
      .select()
      .from(fantasySquads)
      .where(and(
        eq(fantasySquads.userId, userId),
        eq(fantasySquads.division, division),
      ));

    if (!squad) return reply.send({ squad: null, players: [], totalPoints: 0 });

    const players = await db
      .select()
      .from(fantasySquadPlayers)
      .where(eq(fantasySquadPlayers.squadId, squad.id));

    const arusaIds = players.map((p) => p.arusaId);
    let allScores: Array<{ arusaId: string; pointsEarned: number }> = [];
    if (arusaIds.length > 0) {
      allScores = await db
        .select({ arusaId: fantasyGameweekScores.arusaId, pointsEarned: fantasyGameweekScores.pointsEarned })
        .from(fantasyGameweekScores)
        .where(and(
          inArray(fantasyGameweekScores.arusaId, arusaIds),
          eq(fantasyGameweekScores.division, division),
        ));
    }

    const totalPoints = calcSquadTotalPoints(players, squad.captainId, squad.viceCaptainId, allScores);
    return reply.send({ squad, players, totalPoints });
  });

  // POST /fantasy/squad  — body includes division
  api.post("/fantasy/squad", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "Debes iniciar sesión" });

    const { teamName, division = "primera", playerIds, captainId, viceCaptainId } = req.body as {
      teamName: string;
      division?: string;
      playerIds: Array<{ arusaId: string; clubSlug: string; playerName: string; purchasePrice: number }>;
      captainId?: string;
      viceCaptainId?: string;
    };

    if (!isValidDivision(division)) return reply.status(400).send({ error: "División inválida" });
    if (!Array.isArray(playerIds) || playerIds.length !== 15) {
      return reply.status(400).send({ error: "Debes seleccionar exactamente 15 jugadores" });
    }

    const clubCounts: Record<string, number> = {};
    for (const p of playerIds) {
      clubCounts[p.clubSlug] = (clubCounts[p.clubSlug] ?? 0) + 1;
      if (clubCounts[p.clubSlug] > 3) {
        return reply.status(400).send({ error: "Máximo 3 jugadores por club" });
      }
    }

    const [existing] = await db
      .select({ id: fantasySquads.id })
      .from(fantasySquads)
      .where(and(
        eq(fantasySquads.userId, userId),
        eq(fantasySquads.division, division),
      ));

    let squadId: string;

    if (existing) {
      squadId = existing.id;
      await db.update(fantasySquads)
        .set({ teamName: teamName ?? "Mi Equipo", captainId: captainId ?? null, viceCaptainId: viceCaptainId ?? null, updatedAt: new Date() })
        .where(eq(fantasySquads.id, squadId));
      await db.delete(fantasySquadPlayers).where(eq(fantasySquadPlayers.squadId, squadId));
    } else {
      const [newSquad] = await db
        .insert(fantasySquads)
        .values({ userId, season: 2026, division, teamName: teamName ?? "Mi Equipo", captainId: captainId ?? null, viceCaptainId: viceCaptainId ?? null, totalPoints: 0 })
        .returning({ id: fantasySquads.id });
      squadId = newSquad.id;
    }

    await db.insert(fantasySquadPlayers).values(
      playerIds.map((p) => ({ squadId, arusaId: p.arusaId, clubSlug: p.clubSlug, playerName: p.playerName, purchasePrice: p.purchasePrice })),
    );

    const allPlayers = await db.select().from(fantasySquadPlayers).where(eq(fantasySquadPlayers.squadId, squadId));
    const arusaIds = allPlayers.map((p) => p.arusaId);
    let allScores: Array<{ arusaId: string; pointsEarned: number }> = [];
    if (arusaIds.length > 0) {
      allScores = await db
        .select({ arusaId: fantasyGameweekScores.arusaId, pointsEarned: fantasyGameweekScores.pointsEarned })
        .from(fantasyGameweekScores)
        .where(and(
          inArray(fantasyGameweekScores.arusaId, arusaIds),
          eq(fantasyGameweekScores.division, division),
        ));
    }
    const totalPoints = calcSquadTotalPoints(allPlayers, captainId, viceCaptainId, allScores);
    await db.update(fantasySquads).set({ totalPoints }).where(eq(fantasySquads.id, squadId));

    const [savedSquad] = await db.select().from(fantasySquads).where(eq(fantasySquads.id, squadId));
    return reply.status(existing ? 200 : 201).send({ squad: savedSquad, players: allPlayers });
  });

  // GET /fantasy/leaderboard?division=primera&league=<id> — general o por liga.
  api.get("/fantasy/leaderboard", async (req, reply) => {
    const { division = "primera", league: leagueId } = req.query as { division?: string; league?: string };
    if (!isValidDivision(division)) return reply.status(400).send({ error: "División inválida" });

    let memberIds: string[] | null = null;
    if (leagueId) {
      memberIds = await leagueMemberIds(leagueId);
      if (memberIds == null) return reply.status(404).send({ error: "Liga no encontrada" });
      if (memberIds.length === 0) return reply.send([]);
    }

    const allSquads = await db
      .select()
      .from(fantasySquads)
      .where(
        memberIds
          ? and(eq(fantasySquads.division, division), inArray(fantasySquads.userId, memberIds))
          : eq(fantasySquads.division, division),
      )
      .orderBy(fantasySquads.totalPoints);

    if (allSquads.length === 0) return reply.send([]);

    const userIds = [...new Set(allSquads.map((s) => s.userId))];
    const userRows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds));
    const userMap = new Map(userRows.map((u) => [u.id, u.name ?? "Anónimo"]));

    const squadIds = allSquads.map((s) => s.id);
    const allPlayers = await db.select().from(fantasySquadPlayers).where(inArray(fantasySquadPlayers.squadId, squadIds));

    const allArusaIds = [...new Set(allPlayers.map((p) => p.arusaId))];
    let allScores: Array<{ arusaId: string; pointsEarned: number }> = [];
    if (allArusaIds.length > 0) {
      allScores = await db
        .select({ arusaId: fantasyGameweekScores.arusaId, pointsEarned: fantasyGameweekScores.pointsEarned })
        .from(fantasyGameweekScores)
        .where(and(
          inArray(fantasyGameweekScores.arusaId, allArusaIds),
          eq(fantasyGameweekScores.division, division),
        ));
    }

    const playersBySquad = new Map<string, typeof allPlayers>();
    for (const p of allPlayers) {
      const arr = playersBySquad.get(p.squadId) ?? [];
      arr.push(p);
      playersBySquad.set(p.squadId, arr);
    }

    return reply.send(
      allSquads
        .map((squad) => {
          const players = playersBySquad.get(squad.id) ?? [];
          const totalPoints = calcSquadTotalPoints(players, squad.captainId, squad.viceCaptainId, allScores);
          return { userId: squad.userId, teamName: squad.teamName, userName: userMap.get(squad.userId) ?? "Anónimo", totalPoints, playerCount: players.length };
        })
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, 50)
        .map((entry, i) => ({ rank: i + 1, ...entry })),
    );
  });

  // GET /fantasy/gameweek/:round?division=primera
  api.get("/fantasy/gameweek/:round", async (req, reply) => {
    const { round } = req.params as { round: string };
    const { division = "primera" } = req.query as { division?: string };
    const scores = await db
      .select()
      .from(fantasyGameweekScores)
      .where(and(
        eq(fantasyGameweekScores.round, Number(round)),
        eq(fantasyGameweekScores.division, division),
      ));
    return reply.send(scores);
  });

  // POST /fantasy/scores — admin, body includes division
  api.post("/fantasy/scores", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "No autorizado" });
    const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (me?.role !== "ADMIN") return reply.status(403).send({ error: "Solo administradores" });

    const { round, division = "primera", scores } = req.body as {
      round: number;
      division?: string;
      scores: Array<{
        arusaId: string; clubSlug: string; playerName: string;
        tries: number; assists: number; conversions: number; penalties: number;
        drops: number; yellowCards: number; redCards: number; isMvp: boolean; played: boolean;
      }>;
    };

    if (!round || !Array.isArray(scores)) return reply.status(400).send({ error: "round y scores requeridos" });
    if (!isValidDivision(division)) return reply.status(400).send({ error: "División inválida" });

    for (const s of scores) {
      const pointsEarned = calcFantasyPoints(s);
      const [existing] = await db
        .select({ id: fantasyGameweekScores.id })
        .from(fantasyGameweekScores)
        .where(and(
          eq(fantasyGameweekScores.round, round),
          eq(fantasyGameweekScores.division, division),
          eq(fantasyGameweekScores.arusaId, s.arusaId),
        ));

      if (existing) {
        await db.update(fantasyGameweekScores)
          .set({ clubSlug: s.clubSlug, playerName: s.playerName, tries: s.tries, assists: s.assists, conversions: s.conversions, penalties: s.penalties, drops: s.drops, yellowCards: s.yellowCards, redCards: s.redCards, isMvp: s.isMvp, played: s.played, pointsEarned })
          .where(eq(fantasyGameweekScores.id, existing.id));
      } else {
        await db.insert(fantasyGameweekScores).values({ season: 2026, division, round, arusaId: s.arusaId, clubSlug: s.clubSlug, playerName: s.playerName, tries: s.tries, assists: s.assists, conversions: s.conversions, penalties: s.penalties, drops: s.drops, yellowCards: s.yellowCards, redCards: s.redCards, isMvp: s.isMvp, played: s.played, pointsEarned });
      }
    }

    // Recalculate totalPoints for affected squads (same division)
    const updatedArusaIds = scores.map((s) => s.arusaId);
    const affectedPlayers = await db
      .select({ squadId: fantasySquadPlayers.squadId })
      .from(fantasySquadPlayers)
      .where(inArray(fantasySquadPlayers.arusaId, updatedArusaIds));
    const affectedSquadIds = [...new Set(affectedPlayers.map((p) => p.squadId))];

    if (affectedSquadIds.length > 0) {
      const affectedSquads = await db.select().from(fantasySquads)
        .where(and(
          inArray(fantasySquads.id, affectedSquadIds),
          eq(fantasySquads.division, division),
        ));
      const allSquadPlayers = await db.select().from(fantasySquadPlayers).where(inArray(fantasySquadPlayers.squadId, affectedSquadIds));
      const allPlayerArusaIds = [...new Set(allSquadPlayers.map((p) => p.arusaId))];
      const allScores = await db
        .select({ arusaId: fantasyGameweekScores.arusaId, pointsEarned: fantasyGameweekScores.pointsEarned })
        .from(fantasyGameweekScores)
        .where(and(
          inArray(fantasyGameweekScores.arusaId, allPlayerArusaIds),
          eq(fantasyGameweekScores.division, division),
        ));

      const playersBySquad = new Map<string, typeof allSquadPlayers>();
      for (const p of allSquadPlayers) {
        const arr = playersBySquad.get(p.squadId) ?? [];
        arr.push(p);
        playersBySquad.set(p.squadId, arr);
      }
      for (const squad of affectedSquads) {
        const squadPlayers = playersBySquad.get(squad.id) ?? [];
        const totalPoints = calcSquadTotalPoints(squadPlayers, squad.captainId, squad.viceCaptainId, allScores);
        await db.update(fantasySquads).set({ totalPoints, updatedAt: new Date() }).where(eq(fantasySquads.id, squad.id));
      }
    }

    return reply.send({ scored: scores.length, squadsUpdated: affectedSquadIds.length });
  });

  // POST /fantasy/scores/auto — admin. Computa TODOS los puntos automáticamente
  // desde las stats de temporada de arusa (las 3 divisiones) y actualiza los
  // totales de los equipos. Reemplaza la carga manual por fecha.
  api.post("/fantasy/scores/auto", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "No autorizado" });
    const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (me?.role !== "ADMIN") return reply.status(403).send({ error: "Solo administradores" });

    const result = await autoScoreFantasy();
    return reply.send({ ok: true, ...result });
  });
}
