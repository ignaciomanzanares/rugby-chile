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

export async function scrapeArusaNews(): Promise<number> {
  let html: string;
  try {
    const res = await fetch(ARUSA_NEWS_URL, { headers: { "Accept-Language": "es" } });
    if (!res.ok) return 0;
    html = await res.text();
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

    const imgM = [...seg.matchAll(/(?:src|data-src)="(https:\/\/cdn\.leverade\.com\/files\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi)].pop();
    const imageUrl = imgM ? imgM[1] : null;

    const sourceUrl = `https://arusa.cl/en/posts/news/${slug}`;
    const publishedAt = new Date(Date.now() - order * 86_400_000); // preserve listing order
    order++;

    const [existing] = await db.select({ id: newsArticles.id }).from(newsArticles).where(eq(newsArticles.slug, slug));
    if (existing) continue;

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
