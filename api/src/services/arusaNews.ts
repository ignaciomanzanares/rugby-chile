/**
 * Real news from arusa.cl.
 *
 * Scrapes the public news listing (https://arusa.cl/en/posts/news) — match
 * reviews, round summaries, etc. — and stores them as articles linking back to
 * arusa. No invented content. Idempotent by slug.
 */
import { db } from "../db";
import { newsArticles } from "../db/schema";
import { eq } from "drizzle-orm";
import { USER_AGENT } from "../config";
import { robotsAllows } from "../lib/robots";
import { readCache, writeCache } from "../lib/arusaCache";

const ARUSA_NEWS_URL = "https://arusa.cl/en/posts/news";

function clean(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function imageOk(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "GET", headers: { "User-Agent": USER_AGENT } });
    return r.ok && (r.headers.get("content-type") ?? "").startsWith("image");
  } catch {
    return false;
  }
}

// Pick an article image that actually loads. arusa serves several variants and
// some are access-protected (403); prefer the reliable 1920x800, then the
// listing variant, then the article's og:image.
async function pickImage(seg: string, slug: string): Promise<string | null> {
  const cands = [
    ...new Set(
      [...seg.matchAll(/https:\/\/cdn\.leverade\.com\/files\/[A-Za-z0-9]+\.[0-9x]+\.A\.C\.(?:jpg|jpeg|png|webp)/gi)].map((m) => m[0]),
    ),
  ];
  for (const url of cands) {
    const variants = [...new Set([url.replace(/\.[0-9]+x[0-9]+\./, ".1920x800."), url])];
    for (const v of variants) {
      if (await imageOk(v)) return v;
    }
  }
  // Fallback: scrape the article page for any usable image — og:image and
  // twitter:image (the hero, usually public), then the first content <img>.
  try {
    const res = await fetch(`https://arusa.cl/en/posts/news/${slug}`, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) {
      const h = await res.text();
      const metas = [
        h.match(/og:image"[^>]*content="([^"]+)"/i)?.[1],
        h.match(/content="([^"]+)"[^>]*og:image/i)?.[1],
        h.match(/twitter:image"[^>]*content="([^"]+)"/i)?.[1],
        ...[...h.matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) => m[1]),
      ];
      for (const url of metas) {
        if (url && /^https?:\/\//.test(url) && (await imageOk(url))) return url;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

// Throttle: syncArusa llama esto cada 45s, pero las noticias son contenido
// diario. Sin límite le pegábamos ~2000 veces/día a arusa y nos devolvía 429
// (rate limit) → el scrape fallaba y las noticias quedaban congeladas. Con esto
// hacemos a lo sumo un intento cada 3h (el marcador se setea antes del fetch, así
// un 429 también respeta el backoff). `force` lo saltea (refresh manual).
let lastArusaNewsRun = 0;
const ARUSA_NEWS_MIN_INTERVAL_MS = 3 * 60 * 60 * 1000;
const BLOCK_KEY = "news:arusa-blocked-until"; // timestamp ms hasta el que hay ban
const MAX_BLOCK_MS = 12 * 60 * 60 * 1000; // aunque arusa pida días, reintenta cada ≤12h

export async function scrapeArusaNews(force = false): Promise<number> {
  // Respeta el ban (429 Retry-After) de forma durable: no reintenta durante el
  // ban (reintentar lo extendería) y sobrevive a reinicios de Render.
  if (!force) {
    const blockedUntil = (await readCache<number>(BLOCK_KEY)) ?? 0;
    if (Date.now() < blockedUntil) return 0;
    if (Date.now() - lastArusaNewsRun < ARUSA_NEWS_MIN_INTERVAL_MS) return 0;
  }
  lastArusaNewsRun = Date.now();

  let html: string;
  try {
    if (!(await robotsAllows(ARUSA_NEWS_URL))) return 0;
    const res = await fetch(ARUSA_NEWS_URL, { headers: { "Accept-Language": "es", "User-Agent": USER_AGENT } });
    if (res.status === 429) {
      // Banéo: guarda hasta cuándo esperar (respeta Retry-After, capado a 12h).
      const ra = parseInt(res.headers.get("retry-after") ?? "", 10);
      const waitMs = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, MAX_BLOCK_MS) : 6 * 60 * 60 * 1000;
      await writeCache(BLOCK_KEY, Date.now() + waitMs);
      return 0;
    }
    if (!res.ok) return 0;
    html = await res.text();
    await writeCache(BLOCK_KEY, 0); // éxito → limpia el ban previo
  } catch {
    return 0;
  }

  // Unique article slugs in listing order (newest first).
  const slugs: string[] = [];
  for (const m of html.matchAll(/href="https:\/\/arusa\.cl\/en\/posts\/news\/([a-z0-9-]+)"/g)) {
    if (!slugs.includes(m[1])) slugs.push(m[1]);
  }

  let added = 0;
  let order = 0;
  for (const slug of slugs) {
    const idx = html.indexOf(`/posts/news/${slug}"`);
    if (idx < 0) continue;
    const seg = html.slice(Math.max(0, idx - 2600), idx + 100);

    const titleM = [...seg.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)].pop();
    const title = titleM ? clean(titleM[1]) : "";
    if (!title) continue;

    const pM = [...seg.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].pop();
    const excerpt = (pM ? clean(pM[1]) : title).replace(/\s*See more\s*$/i, "").slice(0, 300);

    const imageUrl = await pickImage(seg, slug);

    const sourceUrl = `https://arusa.cl/en/posts/news/${slug}`;
    const publishedAt = new Date(Date.now() - order * 86_400_000); // preserve listing order
    order++;

    const [existing] = await db
      .select({ id: newsArticles.id, imageUrl: newsArticles.imageUrl })
      .from(newsArticles)
      .where(eq(newsArticles.slug, slug));
    if (existing) {
      // Self-heal: replace a missing/broken image with the validated one.
      if (imageUrl && imageUrl !== existing.imageUrl) {
        await db.update(newsArticles).set({ imageUrl }).where(eq(newsArticles.slug, slug));
      }
      continue;
    }

    await db.insert(newsArticles).values({
      slug,
      title,
      excerpt,
      body: excerpt,
      category: /resumen|fecha/i.test(title) ? "Resultados" : "Análisis",
      author: "ARUSA",
      sourceName: "arusa.cl",
      sourceUrl,
      imageUrl,
      publishedAt,
    });
    added++;
  }
  return added;
}
