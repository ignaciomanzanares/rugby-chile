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
    // Fresco por defecto (cliente); si el llamador pide cacheo explícito (el home
    // con next.revalidate para ISR) lo respetamos en vez de forzar no-cache.
    const cacheDefault = init?.cache || (init as { next?: unknown })?.next ? {} : { cache: "no-cache" as const };
    const res = await fetch(`${API_URL}/api/v1/calendar`, { ...cacheDefault, ...init });
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
    const matches = r.matches.map((m): RoundMatch => {
      const am = byPair.get(`${m.home}|${m.away}`);
      if (!am) return m;
      // arusa manda sobre el estado aplazado: si trae fecha real, el partido se
      // reprogramó → deja de estar aplazado aunque ROUNDS lo tenga hardcodeado
      // como postponed. Sólo si arusa no tiene fecha NI marca aplazado (no sabe
      // nada) caemos al postponed del fixture base.
      const off = am.postponed || am.canceled;
      const arusaHasDate = am.date != null;
      const postponed = off || (!arusaHasDate && !!m.postponed);
      return {
        ...m,
        date: am.date ?? m.date,
        time: am.time ?? m.time,
        venue: am.venue ?? m.venue,
        postponed,
        reschedule: postponed ? (m.reschedule ?? "A definir") : undefined,
      };
    });
    // Si el encabezado de la fecha era un placeholder ("suspendida" / "a definir")
    // pero arusa ya reprogramó los partidos con fecha real, recalculamos la
    // etiqueta desde esas fechas para no mostrar "18-19 Jul · suspendida" arriba
    // mientras los partidos ya dicen "29 Ago" (caso F12 de Primera).
    const dates = /suspendid|aplaz|definir/i.test(r.dates ?? "")
      ? roundDatesLabel(matches, r.dates)
      : r.dates;
    return { ...r, dates, matches };
  });
}

/** Etiqueta de fecha derivada de los partidos ya reprogramados (sin aplazar). */
function roundDatesLabel(matches: RoundMatch[], fallback: string): string {
  const uniq = [...new Set(
    matches
      .filter((m) => !m.postponed && m.date)
      .map((m) => m.date.replace(/^\S+\s+/, "")), // "Sáb 29 Ago" → "29 Ago"
  )];
  return uniq.length ? uniq.join(" · ") : fallback;
}

/** Rondas efectivas por división (arusa superpuesto), listo para consumir. */
export function effectiveRounds(cal: ArusaCalendar | null): Record<DivisionKey, Round[]> {
  return {
    PRIMERA: overlayRounds("PRIMERA", cal),
    INTERMEDIA: overlayRounds("INTERMEDIA", cal),
    PRE_INTERMEDIA: overlayRounds("PRE_INTERMEDIA", cal),
  };
}
