/**
 * Unofficial Instagram scraper.
 *
 * Auth is handled by instagramAuth.ts: a self-healing session that logs in with
 * IG_USERNAME / IG_PASSWORD (a dedicated throwaway account) and re-logs-in
 * automatically when Instagram kills the session — no hand-pasted sessionid that
 * goes stale. This module only turns the feed into lineup data.
 */
import { igCall } from "./instagramAuth";

type IgPost = {
  id: string;
  shortcode: string;
  caption: string;
  timestamp: number;
  permalink: string;
  images: string[];   // carousel image URLs (or single image), best resolution
};

// Best image URL(s) for a feed item — every carousel page, or the single image.
function itemImages(item: any): string[] {
  const best = (m: any): string | null => m?.image_versions2?.candidates?.[0]?.url ?? null;
  const out = (item.carousel_media ? item.carousel_media.map(best) : [best(item)]).filter(Boolean);
  return out as string[];
}

/** Fetches the numeric user ID for an Instagram username. */
export async function getIgUserId(username: string): Promise<string | null> {
  const id = await igCall((c) => c.user.getIdByUsername(username));
  return id != null ? String(id) : null;
}

/** Returns up to `count` recent posts for a user, given their numeric ID. */
export async function getRecentPosts(userId: string, count = 12): Promise<IgPost[]> {
  const items = await igCall(async (c) => {
    const page = await c.feed.user(userId).items(); // first page (~12-18 items)
    return page.slice(0, count);
  });
  if (!items) return [];
  return items.map((item: any) => ({
    id: String(item.pk ?? item.id ?? ""),
    shortcode: item.code ?? "",
    caption: item.caption?.text ?? "",
    timestamp: item.taken_at ?? 0,
    permalink: `https://www.instagram.com/p/${item.code}/`,
    images: itemImages(item),
  }));
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
