import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001", {
      autoConnect: false,
    });
  }
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Types for live scoring events
export interface MatchEvent {
  id: string;
  matchId: string;
  team: "home" | "away";
  type: "TRY" | "CONVERSION" | "PENALTY" | "DROP_GOAL" | "YELLOW_CARD" | "RED_CARD";
  minute: number;
  points: number;
  playerName?: string;
  timestamp: Date;
}

export interface ScoreUpdate {
  matchId: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  isRunning: boolean;
}

export const subscribeToMatch = (matchId: string, callback: (data: ScoreUpdate) => void) => {
  const s = getSocket();
  s.emit("subscribe", matchId);
  s.on(`match:${matchId}:update`, callback);
};

export const unsubscribeFromMatch = (matchId: string) => {
  const s = getSocket();
  s.emit("unsubscribe", matchId);
  s.off(`match:${matchId}:update`);
};
