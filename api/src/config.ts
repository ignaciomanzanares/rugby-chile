/**
 * Centralized config for background jobs and outbound scrapers.
 *
 * Keeping the cron expressions and the scraper identity in one place (instead of
 * scattered string literals) makes the app's scheduled behaviour auditable at a
 * glance and easy to tune per environment.
 */

// ── Scraper identity ────────────────────────────────────────────────────────
// A single, honest User-Agent for every outbound request we make to third-party
// sites (arusa.cl, api.leverade.com, rugbiers.cl). It names the bot and points
// to a contact (the public repo, where anyone can open an issue asking us to
// stop). Swap CONTACT_URL for a dedicated /about or mailto: if you prefer.
export const CONTACT_URL = "https://github.com/ignaciomanzanares/rugby-chile";
export const USER_AGENT = `RugbyChileTop10Bot/1.0 (+${CONTACT_URL})`;

// User-Agent SOLO para arusa.cl. Por defecto es el MISMO honesto de arriba: hoy
// no cambia absolutamente nada, sólo existe el punto donde cambiarlo.
//
// Contexto (medido el 2026-09-14, misma URL / misma IP / mismo minuto): el muro
// anti-bot de arusa responde 429 "Checking your browser" a cualquier UA que se
// identifique como bot, y 200 con el play-by-play completo a un UA de navegador.
// O sea, lo que nos bloquea es declarar lo que somos, no la IP ni el volumen.
// Ese muro es genérico de Clupik (la plataforma), no una decisión de ARUSA sobre
// este portal.
//
// La salida NO es disfrazarse: es que ARUSA le pida a Clupik poner
// RugbyChileTop10Bot en lista blanca. Mientras tanto el minuto a minuto vive
// derivado del salto de marcador, sin nombres y con minuto estimado.
//
// Si algún día hay autorización explícita, se setea ARUSA_USER_AGENT en el
// entorno y listo — sin tocar código ni desplegar.
export const ARUSA_USER_AGENT = process.env.ARUSA_USER_AGENT ?? USER_AGENT;

// ── Cron schedules ──────────────────────────────────────────────────────────
// node-cron expressions for the background jobs wired up in index.ts. Times are
// evaluated in the server's timezone. On Render (UTC) the poller window below
// (Thu–Sun) covers Chile's Thu–Sun match days.
export const SCHEDULES = {
  /** Keep the predictions game synced with the live Leverade feed. */
  syncPredictionFixtures: "*/15 * * * *",
  /** Pull rugby news from the RSS sources. */
  scrapeNews: "0 */6 * * *",
  /** Auto-score poller — every minute Thu–Sun (match creation + live days). */
  pollLeverade: "* * * * 4,5,6,0",
  /** Sweep LIVE/HT matches left stale after the weekend to FINISHED. */
  finalizeStaleMatches: "*/15 * * * *",
} as const;

// setInterval-based loops (ms) that aren't cron jobs.
export const INTERVALS = {
  /** Warm-sync arusa standings/results into the DB cache while reachable. */
  arusaSyncMs: 45_000,
} as const;
