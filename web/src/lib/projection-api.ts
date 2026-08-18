import type { Projection } from "@/components/home-projection-preview";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Proyección Monte Carlo de la temporada desde la API. Devuelve null si falla —
 * el llamador cae al skeleton del cliente. La proyección solo cambia cuando
 * termina una fecha, así que sembrarla en el shell ISR la deja lista al instante
 * (la API la sirve cacheada/SWR; recomputar solo pasa tras una fecha nueva).
 */
export async function fetchSeasonProjection(init?: RequestInit): Promise<Projection | null> {
  try {
    const cacheDefault = init?.cache || (init as { next?: unknown })?.next ? {} : { cache: "no-cache" as const };
    const res = await fetch(`${API_URL}/api/v1/predict/season`, { ...cacheDefault, ...init });
    if (!res.ok) return null;
    return (await res.json()) as Projection;
  } catch {
    return null;
  }
}
