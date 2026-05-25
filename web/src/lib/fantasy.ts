import { PLAYER_STATS_BY_DIVISION } from "@/data/player-stats";
import type { DivisionKey } from "@/data/player-stats";

export type Division = "primera" | "intermedia" | "pre-intermedia";

// Map between fantasy division keys and the stats file's DivisionKey
const DIVISION_STAT_KEY: Record<Division, DivisionKey> = {
  "primera":        "PRIMERA",
  "intermedia":     "INTERMEDIA",
  "pre-intermedia": "PRE_INTERMEDIA",
};

export const DIVISION_LABELS: Record<Division, string> = {
  "primera":        "Primera",
  "intermedia":     "Intermedia",
  "pre-intermedia": "Pre-Intermedia",
};

export const ALL_DIVISIONS: Division[] = ["primera", "intermedia", "pre-intermedia"];

export type FantasyPlayer = {
  id: string;       // ARUSA ID
  name: string;
  clubSlug: string;
  clubName: string;
  price: number;    // in millions e.g. 6.5
  division: Division;
  stats: {
    tries: number; conversions: number; penalties: number;
    drops: number; points: number; matches: number; mvp: number;
  };
};

function computePrice(p: { tries: number; penaltyTries: number; conversions: number; penalties: number; drops: number; mvp: number }): number {
  const score = p.tries * 2 + p.penaltyTries * 2 + p.conversions * 0.5 + p.penalties * 0.75 + p.drops + p.mvp * 1.5;
  const raw = 4.5 + score * 0.3;
  return Math.min(12, Math.max(4.5, Math.round(raw * 2) / 2));
}

export function getAllFantasyPlayers(division: Division = "primera"): FantasyPlayer[] {
  const statKey = DIVISION_STAT_KEY[division];
  const pool = PLAYER_STATS_BY_DIVISION[statKey] ?? [];

  // Deduplicate by ID (keep the one with most points)
  const byId = new Map<string, typeof pool[number]>();
  for (const p of pool) {
    const existing = byId.get(p.id);
    if (!existing || p.points > existing.points) byId.set(p.id, p);
  }

  return [...byId.values()]
    .filter((p) => p.matches > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      clubSlug: p.teamSlug,
      clubName: p.team,
      price: computePrice(p),
      division,
      stats: {
        tries: p.tries,
        conversions: p.conversions,
        penalties: p.penalties,
        drops: p.drops,
        points: p.points,
        matches: p.matches,
        mvp: p.mvp,
      },
    }))
    .sort((a, b) => b.price - a.price);
}

export const BUDGET = 100;
export const SQUAD_SIZE = 15;
export const MAX_PER_CLUB = 3;

export function budgetUsed(squad: FantasyPlayer[]): number {
  return squad.reduce((s, p) => s + p.price, 0);
}

export function validateSquad(squad: FantasyPlayer[]): string | null {
  if (squad.length !== SQUAD_SIZE) return `Selecciona exactamente ${SQUAD_SIZE} jugadores (${squad.length}/${SQUAD_SIZE})`;
  if (budgetUsed(squad) > BUDGET) return `Presupuesto excedido ($${budgetUsed(squad).toFixed(1)}M / $${BUDGET}M)`;
  const clubCounts: Record<string, number> = {};
  for (const p of squad) {
    clubCounts[p.clubSlug] = (clubCounts[p.clubSlug] ?? 0) + 1;
    if (clubCounts[p.clubSlug] > MAX_PER_CLUB) return `Máximo ${MAX_PER_CLUB} jugadores del mismo club`;
  }
  return null;
}
