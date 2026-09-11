// ISR: se sirve el shell cacheado al instante y se revalida en segundo plano
// cada 2 min, sin esperar la API en el camino crítico. Una nota recién
// publicada aparece a lo sumo 2 min después — de sobra para noticias.
export const revalidate = 120;
import { articles as staticArticles } from "@/data/news";
import { NewsLive } from "@/components/news-live";
import type { ApiArticle } from "@/components/news-card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getArticles(): Promise<ApiArticle[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/news`, { next: { revalidate: 120 }, signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const api: ApiArticle[] = await res.json();
      if (api.length > 0) return api;
    }
  } catch {
    // fall through to static
  }
  // Static fallback
  return staticArticles.map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    category: a.category,
    author: a.author,
    publishedAt: a.date,
    featured: a.featured,
    sourceName: null,
    sourceUrl: null,
    imageUrl: null,
  }));
}

export default async function NewsPage() {
  const all = await getArticles();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 space-y-10">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-wide">Noticias</h1>
            <p className="text-muted-foreground text-sm mt-1">Top 10 ARUSA · Temporada 2026</p>
          </div>
          <span className="text-xs text-muted-foreground/70 hidden sm:block">Actualizado automáticamente desde Rugbiers y Rugby Chile</span>
        </div>

        <NewsLive inicial={all} />

      </div>
    </div>
  );
}
