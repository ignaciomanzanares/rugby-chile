/**
 * Pushes the standings/player-stats we already scraped into SportOS's cache.
 *
 * SportOS (a separate product, same rugby) cannot scrape arusa itself: arusa
 * drops connections from Vercel outright, and it throttles per IP with 429s
 * whose Retry-After reaches days. A second scraper would spend the same
 * per-IP budget and get both products banned.
 *
 * So this service is the single writer. It adds zero arusa requests — it
 * reuses what syncArusa just fetched (served from this process's own cache)
 * and forwards it. If SportOS is unreachable, nothing here fails: this is a
 * side effect of our sync, never a reason to break it.
 *
 * Auth is a dedicated shared secret against a SECURITY DEFINER function that
 * can only write arusa_cache — deliberately not SportOS's service_role key,
 * which would bypass every policy in that database and live here in plaintext.
 *
 * Disabled unless both env vars are set, so local dev and forks stay quiet.
 */
import { fetchStandings, fetchPlayerStats, type DivisionKey } from "../lib/leverade";

const SPORTOS_URL = process.env.SPORTOS_SUPABASE_URL;
const SPORTOS_ANON = process.env.SPORTOS_SUPABASE_ANON_KEY;
const SPORTOS_SECRET = process.env.SPORTOS_ARUSA_SECRET;

const DIVISIONS: DivisionKey[] = ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"];
const TIMEOUT_MS = 8000;

export function sportosPushEnabled(): boolean {
  return Boolean(SPORTOS_URL && SPORTOS_ANON && SPORTOS_SECRET);
}

async function push(key: string, data: unknown): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SPORTOS_URL}/rest/v1/rpc/guardar_arusa_cache`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: SPORTOS_ANON!,
        Authorization: `Bearer ${SPORTOS_ANON}`,
      },
      body: JSON.stringify({ p_clave: key, p_datos: data, p_secreto: SPORTOS_SECRET }),
    });
    if (!res.ok) {
      // Surface the reason: a silent failure here means SportOS quietly serves
      // week-old standings and nobody knows why.
      console.error(`[pushSportos] ${key}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`[pushSportos] ${key}:`, (err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Forwards the current snapshot to SportOS. Call after syncArusa so the data
 * is already warm — this never triggers a fresh arusa request.
 */
export async function pushToSportos(): Promise<void> {
  if (!sportosPushEnabled()) return;

  await Promise.allSettled(
    DIVISIONS.flatMap((division) => [
      fetchStandings(division).then((rows) =>
        rows && rows.length ? push(`standings:${division}`, rows) : undefined,
      ),
      fetchPlayerStats(division).then((rows) =>
        rows && rows.length ? push(`players:${division}`, rows) : undefined,
      ),
    ]),
  );
}
