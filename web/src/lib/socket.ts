import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, { autoConnect: false });
  }
  return socket;
};

export const connectSocket = (): Socket => {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
};

// No-op: the socket is a shared singleton across all consumers (home page has
// three of them at once). A component-level disconnect would tear it down for
// every other live-updating widget on the page. The socket closes when the tab
// unloads.
export const disconnectSocket = () => {};

export interface LiveEvent {
  id: string;
  matchId: string;
  team: "home" | "away";
  type: "TRY" | "CONVERSION" | "PENALTY" | "DROP_GOAL" | "YELLOW_CARD" | "RED_CARD";
  minute: number;
  playerName?: string | null;
  points: number;
  homeScore?: number | null;
  awayScore?: number | null;
  half?: number | null;
  createdAt: string;
}

export interface LiveMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  division: string;
  venue: string;
  homeScore: number;
  awayScore: number;
  homeTries: number;
  awayTries: number;
  minute: number;
  status: "SCHEDULED" | "LIVE" | "HT" | "FINISHED";
  events: LiveEvent[];
}
