// Scraper del minuto a minuto para correr en GitHub Actions (IPs limpias que
// arusa no tiene baneadas, a diferencia de la de Render). Escribe el timeline a
// la DB de prod vía la caché (scrapeArusaEvents persiste al obtener); de ahí lo
// sirve /match/events sin depender de que Render pueda scrapear.
//
// Un solo disparo por corrida (el cron lo repite): scrapea los partidos de la
// ventana en vivo (frescos) + rellena un tope del atraso de partidos terminados
// (inmutables), pausado, y se detiene si arusa 429ea (para no extender el ban de
// ese runner; la próxima corrida usa otro runner/IP y sigue).
//
// Requiere DATABASE_URL en el entorno (secret del repo). Uso en CI:
//   DATABASE_URL=... npx tsx api/scripts/ciScrape.ts
import { fetchAllMatchesMeta, scrapeArusaEvents, isArusaBlocked, type MatchMeta } from "../src/lib/leverade";
import { readCache } from "../src/lib/arusaCache";

const PACE_MS = 1200;         // pausa entre partidos → no ráfaga
const MAX_BACKLOG_PER_RUN = 30; // tope de atraso por corrida (< umbral de ban de arusa)
const LIVE_BEFORE_MS = 4 * 60 * 60_000; // ventana en vivo: desde 4h antes
const LIVE_AFTER_MS = 60 * 60_000;      // hasta 1h después del inicio

function kickoffMs(m: MatchMeta): number | null {
  if (!m.datetime) return null;
  return Date.parse(m.datetime.replace(" ", "T") + "Z");
}

async function main() {
  const meta = await fetchAllMatchesMeta();
  const now = Date.now();

  // 1) Ventana en vivo: partidos NO terminados alrededor de ahora → scrape fresco.
  const liveWindow = meta.filter((m) => {
    if (m.finished || m.postponed || m.canceled) return false;
    const k = kickoffMs(m);
    return k != null && k >= now - LIVE_BEFORE_MS && k <= now + LIVE_AFTER_MS;
  });

  // 2) Atraso: partidos terminados sin timeline persistido, más nuevos primero.
  const backlog: MatchMeta[] = [];
  for (const m of meta.filter((x) => x.finished).sort((a, b) => b.round - a.round)) {
    const cached = await readCache<unknown[]>(`events:${m.matchId}`);
    if (!cached || cached.length === 0) backlog.push(m);
  }

  const targets = [...liveWindow, ...backlog.slice(0, MAX_BACKLOG_PER_RUN)];
  console.log(`meta=${meta.length} liveWindow=${liveWindow.length} backlog=${backlog.length} → scrape ${targets.length}`);

  let ok = 0, empty = 0, stopped = false;
  for (const m of targets) {
    if (isArusaBlocked()) { stopped = true; break; } // 429 → parar; otra corrida/IP sigue
    const ev = await scrapeArusaEvents(m.matchId, { force: true }); // persiste al obtener
    if (ev.length > 0) ok++; else empty++;
    await new Promise((r) => setTimeout(r, PACE_MS));
  }
  console.log(`hecho: ok=${ok} empty=${empty}${stopped ? " (detenido por 429)" : ""}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
