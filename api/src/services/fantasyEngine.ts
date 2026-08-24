// Motor del fantasy estilo FPL (adaptado a rugby, sin formación).
//
// Reglas del plantel y el puntaje por fecha: 19 jugadores (15 titulares + 4
// banca), presupuesto, capitán/vice, chips y auto-subs. El puntaje por FECHA se
// calcula desde fantasy_gameweek_scores (una fila por jugador por ronda), así que
// el plantel se juega como en FPL: cada jornada suma según quién jugó y quién es
// titular/capitán, con la banca cubriendo a los que no jugaron.

import { fetchAllMatchesMeta, type DivisionKey } from "../lib/leverade";

const DIV_MAP: Record<string, DivisionKey> = {
  primera: "PRIMERA", intermedia: "INTERMEDIA", "pre-intermedia": "PRE_INTERMEDIA",
};

// Fecha actual del fantasy + deadline (primer kickoff de la ronda). Después del
// deadline la fecha queda "bloqueada" (no se cambian titulares/transfers). El
// datetime de Leverade es UTC.
export async function getCurrentGameweek(
  division: string,
): Promise<{ round: number; deadline: string | null; locked: boolean }> {
  const dk = DIV_MAP[division] ?? "PRIMERA";
  let meta;
  try { meta = await fetchAllMatchesMeta(); } catch { return { round: 1, deadline: null, locked: false }; }
  const div = meta.filter((m) => m.division === dk && !m.postponed && !m.canceled);
  const rounds = [...new Set(div.map((m) => m.round))].sort((a, b) => a - b);
  const round =
    rounds.find((r) => div.some((m) => m.round === r && !m.finished)) ??
    rounds[rounds.length - 1] ?? 1;
  const kicks = div
    .filter((m) => m.round === round && m.datetime)
    .map((m) => Date.parse(m.datetime!.replace(" ", "T") + "Z"))
    .filter(Number.isFinite);
  const deadline = kicks.length ? new Date(Math.min(...kicks)).toISOString() : null;
  const locked = deadline ? Date.now() >= Date.parse(deadline) : false;
  return { round, deadline, locked };
}

// Modelo Seis Naciones: un XV por posición (15) + 1 super sub = 16 jugadores.
// Sin formaciones (siempre el XV estándar), capitán ×2 y el super sub entra por
// el titular que no juegue.
export const FANTASY_RULES = {
  SQUAD_SIZE: 16,
  STARTERS: 15,
  BENCH: 1,           // el super sub
  BUDGET: 1000,       // 100.0M en décimas
  MAX_PER_CLUB: 3,
  FREE_TRANSFERS_MAX: 2,
  HIT_COST: 4,        // puntos por transferencia extra
  CAPTAIN_MULT: 2,
} as const;

export type Chip = "wildcard" | "free_hit";

export interface GwScore {
  arusaId: string;
  pointsEarned: number;
  played: boolean;
  // ¿Entró de SUPLENTE en el partido real? (para la regla del super sub: ×2 si
  // entró de suplente, ÷2 si fue titular). undefined = desconocido → sin modif.
  wasSub?: boolean;
}

export interface LineupInput {
  starters: string[];        // 15 arusaIds
  bench: string[];           // 4 arusaIds, en orden de prioridad de sub
  captainId: string | null;
  viceCaptainId: string | null;
  chip: string | null;       // Chip | null
  hits: number;              // puntos ya descontados por transfers extra
}

export interface LineupResult {
  points: number;                                    // neto de la fecha (con chip y hits)
  scoringIds: string[];                              // quiénes puntuaron (post auto-subs / bench boost)
  captainUsedId: string | null;                      // quién llevó la jineta finalmente
  autoSubs: Array<{ out: string; in: string }>;      // subs aplicados
  gross: number;                                     // puntos antes de restar hits
}

/**
 * Puntos de una alineación en una fecha (Seis Naciones):
 * - Los 15 titulares suman sus puntos. Capitán ×2 (vice si el capitán no jugó).
 * - Super sub (OPCIONAL, bench[0]): suma como 16° jugador con modificador —
 *   ×2 si entró de SUPLENTE en el partido real, ÷2 si fue TITULAR (0 si no jugó).
 * - Se descuentan los `hits` (−4 por transferencia extra).
 */
export function computeLineupPoints(lineup: LineupInput, scores: Map<string, GwScore>): LineupResult {
  const played = (id: string | null | undefined) => (id ? scores.get(id)?.played ?? false : false);
  const pts = (id: string) => scores.get(id)?.pointsEarned ?? 0;

  // Jineta: capitán si jugó, si no el vice; si tampoco, el capitán (suma 0).
  const captainUsedId = played(lineup.captainId)
    ? lineup.captainId
    : played(lineup.viceCaptainId)
      ? lineup.viceCaptainId
      : lineup.captainId;

  let gross = 0;
  const scoringIds: string[] = [];
  for (const id of lineup.starters) {
    scoringIds.push(id);
    let p = pts(id);
    if (captainUsedId && id === captainUsedId) p *= FANTASY_RULES.CAPTAIN_MULT;
    gross += p;
  }

  // Super sub (opcional): modificador ×2 (entró de suplente) / ÷2 (fue titular).
  const superSub = lineup.bench[0];
  if (superSub && played(superSub)) {
    const sc = scores.get(superSub);
    const mult = sc?.wasSub === true ? 2 : sc?.wasSub === false ? 0.5 : 1; // undefined → sin modif hasta tener el dato
    gross += Math.round(pts(superSub) * mult);
    scoringIds.push(superSub);
  }

  const points = gross - (lineup.hits ?? 0);
  return { points, scoringIds, captainUsedId: captainUsedId ?? null, autoSubs: [], gross };
}

/** Valida la composición de un plantel (19 jugadores, ≤3 por club, presupuesto). */
export function validateSquad(
  players: Array<{ arusaId: string; clubSlug: string; price: number }>,
): { ok: true } | { ok: false; error: string } {
  if (players.length < FANTASY_RULES.STARTERS || players.length > FANTASY_RULES.SQUAD_SIZE) {
    return { ok: false, error: `El plantel debe tener ${FANTASY_RULES.STARTERS} titulares (+ super sub opcional)` };
  }
  const ids = new Set(players.map((p) => p.arusaId));
  if (ids.size !== players.length) return { ok: false, error: "Hay jugadores repetidos" };
  const byClub: Record<string, number> = {};
  let cost = 0;
  for (const p of players) {
    byClub[p.clubSlug] = (byClub[p.clubSlug] ?? 0) + 1;
    if (byClub[p.clubSlug] > FANTASY_RULES.MAX_PER_CLUB) {
      return { ok: false, error: `Máximo ${FANTASY_RULES.MAX_PER_CLUB} jugadores por club` };
    }
    cost += p.price;
  }
  if (cost > FANTASY_RULES.BUDGET) {
    return { ok: false, error: `Te pasaste del presupuesto (${(cost / 10).toFixed(1)}M / ${(FANTASY_RULES.BUDGET / 10).toFixed(1)}M)` };
  }
  return { ok: true };
}

/** Valida que titulares (15) + banca (4) sean exactamente los 19 del plantel. */
export function validateLineup(
  starters: string[],
  bench: string[],
  rosterIds: string[],
): { ok: true } | { ok: false; error: string } {
  if (starters.length !== FANTASY_RULES.STARTERS) return { ok: false, error: `Deben ser ${FANTASY_RULES.STARTERS} titulares` };
  if (bench.length > FANTASY_RULES.BENCH) return { ok: false, error: `El super sub es 1 jugador (opcional)` };
  const line = [...starters, ...bench];
  const set = new Set(line);
  if (set.size !== line.length) return { ok: false, error: "Un jugador está repetido entre titulares y banca" };
  const roster = new Set(rosterIds);
  for (const id of line) if (!roster.has(id)) return { ok: false, error: "Hay un jugador que no está en tu plantel" };
  return { ok: true };
}
