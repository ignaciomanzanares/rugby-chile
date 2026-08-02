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
