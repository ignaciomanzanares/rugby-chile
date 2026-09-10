/**
 * Reintento paciente del minuto a minuto que nos falta.
 *
 * De los 247 partidos jugados tenemos cronología de 100: el scraper priorizaba
 * Primera (81/85) y por eso Intermedia (17/84) y Pre (2/78) quedaron casi
 * vacías. Los 147 restantes SIGUEN existiendo en arusa; lo que no tenemos es
 * acceso, porque desde el 7-sep-2026 las páginas de partido responden con un
 * muro anti-bot ("Checking your browser", 429).
 *
 * Este servicio no fuerza nada: pide UN partido por ciclo lento, respeta el
 * breaker (que ante un 429 se calla con backoff exponencial hasta 3h) y va
 * rotando por la lista para no golpear siempre el mismo. Mientras el muro esté
 * puesto no consigue nada y casi no genera tráfico. El día que lo saquen —o que
 * ARUSA nos habilite— empieza a rellenar solo, sin que nadie corra un script.
 *
 * NO corre en día de partido: ahí el poco cupo que haya va al minuto a minuto en
 * vivo, no al histórico.
 */
import { fetchAllMatchesMeta, scrapeArusaEvents, isArusaBlocked, type MatchMeta } from "../lib/leverade";
import { readCache } from "../lib/arusaCache";

// Por dónde va la rotación. En memoria: al reiniciar vuelve a empezar, que no
// importa — lo ya capturado se saltea solo porque está en caché.
let cursor = 0;

/** Prioridad: Primera primero (es la que mira todo el mundo), y lo más reciente. */
const PRIORIDAD: Record<string, number> = { PRIMERA: 0, INTERMEDIA: 1, PRE_INTERMEDIA: 2 };

async function candidatos(meta: MatchMeta[]): Promise<MatchMeta[]> {
  const jugados = meta.filter(
    (m) => m.finished && !m.postponed && !m.canceled
      // 0-0 = no se jugó, no hay cronología que buscar.
      && !(m.homeScore === 0 && m.awayScore === 0),
  );
  const faltan: MatchMeta[] = [];
  for (const m of jugados) {
    const tiene = await readCache<unknown[]>(`events:${m.matchId}`);
    if (!tiene) faltan.push(m);
  }
  return faltan.sort(
    (a, b) => (PRIORIDAD[a.division] ?? 9) - (PRIORIDAD[b.division] ?? 9) || b.round - a.round,
  );
}

export async function retryMissingTimelines(max = 1): Promise<{ intentados: number; capturados: number; faltan: number }> {
  if (isArusaBlocked()) return { intentados: 0, capturados: 0, faltan: -1 };

  let meta: MatchMeta[];
  try {
    meta = await fetchAllMatchesMeta();
  } catch {
    return { intentados: 0, capturados: 0, faltan: -1 };
  }
  const lista = await candidatos(meta);
  if (lista.length === 0) return { intentados: 0, capturados: 0, faltan: 0 };

  let intentados = 0, capturados = 0;
  for (let i = 0; i < Math.min(max, lista.length); i++) {
    const m = lista[cursor++ % lista.length];
    intentados += 1;
    const ev = await scrapeArusaEvents(m.matchId).catch(() => []);
    if (ev.length > 0) {
      capturados += 1;
      console.info(`[timelines] recuperada la cronología de ${m.division} F${m.round} ${m.homeTeam}-${m.awayTeam} (${ev.length} eventos)`);
    }
    // Un 429 ya tripeó el breaker: no tiene sentido seguir en este ciclo.
    if (isArusaBlocked()) break;
  }
  return { intentados, capturados, faltan: lista.length - capturados };
}
