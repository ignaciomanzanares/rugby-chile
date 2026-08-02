/**
 * Minimal robots.txt gate for our scrapers.
 *
 * Before hitting a third-party host we consult its robots.txt and honour the
 * `Disallow` rules for the most specific of our own User-Agent or the `*` group.
 * robots.txt is fetched once per host and cached for a day (it changes rarely).
 *
 * Fail-open: if robots.txt can't be read (network error, 429, timeout) we assume
 * the path is allowed and log it — a transient outage shouldn't silently halt the
 * whole site's data. Disallowed paths are skipped and logged.
 */
import { USER_AGENT } from "../config";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Our UA token as robots matches it (product token before the first "/" or space).
const UA_TOKEN = USER_AGENT.split("/")[0].toLowerCase(); // "rugbychiletop10bot"

interface RobotsRules {
  disallow: string[];
  fetchedAt: number;
}

const cache = new Map<string, RobotsRules>();

// Parse the Disallow prefixes that apply to us: prefer a group whose User-agent
// matches our token, else fall back to the `*` group.
function parseRobots(txt: string): string[] {
  const lines = txt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  const groups: Array<{ agents: string[]; disallow: string[] }> = [];
  let current: { agents: string[]; disallow: string[] } | null = null;

  for (const line of lines) {
    const m = /^(user-agent|disallow)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      // A User-agent line right after a Disallow starts a new group.
      if (!current || current.disallow.length > 0) {
        current = { agents: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (field === "disallow" && current) {
      if (value) current.disallow.push(value);
    }
  }

  const forUs = groups.find((g) => g.agents.includes(UA_TOKEN));
  const forStar = groups.find((g) => g.agents.includes("*"));
  return (forUs ?? forStar)?.disallow ?? [];
}

async function getRules(origin: string): Promise<RobotsRules> {
  const cached = cache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
  let disallow: string[] = [];
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) disallow = parseRobots(await res.text());
    // A 4xx/5xx (incl. 404 "no robots") means no restrictions we can read.
  } catch {
    console.warn(`[robots] no se pudo leer ${origin}/robots.txt — asumiendo permitido`);
  }
  const rules = { disallow, fetchedAt: Date.now() };
  cache.set(origin, rules);
  return rules;
}

/** True if robots.txt allows us to fetch this URL (fail-open on any error). */
export async function robotsAllows(url: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return true;
  }
  const { disallow } = await getRules(u.origin);
  const path = u.pathname + u.search;
  const blocked = disallow.some((rule) => path.startsWith(rule));
  if (blocked) console.warn(`[robots] ${u.origin} prohíbe ${path} — se omite`);
  return !blocked;
}
