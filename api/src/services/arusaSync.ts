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

export function startArusaSync(intervalMs = 45_000): void {
  const tick = () => { syncArusa().catch(() => {}); };
  tick(); // warm immediately on startup
  setInterval(tick, intervalMs);
}
