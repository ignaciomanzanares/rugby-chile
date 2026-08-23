/**
 * Background arusa warm-sync.
 *
 * arusa.cl is reachable only intermittently on some networks. This polls it on
 * an interval and, on any success, the fetchers persist the data to arusa_cache
 * (see lib/arusaCache). So the site captures the latest standings/results during
 * whatever windows arusa is up and keeps serving them through the outages,
 * instead of reverting to the static baseline.
 */
import { fetchStandings, fetchPlayerStats, fetchAllMatchesMeta, batchScrapeTries, type DivisionKey } from "../lib/leverade";
import { fetchAllResults } from "../routes/leveradeResults";
import { fetchCalendar } from "./arusaCalendar";
import { scrapeArusaNews } from "./arusaNews";
import { prewarmH2H } from "./computeH2H";
import { checkAndNotifyFinals } from "./pushFinals";
import { pushToSportos } from "./pushSportos";
import { autoScoreFantasy } from "./fantasyAutoScore";
import { adjustDynamicPrices } from "./fantasyPricing";

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
    // Noticias, H2H y calendario cambian lento: sólo cada N ticks.
    await scrapeArusaNews().catch(() => {});
    await prewarmH2H().catch(() => {});
    await Promise.allSettled(DIVISIONS.map((d) => fetchCalendar(d)));
    // Recalcular los puntos del fantasy desde las stats de temporada (recién
    // refrescadas arriba). Mantiene los equipos y el ranking al día, incluso con
    // lo que sumen los partidos del día a medida que arusa actualiza.
    await autoScoreFantasy().catch(() => {});

    // Relleno proactivo del minuto a minuto: batchScrapeTries está TOPADO a 12
    // frescos por llamada (persiste eventos+tries de partidos terminados, que son
    // inmutables), así que esto NO ráfaga — completa el histórico de a 12 por
    // tick pesado, en unas horas, y de ahí queda servido de DB para siempre.
    await fetchAllMatchesMeta()
      .then((meta) => batchScrapeTries(meta.filter((m) => m.finished)))
      .catch(() => {});

    // Precios dinámicos del fantasy: mueve el valor de los jugadores según cuánta
    // gente los compra/vende (net transfers). Barato (solo DB), corre cada N ticks.
    for (const d of ["primera", "intermedia", "pre-intermedia"]) {
      await adjustDynamicPrices(d).catch(() => {});
    }
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

// ¿Estamos en una ventana probable de partidos? El server corre en UTC; usamos
// la hora REAL de Chile vía Intl (maneja el cambio de horario solo: -3 en verano,
// -4 en invierno; antes estaba hardcodeado -4 y en verano quedaba corrido 1h).
// Los partidos van vie tarde-noche y sáb/dom de día (Pre 10:00 → Primera ~16:00,
// con margen). Fuera de esto la tabla no se mueve.
const CL_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Santiago", weekday: "short", hour: "2-digit", hour12: false,
});
function isMatchWindow(now: Date = new Date()): boolean {
  const parts = CL_FMT.formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  let h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  if (h === 24) h = 0; // en-US puede devolver "24" a medianoche
  if (wd === "Sat" || wd === "Sun") return h >= 8 && h < 22; // sáb/dom 08–22
  if (wd === "Fri") return h >= 16; // vie desde las 16
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
