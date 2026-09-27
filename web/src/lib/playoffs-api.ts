import type { Playoffs } from "@/lib/use-playoffs";
import type { DivisionKey } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Cuadro de playoffs desde el servidor, para sembrar el home sin parpadeo.
 *
 * Devuelve null ante cualquier problema —API fría, red, cuadro vacío— porque el
 * cliente vuelve a pedirlo igual con reintentos (ver usePlayoffs). Nunca hace
 * fallar el render del home por esto.
 */
export async function fetchPlayoffs(
  division: DivisionKey,
  init?: RequestInit & { next?: { revalidate?: number } },
): Promise<Playoffs | null> {
  try {
    const r = await fetch(`${API_URL}/api/v1/playoffs?division=${division}`, init);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.semifinals?.length ? (d as Playoffs) : null;
  } catch {
    return null;
  }
}
