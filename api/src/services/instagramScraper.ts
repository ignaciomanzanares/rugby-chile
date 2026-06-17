/**
 * Unofficial Instagram scraper using session cookie auth.
 *
 * Requires INSTAGRAM_SESSION_ID env var — grab it from your browser:
 *   1. Log into instagram.com
 *   2. Open DevTools → Application → Cookies → instagram.com
 *   3. Copy the value of "sessionid"
 *   4. Set INSTAGRAM_SESSION_ID=<value> in your .env
 *
 * The session lasts a few months before needing renewal.
 */
import dns from "node:dns";

// i.instagram.com advertises IPv6 that's unreachable from many networks; undici
// (Node's fetch) would hang on it where curl falls back to IPv4. Prefer IPv4.
dns.setDefaultResultOrder("ipv4first");

const SESSION_ID = process.env.INSTAGRAM_SESSION_ID ?? "";
const IG_APP_ID = "936619743392459";

// Instagram killed the www.instagram.com/api/v1/users/web_profile_info JSON
// endpoint for scrapers (it now 302s / serves an HTML wall). The mobile app
// API on i.instagram.com still returns JSON when called with the Instagram
// Android app User-Agent and a valid sessionid — but its edge rejects requests
// carrying undici's default Sec-Fetch-* headers ("SecFetch Policy violation"),
// so we override them to same-origin values it accepts.
function igHeaders(): Record<string, string> {
  return {
    "User-Agent":
      "Instagram 219.0.0.12.117 Android (30/11; 480dpi; 1080x2148; samsung; SM-G991B; o1s; exynos2100; en_US; 346138365)",
    "Cookie": `sessionid=${SESSION_ID};`,
    "X-IG-App-ID": IG_APP_ID,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-419,es;q=0.9",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
  };
}

type IgPost = {
  id: string;
  shortcode: string;
  caption: string;
  timestamp: number;
  permalink: string;
};

/** Fetches the numeric user ID for an Instagram username via the mobile API. */
export async function getIgUserId(username: string): Promise<string | null> {
  try {
    const url = `https://i.instagram.com/api/v1/users/${encodeURIComponent(username)}/usernameinfo/`;
    const res = await fetch(url, { headers: igHeaders() });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const pk = data?.user?.pk ?? data?.user?.pk_id;
    return pk ? String(pk) : null;
  } catch (e) {
    console.error(`[instagram] Failed to get userId for @${username}:`, e);
    return null;
  }
}

/** Returns up to `count` recent posts for a user, given their numeric ID. */
export async function getRecentPosts(userId: string, count = 12): Promise<IgPost[]> {
  try {
    const url = `https://i.instagram.com/api/v1/feed/user/${userId}/?count=${count}`;
    const res = await fetch(url, { headers: igHeaders() });
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data?.items ?? []).map((item: any) => ({
      id: String(item.pk ?? item.id ?? ""),
      shortcode: item.code ?? "",
      caption: item.caption?.text ?? "",
      timestamp: item.taken_at ?? 0,
      permalink: `https://www.instagram.com/p/${item.code}/`,
    }));
  } catch (e) {
    console.error(`[instagram] Failed to get posts for userId ${userId}:`, e);
    return [];
  }
}

/**
 * Tries to parse a numbered player list from an Instagram caption.
 *
 * Handles formats:
 *   "1. Nombre Apellido"   "1- Nombre"   "#1 Nombre"
 *
 * Returns an array indexed 0–21 (positions 1–22), or null if fewer than
 * 10 names are found (likely not a lineup post).
 */
export function parseLineupFromCaption(caption: string): string[] | null {
  if (!caption) return null;

  const players: string[] = [];
  const lines = caption.split("\n").map((l) => l.trim());

  for (const line of lines) {
    // Match: optional # + number (1–22) + separator + name (2+ words or hyphenated)
    const m = line.match(
      /^#?\s*(\d{1,2})\s*[.):\-–]\s+([A-Za-zÁáÉéÍíÓóÚúÜüÑñ][A-Za-zÁáÉéÍíÓóÚúÜüÑñ\s.\-']{2,50})$/,
    );
    if (!m) continue;
    const num = parseInt(m[1]);
    if (num < 1 || num > 22) continue;
    players[num - 1] = m[2].trim();
  }

  const found = players.filter(Boolean).length;
  return found >= 10 ? players : null;
}

/**
 * Decides if a post is likely a lineup announcement.
 *
 * Checks caption for lineup keywords in Spanish.
 */
export function isLineupPost(caption: string): boolean {
  if (!caption) return false;
  const lower = caption.toLowerCase();
  const keywords = [
    "formación", "formacion", "formation",
    "equipo del", "xv de", "equipo para",
    "nuestro equipo", "formamos con",
    "titulares", "los 15",
    "lineup", "starting",
  ];
  return keywords.some((k) => lower.includes(k));
}

/**
 * For a given club username, finds the most recent post that looks like a lineup
 * published after `afterTimestamp` (Unix seconds). Returns null if none found.
 */
export async function findLineupPost(
  username: string,
  afterTimestamp: number,
): Promise<{ post: IgPost; parsed: string[] | null } | null> {
  if (!SESSION_ID) {
    console.warn("[instagram] INSTAGRAM_SESSION_ID not set — skipping scrape");
    return null;
  }

  const userId = await getIgUserId(username);
  if (!userId) return null;

  // Small delay to avoid rate limiting
  await new Promise((r) => setTimeout(r, 1200));

  const posts = await getRecentPosts(userId, 15);

  for (const post of posts) {
    if (post.timestamp < afterTimestamp) break; // posts are newest-first
    if (!isLineupPost(post.caption)) continue;

    const parsed = parseLineupFromCaption(post.caption);
    return { post, parsed };
  }

  return null;
}
