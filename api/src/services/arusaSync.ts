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

// Escalonado: en pleno partido el poller YA scrapea arusa por cada partido en
// vivo. Si además sincronizamos tabla + stats paginadas + resultados + noticias
// cada 60s, el doble golpe a arusa dispara sus 429 (throttle por IP). Solución:
// lo crítico en vivo (marcador + tabla) va SIEMPRE; lo que cambia lento
// (estadísticas de temporada, noticias, H2H) sólo cada HEAVY_EVERY ticks. Los
// goleadores en vivo no dependen de esto: salen de los eventos del poller
// (stats/live). Esto ~parte a la mitad los golpes a arusa durante los partidos.
const HEAVY_EVERY = 5; // en FAST (60s) → lo pesado cada ~5 min
let tick = 0;

export async function syncArusa(): Promise<void> {
  const heavy = tick % HEAVY_EVERY === 0; // tick 0 (boot) hace todo: warm completo
  tick++;

  await Promise.allSettled([
    ...DIVISIONS.map((d) => fetchStandings(d)), // tabla: cambia al terminar partidos → siempre
    fetchAllResults(), // marcadores: crítico en vivo → siempre
    ...(heavy ? DIVISIONS.map((d) => fetchPlayerStats(d)) : []), // stats de temporada → cada N
  ]);
  // Avisa por push los partidos de Primera que acaban de terminar (lee caché, barato).
  await checkAndNotifyFinals().catch(() => {});
  if (heavy) {
    // Noticias y H2H cambian lento: sólo cada N ticks.
    await scrapeArusaNews().catch(() => {});
    await prewarmH2H().catch(() => {});
  }
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
