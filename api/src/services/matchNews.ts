/**
 * Auto-generated match-result news.
 *
 * Turns the latest finished Primera matches (from the arusa results feed) into
 * "Resultados" news articles so the news section reflects what just happened on
 * the pitch. Idempotent by slug; updates the score if a result was corrected.
 */
import { db } from "../db";
import { newsArticles } from "../db/schema";
import { eq } from "drizzle-orm";
import { fetchAllResults } from "../routes/leveradeResults";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function summary(home: string, away: string, hs: number, as: number): { excerpt: string; body: string } {
  const margin = Math.abs(hs - as);
  if (hs === as) {
    return {
      excerpt: `${home} y ${away} igualaron ${hs}-${as} en un partido parejo de la Primera División.`,
      body: `${home} y ${away} empataron ${hs}-${as} por el Top 10 de la Primera División ARUSA. Ambos equipos se repartieron los puntos en un cierre apretado.`,
    };
  }
  const [winner, wScore, loser, lScore] = hs > as ? [home, hs, away, as] : [away, as, home, hs];
  const how = margin <= 7 ? "por un ajustado marcador" : margin >= 25 ? "con autoridad" : "con solidez";
  return {
    excerpt: `${winner} venció a ${loser} ${wScore}-${lScore} ${how} en la Primera División.`,
    body: `${winner} se impuso a ${loser} por ${wScore}-${lScore} ${how} en el Top 10 de la Primera División ARUSA. El resultado deja a ${winner} sumando en la tabla.`,
  };
}

export async function generateMatchNews(): Promise<number> {
  let results: Record<string, { homeTeam: string; awayTeam: string; division: string; finished: boolean; homeScore?: number; awayScore?: number; datetime: string | null }>;
  try {
    results = await fetchAllResults();
  } catch {
    return 0;
  }

  // Latest finished Primera matches first.
  const finished = Object.values(results)
    .filter((r) => r.division === "PRIMERA" && r.finished && r.homeScore != null && r.awayScore != null && r.datetime)
    .sort((a, b) => new Date(b.datetime!).getTime() - new Date(a.datetime!).getTime())
    .slice(0, 10);

  let changed = 0;
  for (const r of finished) {
    const hs = r.homeScore as number;
    const as = r.awayScore as number;
    const date = new Date(r.datetime as string);
    const slug = `res-${slugify(r.homeTeam)}-${slugify(r.awayTeam)}-${date.toISOString().slice(0, 10)}`;
    const title = `${r.homeTeam} ${hs}-${as} ${r.awayTeam}`;
    const { excerpt, body } = summary(r.homeTeam, r.awayTeam, hs, as);

    const [existing] = await db
      .select({ id: newsArticles.id, title: newsArticles.title })
      .from(newsArticles)
      .where(eq(newsArticles.slug, slug));

    if (!existing) {
      await db.insert(newsArticles).values({
        slug, title, excerpt, body,
        category: "Resultados",
        author: "Resultados Top 10",
        sourceName: "arusa.cl",
        publishedAt: date,
      });
      changed++;
    } else if (existing.title !== title) {
      // score corrected — keep the article current
      await db.update(newsArticles).set({ title, excerpt, body }).where(eq(newsArticles.id, existing.id));
      changed++;
    }
  }
  return changed;
}
