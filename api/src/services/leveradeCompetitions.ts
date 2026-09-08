/**
 * Vigila si ARUSA abre una competencia nueva (playoffs, repechaje, ascenso).
 *
 * Los playoffs NO son fechas nuevas del torneo regular: históricamente ARUSA los
 * crea como TORNEO APARTE — en el historial de Leverade están "Repechajes 2023",
 * "Repechajes 2024", "Triangular Ascenso - Segunda Nacional". Si no los buscamos,
 * al terminar la fecha 18 el sitio se queda mostrando la fase regular para
 * siempre y las semifinales no aparecen nunca.
 *
 * Cubrimos las dos formas posibles:
 *   1. Un torneo nuevo en `in_progress` bajo el mismo manager.
 *   2. Rondas más allá de la 18 dentro del torneo actual.
 */
import { readCache, writeCache } from "../lib/arusaCache";
import { fetchAllMatchesMeta } from "../lib/leverade";

const MANAGER_ID = "532872";
const CURRENT_TOURNAMENT = "1328550";
const REGULAR_ROUNDS = 18;
const LEVERADE_BASE = "https://api.leverade.com";
const SEEN_KEY = "leverade:known-tournaments";

export interface Competition { id: string; name: string; status: string }

/** Torneos activos del manager de ARUSA. */
export async function fetchActiveCompetitions(): Promise<Competition[]> {
  try {
    const res = await fetch(`${LEVERADE_BASE}/tournaments?filter=manager.id:${MANAGER_ID},status:in_progress&page[size]=100`, {
      headers: { Accept: "application/vnd.api+json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    const json: any = await res.json();
    return (json?.data ?? []).map((t: any) => ({
      id: String(t.id),
      name: String(t.attributes?.name ?? ""),
      status: String(t.attributes?.status ?? ""),
    }));
  } catch {
    return [];
  }
}

/**
 * Devuelve lo que apareció desde la última vez. La primera corrida solo registra
 * lo que ya existe (no avisa de los 13 torneos actuales como si fueran noticia).
 */
export async function checkForNewCompetitions(): Promise<{ nuevos: Competition[]; rondasExtra: number[] }> {
  const active = await fetchActiveCompetitions();
  const known = (await readCache<string[]>(SEEN_KEY)) ?? null;
  const ids = active.map((t) => t.id);

  let nuevos: Competition[] = [];
  if (known === null) {
    await writeCache(SEEN_KEY, ids); // primera vez: solo memorizar
  } else {
    nuevos = active.filter((t) => !known.includes(t.id));
    if (nuevos.length) await writeCache(SEEN_KEY, ids);
  }

  // Y por si los playoffs vienen como fechas nuevas del torneo actual.
  let rondasExtra: number[] = [];
  try {
    const meta = await fetchAllMatchesMeta();
    rondasExtra = [...new Set(meta.filter((m) => m.round > REGULAR_ROUNDS).map((m) => m.round))].sort((a, b) => a - b);
  } catch { /* sin meta, no pasa nada */ }

  for (const t of nuevos) {
    console.warn(`[leverade] COMPETENCIA NUEVA de ARUSA: ${t.id} — "${t.name}". ¿Son los playoffs? Revisar si hay que cubrirla.`);
  }
  if (rondasExtra.length) {
    console.warn(`[leverade] el torneo ${CURRENT_TOURNAMENT} tiene rondas más allá de la ${REGULAR_ROUNDS}: ${rondasExtra.join(", ")}`);
  }
  return { nuevos, rondasExtra };
}
