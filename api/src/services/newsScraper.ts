import Parser from "rss-parser";
import { db } from "../db";
import { newsArticles } from "../db/schema";
import { eq } from "drizzle-orm";

const parser = new Parser({ timeout: 10_000 });

// RSS feeds to scrape (rugby Chile coverage)
const RSS_FEEDS = [
  { url: "https://www.rugbiers.cl/feed/", name: "Rugbiers" },
  { url: "https://www.rugbychile.cl/feed/", name: "Rugby Chile" },
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

export async function scrapeNews(): Promise<number> {
  let added = 0;

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

        // Skip if already stored
        const existing = await db.select({ id: newsArticles.id }).from(newsArticles).where(eq(newsArticles.slug, slug));
        if (existing.length > 0) continue;

        // Also check by sourceUrl
        const byUrl = await db.select({ id: newsArticles.id }).from(newsArticles).where(eq(newsArticles.sourceUrl, link));
        if (byUrl.length > 0) continue;

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

  if (added > 0) console.log(`[newsScraper] Added ${added} new Top 10 articles`);
  return added;
}
