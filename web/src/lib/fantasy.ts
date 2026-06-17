import { PLAYER_STATS_BY_DIVISION } from "@/data/player-stats";
import { PLAYER_POSITIONS, type PlayerPosition } from "@/data/player-positions";

export type Division = "primera" | "intermedia" | "pre-intermedia";

// ── Positions & formation (6-Nations-style XV) ──────────────────────────────
export type Position =
  | "PROP" | "HOOKER" | "LOCK" | "FLANKER" | "NUMBER_8"
  | "SCRUM_HALF" | "FLY_HALF" | "CENTER" | "WING" | "FULLBACK";

export const POSITION_LABELS: Record<Position, string> = {
  PROP: "Pilar", HOOKER: "Hooker", LOCK: "Segunda línea", FLANKER: "Ala",
  NUMBER_8: "Número 8", SCRUM_HALF: "Medio scrum", FLY_HALF: "Apertura",
  CENTER: "Centro", WING: "Wing", FULLBACK: "Fullback",
};

export const POSITION_SHORT: Record<Position, string> = {
  PROP: "PIL", HOOKER: "HOO", LOCK: "2L", FLANKER: "ALA", NUMBER_8: "N8",
  SCRUM_HALF: "MS", FLY_HALF: "AP", CENTER: "CEN", WING: "WIN", FULLBACK: "FB",
};

// Forwards 1-8, backs 9-15 — used for grouping/colour in the UI.
export const FORWARDS: Position[] = ["PROP", "HOOKER", "LOCK", "FLANKER", "NUMBER_8"];
export const isForward = (p: Position): boolean => FORWARDS.includes(p);

export interface FormationSlot {
  id: string;        // stable slot key
  position: Position;
  x: number;         // % across the pitch (0 left – 100 right)
  y: number;         // % up the pitch (0 attacking end – 100 own line)
}

// A vertical pitch, attacking upward: back three highest, pack at the base.
export const FORMATION: FormationSlot[] = [
  { id: "FB",  position: "FULLBACK",   x: 50, y: 8 },
  { id: "W1",  position: "WING",       x: 14, y: 17 },
  { id: "W2",  position: "WING",       x: 86, y: 17 },
  { id: "C1",  position: "CENTER",     x: 37, y: 29 },
  { id: "C2",  position: "CENTER",     x: 63, y: 29 },
  { id: "FH",  position: "FLY_HALF",   x: 71, y: 41 },
  { id: "SH",  position: "SCRUM_HALF", x: 43, y: 50 },
  { id: "N8",  position: "NUMBER_8",   x: 50, y: 64 },
  { id: "F1",  position: "FLANKER",    x: 24, y: 67 },
  { id: "F2",  position: "FLANKER",    x: 76, y: 67 },
  { id: "L1",  position: "LOCK",       x: 39, y: 77 },
  { id: "L2",  position: "LOCK",       x: 61, y: 77 },
  { id: "P1",  position: "PROP",       x: 24, y: 87 },
  { id: "HK",  position: "HOOKER",     x: 50, y: 88 },
  { id: "P2",  position: "PROP",       x: 76, y: 87 },
];

// How many of each position the XV requires (derived from FORMATION).
export const POSITION_NEEDS: Record<Position, number> = FORMATION.reduce((acc, s) => {
  acc[s.position] = (acc[s.position] ?? 0) + 1;
  return acc;
}, {} as Record<Position, number>);

// A player's full position record (primary/secondary/division), or undefined.
export function getPositionInfo(arusaId: string): PlayerPosition | undefined {
  return PLAYER_POSITIONS[arusaId];
}

// A player's primary position, falling back to PROP so the UI never breaks on
// an unmapped id.
export function getPosition(arusaId: string): Position {
  return PLAYER_POSITIONS[arusaId]?.primary ?? "PROP";
}

// Can this player fill a given formation slot? True if the slot matches their
// primary or secondary position.
export function playsPosition(player: FantasyPlayer, pos: Position): boolean {
  return player.position === pos || player.secondary === pos;
}

// Map between fantasy division keys and the stats file's DivisionKey
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
  position: Position;        // primary
  secondary?: Position;
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
  // Pool all three stats grades and bucket by the player's *lineup-derived*
  // division (where they actually play most), not where ARUSA files their stats
  // — a player can score in Intermedia but start in Primera.
  const all = [
    ...PLAYER_STATS_BY_DIVISION.PRIMERA,
    ...PLAYER_STATS_BY_DIVISION.INTERMEDIA,
    ...PLAYER_STATS_BY_DIVISION.PRE_INTERMEDIA,
  ];

  // Deduplicate by ID (keep the one with most points).
  const byId = new Map<string, typeof all[number]>();
  for (const p of all) {
    const existing = byId.get(p.id);
    if (!existing || p.points > existing.points) byId.set(p.id, p);
  }

  return [...byId.values()]
    .filter((p) => p.matches > 0 && PLAYER_POSITIONS[p.id])  // only players with a real lineup position
    .map((p) => {
      const info = PLAYER_POSITIONS[p.id]!;
      return {
        id: p.id,
        name: p.name,
        clubSlug: p.teamSlug,
        clubName: p.team,
        price: computePrice(p),
        position: info.primary,
        secondary: info.secondary,
        division: info.division,
        stats: {
          tries: p.tries,
          conversions: p.conversions,
          penalties: p.penalties,
          drops: p.drops,
          points: p.points,
          matches: p.matches,
          mvp: p.mvp,
        },
      };
    })
    .filter((p) => p.division === division)
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

export type Assignments = Record<string, FantasyPlayer | null>;

export const emptyAssignments = (): Assignments =>
  Object.fromEntries(FORMATION.map((s) => [s.id, null]));

// Greedily seat a flat list of players into formation slots by matching
// position (used when loading a saved squad, which stores no slot info).
export function assignToFormation(players: FantasyPlayer[]): Assignments {
  const slots = emptyAssignments();
  const pool = [...players];
  const seat = (pred: (p: FantasyPlayer, slot: FormationSlot) => boolean) => {
    for (const slot of FORMATION) {
      if (slots[slot.id]) continue;
      const i = pool.findIndex((p) => pred(p, slot));
      if (i >= 0) { slots[slot.id] = pool[i]; pool.splice(i, 1); }
    }
  };
  seat((p, slot) => p.position === slot.position);        // primary first
  seat((p, slot) => p.secondary === slot.position);       // then secondary
  // Any leftover (position mismatch from stale data) fills the first empty slot.
  for (const p of pool) {
    const empty = FORMATION.find((s) => !slots[s.id]);
    if (empty) slots[empty.id] = p;
  }
  return slots;
}

export const assignedPlayers = (a: Assignments): FantasyPlayer[] =>
  FORMATION.map((s) => a[s.id]).filter((p): p is FantasyPlayer => p != null);

// Validate a pitch of assignments: every slot filled, budget + club limits ok.
export function validateAssignments(a: Assignments): string | null {
  const players = assignedPlayers(a);
  const filled = players.length;
  if (filled !== SQUAD_SIZE) return `Completa la formación (${filled}/${SQUAD_SIZE})`;
  return validateSquad(players);
}
