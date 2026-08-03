import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { db } from "../db";
import { liveMatches, liveEvents } from "../db/schema";
import { eq, inArray, desc } from "drizzle-orm";

async function getLiveMatchesWithEvents() {
  const matches = await db
    .select()
    .from(liveMatches)
    .where(inArray(liveMatches.status, ["LIVE", "HT", "SCHEDULED"]));

  const events = matches.length
    ? await db
        .select()
        .from(liveEvents)
        .where(inArray(liveEvents.matchId, matches.map((m) => m.id)))
    : [];

  return matches.map((m) => ({
    ...m,
    events: events.filter((e) => e.matchId === m.id),
  }));
}

async function getMatchWithEvents(matchId: string) {
  const [match] = await db
    .select()
    .from(liveMatches)
    .where(eq(liveMatches.id, matchId));
  if (!match) return null;

  const events = await db
    .select()
    .from(liveEvents)
    .where(eq(liveEvents.matchId, matchId));

  return { ...match, events };
}

let _io: SocketIOServer | null = null;
export function getIo() { return _io; }

export function createSocketServer(httpServer: HttpServer, webUrl: string | string[]) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: webUrl, methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    // Register all event handlers synchronously BEFORE any await. The previous
    // version awaited a DB query before attaching these listeners, so a client
    // that emits immediately on connect (e.g. a scorer sending match:start)
    // could land in that gap and have the event silently dropped — leaving the
    // match stuck SCHEDULED. live:init is pushed at the end instead.

    socket.on("join:match", (matchId: string) => {
      socket.join(`match:${matchId}`);
    });

    socket.on("leave:match", (matchId: string) => {
      socket.leave(`match:${matchId}`);
    });

    // Admin: start a match
    socket.on("match:start", async (matchId: string) => {
      await db
        .update(liveMatches)
        .set({ status: "LIVE", minute: 0, updatedAt: new Date() })
        .where(eq(liveMatches.id, matchId));

      const match = await getMatchWithEvents(matchId);
      io.emit("match:update", match);
    });

    // Admin: update the clock minute
    socket.on("minute:update", async (payload: { matchId: string; minute: number }) => {
      await db
        .update(liveMatches)
        .set({ minute: payload.minute, updatedAt: new Date() })
        .where(eq(liveMatches.id, payload.matchId));

      io.emit("minute:update", payload);
    });

    // Admin: add a scoring event
    socket.on("event:add", async (payload: {
      matchId: string;
      team: "home" | "away";
      type: "TRY" | "CONVERSION" | "PENALTY" | "DROP_GOAL" | "YELLOW_CARD" | "RED_CARD";
      minute: number;
      playerName?: string;
      points: number;
    }) => {
      await db.insert(liveEvents).values({
        matchId: payload.matchId,
        team: payload.team,
        type: payload.type,
        minute: payload.minute,
        playerName: payload.playerName ?? null,
        points: payload.points,
      });

      // Update score and try count
      const [current] = await db
        .select()
        .from(liveMatches)
        .where(eq(liveMatches.id, payload.matchId));

      if (current) {
        const isHome = payload.team === "home";
        const isTry = payload.type === "TRY";
        await db
          .update(liveMatches)
          .set({
            homeScore: isHome ? current.homeScore + payload.points : current.homeScore,
            awayScore: !isHome ? current.awayScore + payload.points : current.awayScore,
            homeTries: isHome && isTry ? current.homeTries + 1 : current.homeTries,
            awayTries: !isHome && isTry ? current.awayTries + 1 : current.awayTries,
            updatedAt: new Date(),
          })
          .where(eq(liveMatches.id, payload.matchId));
      }

      const match = await getMatchWithEvents(payload.matchId);
      io.emit("match:update", match);
    });

    // Admin: undo last event
    socket.on("event:undo", async (matchId: string) => {
      const [last] = await db
        .select()
        .from(liveEvents)
        .where(eq(liveEvents.matchId, matchId))
        .orderBy(desc(liveEvents.createdAt))
        .limit(1);

      if (!last) return;

      await db.delete(liveEvents).where(eq(liveEvents.id, last.id));

      const [current] = await db
        .select()
        .from(liveMatches)
        .where(eq(liveMatches.id, matchId));

      if (current) {
        const isHome = last.team === "home";
        const isTry = last.type === "TRY";
        await db
          .update(liveMatches)
          .set({
            homeScore: isHome ? Math.max(0, current.homeScore - last.points) : current.homeScore,
            awayScore: !isHome ? Math.max(0, current.awayScore - last.points) : current.awayScore,
            homeTries: isHome && isTry ? Math.max(0, current.homeTries - 1) : current.homeTries,
            awayTries: !isHome && isTry ? Math.max(0, current.awayTries - 1) : current.awayTries,
            updatedAt: new Date(),
          })
          .where(eq(liveMatches.id, matchId));
      }

      const match = await getMatchWithEvents(matchId);
      io.emit("match:update", match);
    });

    // Admin: half time
    socket.on("match:ht", async (matchId: string) => {
      await db
        .update(liveMatches)
        .set({ status: "HT", updatedAt: new Date() })
        .where(eq(liveMatches.id, matchId));

      const match = await getMatchWithEvents(matchId);
      io.emit("match:update", match);
    });

    // Admin: second half
    socket.on("match:second_half", async (matchId: string) => {
      await db
        .update(liveMatches)
        .set({ status: "LIVE", updatedAt: new Date() })
        .where(eq(liveMatches.id, matchId));

      const match = await getMatchWithEvents(matchId);
      io.emit("match:update", match);
    });

    // Admin: finish match
    socket.on("match:finish", async (matchId: string) => {
      await db
        .update(liveMatches)
        .set({ status: "FINISHED", updatedAt: new Date() })
        .where(eq(liveMatches.id, matchId));

      const match = await getMatchWithEvents(matchId);
      io.emit("match:update", match);
    });

    // Push current state now that all handlers are attached — nothing the
    // client emits in the meantime can be missed.
    getLiveMatchesWithEvents()
      .then((current) => socket.emit("live:init", current))
      .catch((err) => console.error("[socket] live:init failed:", err));
  });

  _io = io;
  return io;
}
