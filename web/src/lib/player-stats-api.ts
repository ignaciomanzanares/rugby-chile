import type { DivisionKey, DivisionPlayerStat } from "@/data/player-stats";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Stats de temporada por jugador (arusa) desde la API. Devuelve null si falla —
 * el llamador cae al baseline estático / skeleton. Sirve para SSR (con
 * next.revalidate para ISR y timeout corto) y para el cliente.
 */
export async function fetchPlayerStats(
  division: DivisionKey,
  init?: RequestInit,
): Promise<DivisionPlayerStat[] | null> {
  try {
    // Fresco por defecto (cliente); si el llamador pide cacheo explícito (el home
    // con next.revalidate para ISR) lo respetamos en vez de forzar no-cache.
    const cacheDefault = init?.cache || (init as { next?: unknown })?.next ? {} : { cache: "no-cache" as const };
    const res = await fetch(`${API_URL}/api/v1/stats/players?division=${division}`, { ...cacheDefault, ...init });
    if (!res.ok) return null;
    const d = await res.json();
    return (d?.players as DivisionPlayerStat[]) ?? null;
  } catch {
    return null;
  }
}
