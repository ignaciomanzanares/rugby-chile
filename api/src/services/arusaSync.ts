/**
 * Background arusa warm-sync.
 *
 * arusa.cl is reachable only intermittently on some networks. This polls it on
 * an interval and, on any success, the fetchers persist the data to arusa_cache
 * (see lib/arusaCache). So the site captures the latest standings/results during
 * whatever windows arusa is up and keeps serving them through the outages,
 * instead of reverting to the static baseline.
 */
import { fetchStandings, fetchPlayerStats, type DivisionKey } from "../lib/leverade";
import { fetchAllResults } from "../routes/leveradeResults";
import { scrapeArusaNews } from "./arusaNews";
import { prewarmH2H } from "./computeH2H";
import { checkAndNotifyFinals } from "./pushFinals";
import { pushToSportos } from "./pushSportos";

const DIVISIONS: DivisionKey[] = ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"];

export async function syncArusa(): Promise<void> {
  await Promise.allSettled([
    ...DIVISIONS.map((d) => fetchStandings(d)),
    ...DIVISIONS.map((d) => fetchPlayerStats(d)),
    fetchAllResults(),
  ]);
  // Pull real news from arusa (idempotent).
  await scrapeArusaNews().catch(() => {});
  // Warm head-to-head for the next round's fixtures (cheap once cached).
  await prewarmH2H().catch(() => {});
  // Avisa por push los partidos de Primera que acaban de terminar.
  await checkAndNotifyFinals().catch(() => {});
  // Reenvía a SportOS lo que ya trajimos. No agrega peticiones a arusa: es el
  // único escritor de su caché porque arusa bloquea a SportOS por IP.
  await pushToSportos().catch(() => {});
}

// Cadencia adaptativa: los datos de arusa (tabla, resultados, stats) sólo cambian
// los fines de semana con partidos. Sincronizar cada 45s las 24h re-descargaba lo
// mismo 1920 veces/día — era el ~96% del bandwidth de salida de Render
// ("Service-Initiated"). Ahora rápido sólo en ventana de partidos, lento el resto.
const FAST_MS = 60_000; // en juego / ventana de partidos: fresco al minuto
const SLOW_MS = 15 * 60_000; // fuera de ventana: sólo mantener el caché tibio

// ¿Estamos en una ventana probable de partidos? El server corre en UTC; Chile es
// UTC-4. Los partidos van vie tarde-noche y sáb/dom de día (Pre 10:00 → Primera
// ~16:00, con margen). Fuera de esto la tabla no se mueve.
function isMatchWindow(now: Date = new Date()): boolean {
  const cl = new Date(now.getTime() - 4 * 3600_000); // a hora de Chile
  const day = cl.getUTCDay(); // 0=dom … 6=sáb
  const h = cl.getUTCHours();
  if (day === 6 || day === 0) return h >= 8 && h < 22; // sáb/dom 08–22
  if (day === 5) return h >= 16; // vie desde las 16
  return false;
}

export function startArusaSync(): void {
  const tick = () => {
    syncArusa()
      .catch(() => {})
      .finally(() => {
        setTimeout(tick, isMatchWindow() ? FAST_MS : SLOW_MS);
      });
  };
  tick(); // warm immediately on startup
}
