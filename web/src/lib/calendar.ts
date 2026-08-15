import { ROUNDS, type DivisionKey, type Round, type RoundMatch } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Un partido tal como lo trae el calendario de arusa (API /calendar). */
export interface ArusaCalMatch {
  home: string;
  away: string;
  date: string | null;
  time: string | null;
  venue: string | null;
  postponed: boolean;
  canceled: boolean;
}
export interface ArusaCalRound {
  round: number;
  matches: ArusaCalMatch[];
}
export type ArusaCalendar = Partial<Record<DivisionKey, ArusaCalRound[]>>;

/**
 * Trae el calendario en vivo de arusa (horarios/sedes/aplazados) desde la API.
 * Devuelve null si falla — el llamador cae al fixture hardcodeado (ROUNDS).
 * Sirve para SSR (con timeout corto) y para el cliente.
 */
export async function fetchArusaCalendar(init?: RequestInit): Promise<ArusaCalendar | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/calendar`, { cache: "no-cache", ...init });
    if (!res.ok) return null;
    return (await res.json()) as ArusaCalendar;
  } catch {
    return null;
  }
}

/**
 * Superpone el calendario de arusa sobre el fixture base (ROUNDS) de una división:
 * arusa manda en horario, sede y estado aplazado/cancelado; ROUNDS aporta la
 * estructura (qué se juega cada fecha) y es el fallback si arusa no tiene el dato.
 * Empareja por (home|away). Devuelve rondas nuevas (no muta ROUNDS).
 */
export function overlayRounds(division: DivisionKey, cal: ArusaCalendar | null): Round[] {
  const base = ROUNDS[division];
  const arusaRounds = cal?.[division];
  if (!arusaRounds || arusaRounds.length === 0) return base;

  const byRound = new Map(arusaRounds.map((r) => [r.round, r]));
  return base.map((r) => {
    const ar = byRound.get(r.round);
    if (!ar) return r;
    const byPair = new Map(ar.matches.map((m) => [`${m.home}|${m.away}`, m]));
    return {
      ...r,
      matches: r.matches.map((m): RoundMatch => {
        const am = byPair.get(`${m.home}|${m.away}`);
        if (!am) return m;
        const off = am.postponed || am.canceled;
        return {
          ...m,
          date: am.date ?? m.date,
          time: am.time ?? m.time,
          venue: am.venue ?? m.venue,
          postponed: off || m.postponed,
          reschedule: off ? (m.reschedule ?? "A definir") : m.reschedule,
        };
      }),
    };
  });
}

/** Rondas efectivas por división (arusa superpuesto), listo para consumir. */
export function effectiveRounds(cal: ArusaCalendar | null): Record<DivisionKey, Round[]> {
  return {
    PRIMERA: overlayRounds("PRIMERA", cal),
    INTERMEDIA: overlayRounds("INTERMEDIA", cal),
    PRE_INTERMEDIA: overlayRounds("PRE_INTERMEDIA", cal),
  };
}
