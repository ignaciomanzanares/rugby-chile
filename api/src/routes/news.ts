import type { FastifyInstance } from "fastify";
import { db } from "../db";
import { newsArticles } from "../db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { scrapeNews, isTop10Article } from "../services/newsScraper";
import { scrapeArusaNews } from "../services/arusaNews";

export async function newsRoutes(api: FastifyInstance) {
  // GET /news — list published articles (newest first).
  // Re-applies the Top10 filter to drop any non-Primera rows that may
  // have been stored by an older, looser scraper.
  api.get("/news", async (_req, reply) => {
    const rows = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.published, true))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(100);
    const filtered = rows
      .filter((r) => isTop10Article(r.title, r.excerpt ?? ""))
      .slice(0, 50);
    return reply.send(filtered);
  });

  // GET /news/featured — only featured articles
  api.get("/news/featured", async (_req, reply) => {
    const rows = await db
      .select()
      .from(newsArticles)
      .where(and(eq(newsArticles.published, true), eq(newsArticles.featured, true)))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(20);
    const filtered = rows.filter((r) => isTop10Article(r.title, r.excerpt ?? "")).slice(0, 5);
    return reply.send(filtered);
  });

  // POST /news/cleanup — delete rows that don't pass the Top10 filter
  api.post("/news/cleanup", async (_req, reply) => {
    const rows = await db.select().from(newsArticles);
    const staleIds = rows
      .filter((r) => !isTop10Article(r.title, r.excerpt ?? ""))
      .map((r) => r.id);
    if (staleIds.length > 0) {
      await db.delete(newsArticles).where(inArray(newsArticles.id, staleIds));
    }
    return reply.send({ removed: staleIds.length });
  });

  // GET /news/:slug — single article
  api.get("/news/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const [article] = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.slug, slug));
    if (!article) return reply.status(404).send({ error: "Not found" });
    return reply.send(article);
  });

  // POST /news/scrape — manually trigger scraper (admin)
  api.post("/news/scrape", async (_req, reply) => {
    const added = await scrapeNews();
    return reply.send({ added });
  });

  // POST /news/scrape-arusa — pull real news from arusa.cl (admin)
  api.post("/news/scrape-arusa", async (_req, reply) => {
    const added = await scrapeArusaNews();
    return reply.send({ added });
  });

  // POST /news — create article manually (admin)
  api.post("/news", async (req, reply) => {
    const body = req.body as {
      title: string; excerpt: string; body: string;
      category?: string; author?: string; featured?: boolean; imageUrl?: string;
    };
    if (!body.title || !body.excerpt || !body.body) {
      return reply.status(400).send({ error: "title, excerpt and body are required" });
    }
    const slug = body.title
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim().replace(/\s+/g, "-")
      .slice(0, 80) + "-" + Date.now().toString(36);

    const [created] = await db.insert(newsArticles).values({
      slug,
      title: body.title,
      excerpt: body.excerpt,
      body: body.body,
      category: body.category ?? "Noticias",
      author: body.author ?? "Redacción Top 10",
      featured: body.featured ?? false,
      imageUrl: body.imageUrl,
    }).returning();
    return reply.status(201).send(created);
  });

  // PATCH /news/:slug — update article (toggle published, featured, etc.)
  api.patch("/news/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const patch = req.body as Partial<{
      title: string; excerpt: string; body: string; category: string;
      author: string; featured: boolean; published: boolean; imageUrl: string;
    }>;
    const [updated] = await db
      .update(newsArticles)
      .set(patch)
      .where(eq(newsArticles.slug, slug))
      .returning();
    if (!updated) return reply.status(404).send({ error: "Not found" });
    return reply.send(updated);
  });

  // DELETE /news/:slug
  api.delete("/news/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    await db.delete(newsArticles).where(eq(newsArticles.slug, slug));
    return reply.status(204).send();
  });
}
