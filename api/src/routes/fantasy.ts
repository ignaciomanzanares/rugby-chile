import type { FastifyInstance } from "fastify";
import { db } from "../db";
import {
  fantasySquads,
  fantasySquadPlayers,
  fantasyGameweekScores,
  fantasyLineups,
  fantasyTransfers,
  fantasyPlayerPrices,
  users,
} from "../db/schema";
import { eq, inArray, and, sql, gt } from "drizzle-orm";
import { getUserFromRequest } from "./auth";
import { leagueMemberIds } from "./leagues";
import { calcFantasyPoints, calcSquadTotalPoints } from "../lib/fantasyScoring";
import { autoScoreFantasy } from "../services/fantasyAutoScore";
import {
  FANTASY_RULES, computeLineupPoints, validateSquad, validateLineup,
  getCurrentGameweek, type GwScore,
} from "../services/fantasyEngine";
import { getPricedPlayers, priceMap } from "../services/fantasyPricing";
import { fetchAllMatchesMeta, type DivisionKey } from "../lib/leverade";

const VALID_DIVISIONS = ["primera", "intermedia", "pre-intermedia"] as const;
type Division = typeof VALID_DIVISIONS[number];

function isValidDivision(d: string): d is Division {
  return VALID_DIVISIONS.includes(d as Division);
}

const DIV_KEY: Record<Division, DivisionKey> = {
  primera: "PRIMERA", intermedia: "INTERMEDIA", "pre-intermedia": "PRE_INTERMEDIA",
};

// clubSlug idéntico al de la web (nombre Leverade → slug de arusa: minúsculas,
// espacios→guiones). Coincide con players.teamSlug.
function clubSlugOf(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "-");
}
// Sigla corta para la píldora del rival (OR vs OJ, etc.).
const CLUB_SHORT: Record<string, string> = {
  "old-reds": "OR", "old-johns": "OJ", "old-boys": "OB", "old-macks": "OM",
  "stade-francais": "SF", "sporting-rc": "SPO", "pwcc": "PWCC", "cobs": "COBS",
  "dobs": "DOBS", "uc": "UC",
};

export interface RoundFixture { opp: string; oppShort: string; oppName: string; home: boolean }

// Rival de cada club en la fecha `round` (o la fecha en juego/próxima si no se
// pasa), keyed por clubSlug. Sirve para elegir el equipo mirando el fixture.
async function getRoundFixtures(division: Division, round: number): Promise<Record<string, RoundFixture>> {
  let meta;
  try { meta = await fetchAllMatchesMeta(); } catch { return {}; }
  const dk = DIV_KEY[division];
  const out: Record<string, RoundFixture> = {};
  for (const m of meta) {
    if (m.division !== dk || m.round !== round || m.postponed) continue;
    const homeSlug = clubSlugOf(m.homeTeam);
    const awaySlug = clubSlugOf(m.awayTeam);
    out[homeSlug] = { opp: awaySlug, oppShort: CLUB_SHORT[awaySlug] ?? awaySlug.toUpperCase(), oppName: m.awayTeam, home: true };
    out[awaySlug] = { opp: homeSlug, oppShort: CLUB_SHORT[homeSlug] ?? homeSlug.toUpperCase(), oppName: m.homeTeam, home: false };
  }
  return out;
}

export interface UpcomingFixture { round: number; oppShort: string; oppName: string; home: boolean }

// Próximas `n` fechas de cada club desde `fromRound` (inclusive), keyed por slug.
async function getUpcomingFixtures(division: Division, fromRound: number, n = 3): Promise<Record<string, UpcomingFixture[]>> {
  let meta;
  try { meta = await fetchAllMatchesMeta(); } catch { return {}; }
  const dk = DIV_KEY[division];
  const byClub: Record<string, UpcomingFixture[]> = {};
  const rows = meta
    .filter((m) => m.division === dk && !m.postponed && m.round >= fromRound)
    .sort((a, b) => a.round - b.round);
  for (const m of rows) {
    const homeSlug = clubSlugOf(m.homeTeam);
    const awaySlug = clubSlugOf(m.awayTeam);
    (byClub[homeSlug] ??= []).push({ round: m.round, oppShort: CLUB_SHORT[awaySlug] ?? awaySlug.toUpperCase(), oppName: m.awayTeam, home: true });
    (byClub[awaySlug] ??= []).push({ round: m.round, oppShort: CLUB_SHORT[homeSlug] ?? homeSlug.toUpperCase(), oppName: m.homeTeam, home: false });
  }
  for (const k of Object.keys(byClub)) byClub[k] = byClub[k].slice(0, n);
  return byClub;
}

// % de propiedad: en cuántos planteles de la división está cada jugador.
async function getOwnership(division: Division): Promise<Record<string, number>> {
  const squads = await db.select({ id: fantasySquads.id }).from(fantasySquads).where(eq(fantasySquads.division, division));
  const total = squads.length;
  if (total === 0) return {};
  const rows = await db.select({ arusaId: fantasySquadPlayers.arusaId }).from(fantasySquadPlayers)
    .where(inArray(fantasySquadPlayers.squadId, squads.map((s) => s.id)));
  const count: Record<string, number> = {};
  for (const r of rows) count[r.arusaId] = (count[r.arusaId] ?? 0) + 1;
  const out: Record<string, number> = {};
  for (const [id, c] of Object.entries(count)) out[id] = Math.round((c / total) * 100);
  return out;
}

// Puntos por fecha recientes de cada jugador (rounds ≥1), para forma + últimos.
async function getRecentByPlayer(division: Division): Promise<Record<string, Array<{ round: number; points: number; played: boolean }>>> {
  const rows = await db
    .select({ round: fantasyGameweekScores.round, arusaId: fantasyGameweekScores.arusaId, points: fantasyGameweekScores.pointsEarned, played: fantasyGameweekScores.played })
    .from(fantasyGameweekScores)
    .where(and(eq(fantasyGameweekScores.division, division), gt(fantasyGameweekScores.round, 0)));
  const out: Record<string, Array<{ round: number; points: number; played: boolean }>> = {};
  for (const r of rows) (out[r.arusaId] ??= []).push({ round: r.round, points: r.points, played: r.played });
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.round - b.round);
  return out;
}


// Puntos totales de un squad según el modelo semanal (misma cuenta que /state):
// por cada fecha con puntajes, la alineación guardada o la default, con auto-subs,
// capitán y chips.
function squadOverallPoints(
  rosterIds: string[],
  lineupsByRound: Map<number, { starters: string[]; bench: string[]; captainId: string | null; viceCaptainId: string | null; chip: string | null; hits: number }>,
  scoresByRound: Map<number, Map<string, GwScore>>,
  defCaptain: string | null, defVice: string | null,
): number {
  let total = 0;
  for (const [round, sc] of scoresByRound) {
    const l = lineupsByRound.get(round);
    const input = l ?? {
      starters: rosterIds.slice(0, FANTASY_RULES.STARTERS),
      bench: rosterIds.slice(FANTASY_RULES.STARTERS, FANTASY_RULES.SQUAD_SIZE),
      captainId: defCaptain, viceCaptainId: defVice, chip: null, hits: 0,
    };
    total += computeLineupPoints(input, sc).points;
  }
  return total;
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
    if (!Array.isArray(playerIds) || playerIds.length < FANTASY_RULES.STARTERS || playerIds.length > FANTASY_RULES.SQUAD_SIZE) {
      return reply.status(400).send({ error: `Debes seleccionar ${FANTASY_RULES.STARTERS} titulares (+ super sub opcional)` });
    }

    // Precios del servidor (autoritativos) para validar presupuesto y setear el banco.
    const prices = await priceMap(division);
    const priced = playerIds.map((p) => ({ arusaId: p.arusaId, clubSlug: p.clubSlug, price: prices.get(p.arusaId) ?? 50 }));
    const v = validateSquad(priced);
    if (!v.ok) return reply.status(400).send({ error: v.error });
    const cost = priced.reduce((s, p) => s + p.price, 0);
    const bank = FANTASY_RULES.BUDGET - cost;

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
        .set({ teamName: teamName ?? "Mi Equipo", captainId: captainId ?? null, viceCaptainId: viceCaptainId ?? null, bank, updatedAt: new Date() })
        .where(eq(fantasySquads.id, squadId));
      await db.delete(fantasySquadPlayers).where(eq(fantasySquadPlayers.squadId, squadId));
    } else {
      const [newSquad] = await db
        .insert(fantasySquads)
        .values({ userId, season: 2026, division, teamName: teamName ?? "Mi Equipo", captainId: captainId ?? null, viceCaptainId: viceCaptainId ?? null, totalPoints: 0, bank })
        .returning({ id: fantasySquads.id });
      squadId = newSquad.id;
    }

    // Precio del servidor como purchasePrice (autoritativo).
    await db.insert(fantasySquadPlayers).values(
      playerIds.map((p) => ({ squadId, arusaId: p.arusaId, clubSlug: p.clubSlug, playerName: p.playerName, purchasePrice: prices.get(p.arusaId) ?? 50 })),
    );

    // Alineación por defecto de la fecha en curso: primeros 15 titulares, últimos 4 banca.
    const gw = await getCurrentGameweek(division);
    if (!gw.locked) {
      const starters = playerIds.slice(0, FANTASY_RULES.STARTERS).map((p) => p.arusaId);
      const bench = playerIds.slice(FANTASY_RULES.STARTERS, FANTASY_RULES.SQUAD_SIZE).map((p) => p.arusaId);
      const [line] = await db.select({ id: fantasyLineups.id }).from(fantasyLineups)
        .where(and(eq(fantasyLineups.squadId, squadId), eq(fantasyLineups.round, gw.round)));
      if (line) {
        await db.update(fantasyLineups).set({ starters, bench, captainId: captainId ?? null, viceCaptainId: viceCaptainId ?? null, updatedAt: new Date() }).where(eq(fantasyLineups.id, line.id));
      } else {
        await db.insert(fantasyLineups).values({ squadId, round: gw.round, starters, bench, captainId: captainId ?? null, viceCaptainId: viceCaptainId ?? null });
      }
    }

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

    // Puntajes de la división por fecha (Map<round, Map<arusaId, GwScore>>).
    const scoreRows = await db
      .select({ round: fantasyGameweekScores.round, arusaId: fantasyGameweekScores.arusaId, pointsEarned: fantasyGameweekScores.pointsEarned, played: fantasyGameweekScores.played, wasSub: fantasyGameweekScores.wasSub })
      .from(fantasyGameweekScores)
      // round 0 = agregado de temporada (SEASON_ROUND), no es una fecha jugable → se excluye del modelo semanal.
      .where(and(eq(fantasyGameweekScores.division, division), gt(fantasyGameweekScores.round, 0)));
    const scoresByRound = new Map<number, Map<string, GwScore>>();
    for (const r of scoreRows) {
      let m = scoresByRound.get(r.round);
      if (!m) { m = new Map(); scoresByRound.set(r.round, m); }
      m.set(r.arusaId, { arusaId: r.arusaId, pointsEarned: r.pointsEarned, played: r.played, wasSub: r.wasSub });
    }

    // Alineaciones por squad (para el cálculo semanal con auto-subs/capitán/chips).
    const allLineups = await db.select().from(fantasyLineups).where(inArray(fantasyLineups.squadId, squadIds));
    const lineupsBySquad = new Map<string, Map<number, any>>();
    for (const l of allLineups) {
      let m = lineupsBySquad.get(l.squadId);
      if (!m) { m = new Map(); lineupsBySquad.set(l.squadId, m); }
      m.set(l.round, { starters: l.starters, bench: l.bench, captainId: l.captainId, viceCaptainId: l.viceCaptainId, chip: l.chip, hits: l.hits });
    }

    const rosterBySquad = new Map<string, string[]>();
    for (const p of allPlayers) {
      const arr = rosterBySquad.get(p.squadId) ?? [];
      arr.push(p.arusaId);
      rosterBySquad.set(p.squadId, arr);
    }

    return reply.send(
      allSquads
        .map((squad) => {
          const rosterIds = rosterBySquad.get(squad.id) ?? [];
          const totalPoints = squadOverallPoints(rosterIds, lineupsBySquad.get(squad.id) ?? new Map(), scoresByRound, squad.captainId, squad.viceCaptainId);
          return { userId: squad.userId, teamName: squad.teamName, userName: userMap.get(squad.userId) ?? "Anónimo", totalPoints, playerCount: rosterIds.length };
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

  // ── FPL-style endpoints ─────────────────────────────────────────────────────

  // Puntajes por FECHA de una división → Map<round, Map<arusaId, GwScore>>.
  async function loadGwScores(division: string): Promise<Map<number, Map<string, GwScore>>> {
    const rows = await db
      .select({
        round: fantasyGameweekScores.round,
        arusaId: fantasyGameweekScores.arusaId,
        pointsEarned: fantasyGameweekScores.pointsEarned,
        played: fantasyGameweekScores.played,
        wasSub: fantasyGameweekScores.wasSub,
      })
      .from(fantasyGameweekScores)
      // round 0 = agregado de temporada, no cuenta como fecha del modelo semanal.
      .where(and(eq(fantasyGameweekScores.division, division), gt(fantasyGameweekScores.round, 0)));
    const byRound = new Map<number, Map<string, GwScore>>();
    for (const r of rows) {
      let m = byRound.get(r.round);
      if (!m) { m = new Map(); byRound.set(r.round, m); }
      m.set(r.arusaId, { arusaId: r.arusaId, pointsEarned: r.pointsEarned, played: r.played, wasSub: r.wasSub });
    }
    return byRound;
  }

  // Alineación por defecto desde el plantel: primeros 15 titulares, últimos 4 banca.
  function defaultLineup(rosterIds: string[], captainId: string | null, viceCaptainId: string | null) {
    return {
      starters: rosterIds.slice(0, FANTASY_RULES.STARTERS),
      bench: rosterIds.slice(FANTASY_RULES.STARTERS, FANTASY_RULES.SQUAD_SIZE),
      captainId, viceCaptainId, chip: null as string | null, hits: 0,
    };
  }

  // GET /fantasy/players?division=primera — universo de jugadores con precio (mercado).
  api.get("/fantasy/players", async (req, reply) => {
    const { division = "primera" } = req.query as { division?: string };
    if (!isValidDivision(division)) return reply.status(400).send({ error: "División inválida" });
    const gw = await getCurrentGameweek(division);
    const [players, fixtures, upcoming, ownership, recent] = await Promise.all([
      getPricedPlayers(division),
      getRoundFixtures(division, gw.round),
      getUpcomingFixtures(division, gw.round, 3),
      getOwnership(division),
      getRecentByPlayer(division),
    ]);
    reply.header("Cache-Control", "public, max-age=120");
    return reply.send({ players, rules: FANTASY_RULES, budget: FANTASY_RULES.BUDGET, gameweek: gw, fixtures, upcoming, ownership, recent });
  });

  // GET /fantasy/state?division=primera — estado completo del equipo del usuario.
  api.get("/fantasy/state", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "Debes iniciar sesión" });
    const { division = "primera" } = req.query as { division?: string };
    if (!isValidDivision(division)) return reply.status(400).send({ error: "División inválida" });

    const gw = await getCurrentGameweek(division);

    const [squad] = await db.select().from(fantasySquads)
      .where(and(eq(fantasySquads.userId, userId), eq(fantasySquads.division, division)));
    if (!squad) {
      return reply.send({ squad: null, gameweek: gw, rules: FANTASY_RULES, budget: FANTASY_RULES.BUDGET });
    }

    const roster = await db.select().from(fantasySquadPlayers).where(eq(fantasySquadPlayers.squadId, squad.id));
    const rosterIds = roster.map((p) => p.arusaId);
    const prices = await priceMap(division);
    const squadValue = roster.reduce((s, p) => s + (prices.get(p.arusaId) ?? p.purchasePrice), 0);

    const lineups = await db.select().from(fantasyLineups).where(eq(fantasyLineups.squadId, squad.id));
    const lineupByRound = new Map(lineups.map((l) => [l.round, l]));
    const scores = await loadGwScores(division);

    // Puntos: por cada fecha con puntajes, usar la alineación guardada o la default.
    // `history` lleva además el detalle jugable de cada fecha (titulares, capitán,
    // super sub y puntos por jugador) para poder revivir cómo quedó el equipo.
    let overall = 0;
    const perGw: Array<{ round: number; points: number }> = [];
    const history: Array<{
      round: number; points: number; captainUsedId: string | null;
      starters: string[]; superSubId: string | null;
      scores: Record<string, { points: number; played: boolean; wasSub: boolean }>;
    }> = [];
    for (const [round, sc] of [...scores.entries()].sort((a, b) => a[0] - b[0])) {
      const l = lineupByRound.get(round);
      const input = l
        ? { starters: l.starters, bench: l.bench, captainId: l.captainId, viceCaptainId: l.viceCaptainId, chip: l.chip, hits: l.hits }
        : defaultLineup(rosterIds, squad.captainId, squad.viceCaptainId);
      const res = computeLineupPoints(input, sc);
      overall += res.points;
      perGw.push({ round, points: res.points });
      const scoreMap: Record<string, { points: number; played: boolean; wasSub: boolean }> = {};
      for (const id of [...input.starters, ...input.bench]) {
        const s = sc.get(id);
        scoreMap[id] = { points: s?.pointsEarned ?? 0, played: s?.played ?? false, wasSub: s?.wasSub ?? false };
      }
      history.push({ round, points: res.points, captainUsedId: res.captainUsedId, starters: input.starters, superSubId: input.bench[0] ?? null, scores: scoreMap });
    }

    const currentLineup = lineupByRound.get(gw.round) ?? null;
    return reply.send({
      squad: { ...squad, squadValue },
      roster: roster.map((p) => ({ ...p, price: prices.get(p.arusaId) ?? p.purchasePrice })),
      gameweek: gw,
      currentLineup,
      overallPoints: overall,
      perGw,
      history,
      bank: squad.bank,
      freeTransfers: squad.freeTransfers,
      chips: {
        wildcard: !squad.wildcardUsed,
        freeHit: !squad.freeHitUsed,
        benchBoost: !squad.benchBoostUsed,
        tripleCaptain: !squad.tripleCaptainUsed,
      },
      rules: FANTASY_RULES,
    });
  });

  // POST /fantasy/lineup — guardar titulares/banca/capitán/vice/chip de la fecha.
  api.post("/fantasy/lineup", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "Debes iniciar sesión" });
    const { division = "primera", starters, bench, captainId, viceCaptainId, chip } = req.body as {
      division?: string; starters: string[]; bench: string[];
      captainId?: string; viceCaptainId?: string; chip?: string | null;
    };
    if (!isValidDivision(division)) return reply.status(400).send({ error: "División inválida" });

    const [squad] = await db.select().from(fantasySquads)
      .where(and(eq(fantasySquads.userId, userId), eq(fantasySquads.division, division)));
    if (!squad) return reply.status(404).send({ error: "Primero armá tu equipo" });

    const gw = await getCurrentGameweek(division);
    if (gw.locked) return reply.status(403).send({ error: "La fecha ya empezó — no se puede cambiar la alineación" });

    const roster = await db.select({ arusaId: fantasySquadPlayers.arusaId }).from(fantasySquadPlayers).where(eq(fantasySquadPlayers.squadId, squad.id));
    const rosterIds = roster.map((r) => r.arusaId);
    const v = validateLineup(starters ?? [], bench ?? [], rosterIds);
    if (!v.ok) return reply.status(400).send({ error: v.error });
    if (captainId && !rosterIds.includes(captainId)) return reply.status(400).send({ error: "El capitán no está en tu equipo" });

    // Chip: validar disponibilidad.
    const validChips = ["bench_boost", "triple_captain"] as const; // wildcard/free_hit afectan transfers, no la alineación
    if (chip && !validChips.includes(chip as any)) return reply.status(400).send({ error: "Chip inválido para la alineación" });
    if (chip === "bench_boost" && squad.benchBoostUsed) return reply.status(400).send({ error: "Ya usaste Bench Boost" });
    if (chip === "triple_captain" && squad.tripleCaptainUsed) return reply.status(400).send({ error: "Ya usaste Triple Captain" });

    const [existing] = await db.select({ id: fantasyLineups.id }).from(fantasyLineups)
      .where(and(eq(fantasyLineups.squadId, squad.id), eq(fantasyLineups.round, gw.round)));
    if (existing) {
      await db.update(fantasyLineups)
        .set({ starters, bench, captainId: captainId ?? null, viceCaptainId: viceCaptainId ?? null, chip: chip ?? null, updatedAt: new Date() })
        .where(eq(fantasyLineups.id, existing.id));
    } else {
      await db.insert(fantasyLineups).values({
        squadId: squad.id, round: gw.round, starters, bench,
        captainId: captainId ?? null, viceCaptainId: viceCaptainId ?? null, chip: chip ?? null,
      });
    }
    // El capitán/vice "por defecto" del squad se mantiene sincronizado con la fecha.
    await db.update(fantasySquads).set({ captainId: captainId ?? null, viceCaptainId: viceCaptainId ?? null, updatedAt: new Date() }).where(eq(fantasySquads.id, squad.id));
    return reply.send({ ok: true, round: gw.round });
  });

  // POST /fantasy/transfers — { out: string[], in: [{arusaId,clubSlug,playerName}] }
  api.post("/fantasy/transfers", async (req, reply) => {
    const userId = getUserFromRequest(req as any);
    if (!userId) return reply.status(401).send({ error: "Debes iniciar sesión" });
    const { division = "primera", out: outIds, in: inPlayers, chip } = req.body as {
      division?: string; out: string[];
      in: Array<{ arusaId: string; clubSlug: string; playerName: string }>;
      chip?: string | null; // "wildcard" | "free_hit" para transfers ilimitadas/sin hit
    };
    if (!isValidDivision(division)) return reply.status(400).send({ error: "División inválida" });
    if (!Array.isArray(outIds) || !Array.isArray(inPlayers) || outIds.length !== inPlayers.length) {
      return reply.status(400).send({ error: "Cantidad de salidas y entradas no coincide" });
    }
    if (outIds.length === 0) return reply.send({ ok: true, hits: 0 });

    const [squad] = await db.select().from(fantasySquads)
      .where(and(eq(fantasySquads.userId, userId), eq(fantasySquads.division, division)));
    if (!squad) return reply.status(404).send({ error: "Primero armá tu equipo" });

    const gw = await getCurrentGameweek(division);
    if (gw.locked) return reply.status(403).send({ error: "La fecha ya empezó — no se pueden hacer transferencias" });

    if (chip === "wildcard" && squad.wildcardUsed) return reply.status(400).send({ error: "Ya usaste el Comodín" });
    if (chip === "free_hit" && squad.freeHitUsed) return reply.status(400).send({ error: "Ya usaste el Free Hit" });

    const roster = await db.select().from(fantasySquadPlayers).where(eq(fantasySquadPlayers.squadId, squad.id));
    const rosterById = new Map(roster.map((p) => [p.arusaId, p]));
    for (const o of outIds) if (!rosterById.has(o)) return reply.status(400).send({ error: "Un jugador a vender no está en tu equipo" });

    const prices = await priceMap(division);
    // Presupuesto: bank + venta de salientes ≥ compra de entrantes.
    const sold = outIds.reduce((s, id) => s + (prices.get(id) ?? rosterById.get(id)!.purchasePrice), 0);
    const bought = inPlayers.reduce((s, p) => s + (prices.get(p.arusaId) ?? 50), 0);
    const newBank = squad.bank + sold - bought;
    if (newBank < 0) return reply.status(400).send({ error: "No te alcanza el presupuesto para esas transferencias" });

    // Composición resultante: ≤3 por club, sin repetidos.
    const resulting = roster.filter((p) => !outIds.includes(p.arusaId)).map((p) => ({ arusaId: p.arusaId, clubSlug: p.clubSlug }))
      .concat(inPlayers.map((p) => ({ arusaId: p.arusaId, clubSlug: p.clubSlug })));
    const ids = new Set(resulting.map((r) => r.arusaId));
    if (ids.size !== resulting.length) return reply.status(400).send({ error: "Quedaría un jugador repetido" });
    const byClub: Record<string, number> = {};
    for (const r of resulting) { byClub[r.clubSlug] = (byClub[r.clubSlug] ?? 0) + 1; if (byClub[r.clubSlug] > FANTASY_RULES.MAX_PER_CLUB) return reply.status(400).send({ error: `Máximo ${FANTASY_RULES.MAX_PER_CLUB} por club` }); }

    // Hits: wildcard/free_hit = sin costo; si no, −4 por cada transfer que supere las gratis.
    const free = chip === "wildcard" || chip === "free_hit" ? Infinity : squad.freeTransfers;
    const hits = chip === "wildcard" || chip === "free_hit" ? 0 : Math.max(0, outIds.length - free) * FANTASY_RULES.HIT_COST;

    // Aplicar: sacar salientes, meter entrantes, log, net transfers, bank, free transfers, chip.
    await db.delete(fantasySquadPlayers).where(and(eq(fantasySquadPlayers.squadId, squad.id), inArray(fantasySquadPlayers.arusaId, outIds)));
    await db.insert(fantasySquadPlayers).values(inPlayers.map((p) => ({
      squadId: squad.id, arusaId: p.arusaId, clubSlug: p.clubSlug, playerName: p.playerName, purchasePrice: prices.get(p.arusaId) ?? 50,
    })));
    for (let i = 0; i < outIds.length; i++) {
      await db.insert(fantasyTransfers).values({
        squadId: squad.id, division, round: gw.round, outArusaId: outIds[i], inArusaId: inPlayers[i].arusaId,
        outPrice: prices.get(outIds[i]) ?? 50, inPrice: prices.get(inPlayers[i].arusaId) ?? 50,
      });
    }
    // Net transfers para precios dinámicos (+1 al que entra, −1 al que sale).
    for (const p of inPlayers) await db.update(fantasyPlayerPrices).set({ netTransfers: sql`${fantasyPlayerPrices.netTransfers} + 1` }).where(and(eq(fantasyPlayerPrices.division, division), eq(fantasyPlayerPrices.arusaId, p.arusaId)));
    for (const o of outIds) await db.update(fantasyPlayerPrices).set({ netTransfers: sql`${fantasyPlayerPrices.netTransfers} - 1` }).where(and(eq(fantasyPlayerPrices.division, division), eq(fantasyPlayerPrices.arusaId, o)));

    const nextFree = chip === "wildcard" || chip === "free_hit" ? squad.freeTransfers : Math.max(0, squad.freeTransfers - outIds.length);
    await db.update(fantasySquads).set({
      bank: newBank,
      freeTransfers: nextFree,
      wildcardUsed: squad.wildcardUsed || chip === "wildcard",
      freeHitUsed: squad.freeHitUsed || chip === "free_hit",
      updatedAt: new Date(),
    }).where(eq(fantasySquads.id, squad.id));

    // Registrar los hits en la alineación de la fecha (para descontarlos al puntuar).
    if (hits > 0) {
      const [line] = await db.select({ id: fantasyLineups.id, hits: fantasyLineups.hits }).from(fantasyLineups)
        .where(and(eq(fantasyLineups.squadId, squad.id), eq(fantasyLineups.round, gw.round)));
      if (line) await db.update(fantasyLineups).set({ hits: line.hits + hits }).where(eq(fantasyLineups.id, line.id));
    }
    return reply.send({ ok: true, hits, bank: newBank, freeTransfers: nextFree });
  });
}
