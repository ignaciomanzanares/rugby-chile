import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { db } from "../db";
import { matches, matchEvents } from "../db/schema";
import { eq } from "drizzle-orm";

export function createSocketServer(httpServer: HttpServer, webUrl: string) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: webUrl, methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    // Join a specific match room
    socket.on("join:match", (matchId: string) => {
      socket.join(`match:${matchId}`);
    });

    socket.on("leave:match", (matchId: string) => {
      socket.leave(`match:${matchId}`);
    });

    // Admin: update score
    socket.on("score:update", async (payload: {
      matchId: string;
      homeScore: number;
      awayScore: number;
      currentMinute: number;
    }) => {
      await db
        .update(matches)
        .set({
          homeScore: payload.homeScore,
          awayScore: payload.awayScore,
          currentMinute: payload.currentMinute,
          status: "LIVE",
        })
        .where(eq(matches.id, payload.matchId));

      io.to(`match:${payload.matchId}`).emit("score:updated", payload);
      io.emit("live:update", payload);
    });

    // Admin: record match event (try, card, etc.)
    socket.on("event:add", async (payload: {
      matchId: string;
      teamId: string;
      playerId?: string;
      type: "TRY" | "CONVERSION" | "PENALTY" | "DROP_GOAL" | "YELLOW_CARD" | "RED_CARD";
      minute: number;
      points: number;
      description?: string;
    }) => {
      const [event] = await db
        .insert(matchEvents)
        .values(payload)
        .returning();

      io.to(`match:${payload.matchId}`).emit("event:added", event);
    });

    // Admin: match status change
    socket.on("match:status", async (payload: { matchId: string; status: "LIVE" | "FINISHED" | "POSTPONED" }) => {
      await db
        .update(matches)
        .set({ status: payload.status, isFullTime: payload.status === "FINISHED" })
        .where(eq(matches.id, payload.matchId));

      io.to(`match:${payload.matchId}`).emit("match:status", payload);
      io.emit("live:status", payload);
    });
  });

  return io;
}
