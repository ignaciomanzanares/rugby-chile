import Parser from "rss-parser";
import { db } from "../db";
import { newsArticles } from "../db/schema";
import { eq } from "drizzle-orm";

const parser = new Parser({ timeout: 10_000 });

// RSS feeds to scrape (rugby Chile coverage).
// rugbychile.cl disabled its RSS feed — every /feed/ variant 301s to the
// homepage, so rss-parser only ever got HTML and threw. arusa.cl (via
// scrapeArusaNews) covers that gap, so the dead feed was dropped.
const RSS_FEEDS = [
  { url: "https://www.rugbiers.cl/feed/", name: "Rugbiers" },
];

// Strong markers that an article is about the Top 10 / ARUSA Primera División.
// Removed generic terms ("fecha", "arusa") that match Segunda/Tercera/Cuarta too.
const TOP10_KEYWORDS = [
  "top 10", "top10", "top diez",
  "primera división", "primera nacional", "primera xv",
  "cobs", "old boys", "pwcc", "prince of wales", "old macks", "old mackayans",
  "stade francais", "stade français", "sporting rc", "dobs", "dunalastair",
  "universidad católica", "old johns", "old reds",
  "clásico británico", "clásico de las colonias",
];

// Strong markers that the article is about a DIFFERENT division (Segunda/Tercera/Cuarta).
// Per ARUSA 2026 Acuerdos de Participación, sección 3 (Equipos Participantes).
const OTHER_DIVISION_KEYWORDS = [
  "segunda división", "tercera división", "cuarta división",
  "segunda divisi&oacute;n", "tercera divisi&oacute;n", "cuarta divisi&oacute;n",
  "torneo de ascenso", "torneo del ascenso", "campeonato de ascenso",
  // Segunda División teams
  "old georgians", "lagartos rc", "old gabs", "old locks", "old anglonians",
  "all brads", "tabancura", "gauchos rc", "old newlanders", "cda rugby", "alumni rc",
  // Tercera División teams
  "trapiales rc", "costa del sol", "lions rc", "mano rc", "los troncos",
  "halcones rc", "irc rugby", "old navy",
  // Cuarta División teams
  "ust rugby", "rc francés", "rc frances", "urma", "san bartolome", "san bartolomé",
  "old green rc", "toros de quillota", "universidad de chile",
];

/** Decide if an article should be surfaced as Top 10 / Primera División content. */
export function isTop10Article(title: string, summary: string): boolean {
  const text = (title + " " + summary).toLowerCase();
  const hasPrimeraSignal = TOP10_KEYWORDS.some((kw) => text.includes(kw));
  if (!hasPrimeraSignal) return false;
  const hasOtherDivisionSignal = OTHER_DIVISION_KEYWORDS.some((kw) => text.includes(kw));
  return !hasOtherDivisionSignal;
}

function slugify(title: string, id: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")   // remove accents
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) +
    "-" +
    id.slice(-6)
  );
}

function detectCategory(title: string, summary: string): string {
  const text = (title + " " + summary).toLowerCase();
  if (text.includes("resultado") || /\d+-\d+/.test(text) || text.includes("triunfo") || text.includes("victoria") || text.includes("derrota") || text.includes("empate")) return "Resultados";
  if (text.includes("coach") || text.includes("entrenador") || text.includes("ficha") || text.includes("llega") || text.includes("incorpora")) return "Fichajes";
  if (text.includes("fecha") && (text.includes("análisis") || text.includes("previa") || text.includes("preview"))) return "Análisis";
  if (text.includes("entrevista") || text.includes("habló") || text.includes("declaró")) return "Entrevista";
  return "Noticias";
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// The Rugbiers RSS feed carries no enclosure/media image, but each article page
// has a proper og:image (the real match photo). Fetch it; fall back to the first
// <img> embedded in the RSS content.
async function articleImage(pageUrl: string, item: { [k: string]: unknown }): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Top10Bot/1.0)", "Accept-Language": "es" },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      const html = await res.text();
      const og =
        /<meta\s+property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(html) ??
        /<meta\s+content=["']([^"']+)["'][^>]*property=["']og:image["']/i.exec(html) ??
        /<meta\s+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i.exec(html);
      if (og?.[1] && /^https?:\/\//.test(og[1])) return og[1];
    }
  } catch { /* fall through */ }
  const content = String(item["content:encoded"] ?? item.content ?? "");
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(content);
  return m?.[1] && /^https?:\/\//.test(m[1]) ? m[1] : null;
}

export async function scrapeNews(): Promise<number> {
  let added = 0;
  let backfilled = 0;

  for (const feed of RSS_FEEDS) {
    try {
      const result = await parser.parseURL(feed.url);

      for (const item of result.items) {
        const title = item.title ?? "";
        const summary = stripHtml(item.contentSnippet ?? item.summary ?? item.content ?? "");
        const link = item.link ?? "";
        const guid = item.guid ?? link;

        if (!title || !link) continue;
        if (!isTop10Article(title, summary)) continue;

        // Use guid-based slug so re-runs don't create duplicates
        const slug = slugify(title, guid);

        // Already stored? Backfill its image if it's missing one, then skip.
        const existing = (await db.select({ id: newsArticles.id, imageUrl: newsArticles.imageUrl })
          .from(newsArticles).where(eq(newsArticles.slug, slug)))[0]
          ?? (await db.select({ id: newsArticles.id, imageUrl: newsArticles.imageUrl })
          .from(newsArticles).where(eq(newsArticles.sourceUrl, link)))[0];
        if (existing) {
          if (!existing.imageUrl) {
            const img = await articleImage(link, item);
            if (img) { await db.update(newsArticles).set({ imageUrl: img }).where(eq(newsArticles.id, existing.id)); backfilled++; }
          }
          continue;
        }

        const body = stripHtml(item.content ?? item["content:encoded"] ?? summary);
        const excerpt = summary.slice(0, 300) + (summary.length > 300 ? "…" : "");
        const category = detectCategory(title, summary);
        const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();

        await db.insert(newsArticles).values({
          slug,
          title,
          excerpt,
          body: body || excerpt,
          category,
          author: item.creator ?? item.dc?.creator ?? "Redacción",
          sourceUrl: link,
          sourceName: feed.name,
          imageUrl: await articleImage(link, item),
          featured: false,
          published: true,
          publishedAt,
        });

        added++;
      }
    } catch (err) {
      console.error(`[newsScraper] Failed to fetch ${feed.url}:`, err);
    }
  }

  if (added > 0 || backfilled > 0) console.log(`[newsScraper] Added ${added} new Top 10 articles, backfilled ${backfilled} images`);
  return added;
}
