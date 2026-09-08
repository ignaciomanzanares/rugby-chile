/**
 * Noticias oficiales de ARUSA, desde Leverade.
 *
 * Antes esto se raspaba de arusa.cl/en/posts/news. Leverade las expone en su API
 * pública con el cuerpo completo ya en HTML, ordenables por fecha y sin scraping:
 *
 *   /articles?query=manager.id = "532872"&sort=-published_at
 *
 * El id del artículo en Leverade ES el id del post en arusa (`links.domain_url`
 * apunta a /posts/news/<id>), así que se usa como slug y queda idempotente con
 * lo que ya cargó el scraper viejo — no duplica.
 */
import { db } from "../db";
import { newsArticles } from "../db/schema";
import { eq } from "drizzle-orm";

const ARUSA_MANAGER_ID = "532872";
const LEVERADE_BASE = "https://api.leverade.com";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&hellip;/g, "…")
    .replace(/&[a-z]+;/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Primera imagen del cuerpo, si trae alguna. Leverade no expone portada aparte. */
function firstImage(html: string): string | null {
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return m ? m[1] : null;
}

export async function syncLeveradeNews(limit = 30): Promise<number> {
  const query = encodeURIComponent(`manager.id = "${ARUSA_MANAGER_ID}"`);
  let json: any;
  try {
    const res = await fetch(
      `${LEVERADE_BASE}/articles?query=${query}&sort=-published_at&page[size]=${limit}`,
      { headers: { Accept: "application/vnd.api+json" }, signal: AbortSignal.timeout(20_000) },
    );
    if (!res.ok) return 0;
    json = await res.json();
  } catch {
    return 0;
  }

  let saved = 0;
  for (const a of (json?.data ?? []) as any[]) {
    const at = a.attributes ?? {};
    const body = String(at.body ?? "");
    const title = String(at.title ?? "").trim();
    if (!title || !body) continue;

    const slug = String(a.id);
    const excerpt = stripHtml(body).slice(0, 280);
    const sourceUrl = a.links?.domain_url ?? `https://arusa.cl/posts/news/${slug}`;
    const publishedAt = at.published_at ? new Date(String(at.published_at).replace(" ", "T") + "Z") : new Date();

    const values = {
      slug, title, excerpt, body,
      category: "Noticias",
      author: "ARUSA",
      sourceUrl,
      sourceName: "ARUSA",
      imageUrl: firstImage(body),
      featured: Boolean(at.featured),
      published: true,
      publishedAt,
    };

    // OJO — dedupe por TÍTULO, no por slug. El scraper viejo de arusa.cl genera
    // slugs de texto ("fecha-16-top-10-arusa") y acá el slug es el id numérico
    // del artículo, así que emparejar por slug creaba la misma nota dos veces.
    // Si ya existe una con el mismo título se ACTUALIZA esa: se le pone el cuerpo
    // completo de Leverade pero se le respetan su slug (las URLs ya publicadas no
    // se rompen) y su imagen (Leverade no expone portada).
    const [byTitle] = await db.select({ id: newsArticles.id, slug: newsArticles.slug, imageUrl: newsArticles.imageUrl })
      .from(newsArticles).where(eq(newsArticles.title, title));
    if (byTitle) {
      await db.update(newsArticles)
        .set({ ...values, slug: byTitle.slug, imageUrl: values.imageUrl ?? byTitle.imageUrl })
        .where(eq(newsArticles.id, byTitle.id));
      continue;
    }
    const [bySlug] = await db.select({ id: newsArticles.id, imageUrl: newsArticles.imageUrl })
      .from(newsArticles).where(eq(newsArticles.slug, slug));
    if (bySlug) {
      await db.update(newsArticles)
        .set({ ...values, imageUrl: values.imageUrl ?? bySlug.imageUrl })
        .where(eq(newsArticles.id, bySlug.id));
    } else {
      await db.insert(newsArticles).values(values);
      saved += 1;
    }
  }
  return saved;
}
