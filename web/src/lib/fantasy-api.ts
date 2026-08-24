// Cliente del fantasy estilo FPL (API real, sin formación: 15 titulares + 4 banca).
export type Division = "primera" | "intermedia" | "pre-intermedia";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface MarketPlayer {
  arusaId: string;
  name: string;
  team: string;
  teamSlug: string;
  price: number;   // décimas (65 = 6.5M)
  matches: number;
  points: number;  // valor de temporada (proxy de rendimiento)
}

export interface FantasyRules {
  SQUAD_SIZE: number; STARTERS: number; BENCH: number;
  BUDGET: number; MAX_PER_CLUB: number; FREE_TRANSFERS_MAX: number; HIT_COST: number;
}

export interface RosterPlayer {
  arusaId: string; clubSlug: string; playerName: string; price: number;
}

export interface Gameweek { round: number; deadline: string | null; locked: boolean }

// Detalle jugable de una fecha pasada (para revivir cómo quedó el equipo).
export interface GwHistory {
  round: number;
  points: number;
  captainUsedId: string | null;
  starters: string[];
  superSubId: string | null;
  scores: Record<string, { points: number; played: boolean; wasSub: boolean }>;
}

// Rival del club en la fecha actual (para elegir el equipo mirando el fixture).
export interface RoundFixture { opp: string; oppShort: string; oppName: string; home: boolean }
export interface UpcomingFixture { round: number; oppShort: string; oppName: string; home: boolean }
export interface RecentScore { round: number; points: number; played: boolean }

// Todo lo que devuelve el mercado: jugadores + fixtures + propiedad + puntos recientes.
export interface MarketData {
  players: MarketPlayer[]; rules: FantasyRules; budget: number;
  gameweek?: Gameweek;
  fixtures?: Record<string, RoundFixture>;
  upcoming?: Record<string, UpcomingFixture[]>;
  ownership?: Record<string, number>;
  recent?: Record<string, RecentScore[]>;
}

export interface FantasyState {
  squad: {
    id: string; teamName: string; captainId: string | null; viceCaptainId: string | null;
    bank: number; squadValue: number;
  } | null;
  roster?: RosterPlayer[];
  gameweek: Gameweek;
  currentLineup?: {
    starters: string[]; bench: string[]; captainId: string | null; viceCaptainId: string | null; chip: string | null; points: number;
  } | null;
  overallPoints?: number;
  perGw?: Array<{ round: number; points: number }>;
  history?: GwHistory[];
  bank?: number;
  freeTransfers?: number;
  chips?: { wildcard: boolean; freeHit: boolean; benchBoost: boolean; tripleCaptain: boolean };
  rules: FantasyRules;
  budget?: number;
}

function authHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

export async function fetchMarket(division: Division): Promise<MarketData> {
  const res = await fetch(`${API}/api/v1/fantasy/players?division=${division}`, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar el mercado");
  return res.json();
}

export async function fetchState(division: Division): Promise<FantasyState> {
  const res = await fetch(`${API}/api/v1/fantasy/state?division=${division}`, { cache: "no-store", credentials: "include" });
  if (res.status === 401) throw new Error("Debes iniciar sesión");
  if (!res.ok) throw new Error("No se pudo cargar tu equipo");
  return res.json();
}

export async function saveSquad(body: {
  division: Division; teamName: string;
  playerIds: Array<{ arusaId: string; clubSlug: string; playerName: string; purchasePrice: number }>;
  captainId?: string; viceCaptainId?: string;
}): Promise<unknown> {
  const res = await fetch(`${API}/api/v1/fantasy/squad`, { method: "POST", headers: authHeaders(), credentials: "include", body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? "No se pudo guardar");
  return data;
}

export async function saveLineup(body: {
  division: Division; starters: string[]; bench: string[];
  captainId?: string; viceCaptainId?: string; chip?: string | null;
}): Promise<unknown> {
  const res = await fetch(`${API}/api/v1/fantasy/lineup`, { method: "POST", headers: authHeaders(), credentials: "include", body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? "No se pudo guardar la alineación");
  return data;
}

export async function makeTransfers(body: {
  division: Division; out: string[];
  in: Array<{ arusaId: string; clubSlug: string; playerName: string }>;
  chip?: string | null;
}): Promise<{ hits: number; bank: number; freeTransfers: number }> {
  const res = await fetch(`${API}/api/v1/fantasy/transfers`, { method: "POST", headers: authHeaders(), credentials: "include", body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? "No se pudieron hacer las transferencias");
  return data as { hits: number; bank: number; freeTransfers: number };
}

export const money = (tenths: number) => `$${(tenths / 10).toFixed(1)}M`;
