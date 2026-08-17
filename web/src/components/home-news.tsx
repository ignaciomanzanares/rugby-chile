"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Trophy, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NewsImage } from "@/components/news-image";
import { fetchNewsList, type LiveArticle } from "@/lib/news";

export type { LiveArticle };

const CATEGORY_COLORS: Record<string, string> = {
  Resultados: "bg-emerald-600/20 text-emerald-400",
  Análisis:   "bg-blue-600/20 text-blue-400",
  Fichajes:   "bg-amber-600/20 text-amber-400",
};

// Shared, deduped client fetch — the home's SSR seed can be the STALE static
// fallback if Render was cold when the page rendered, so we always refresh in the
// browser (when Render is reachable) and swap in the real, current news.
let cache: { data: LiveArticle[]; ts: number } | null = null;
const inflight = { p: null as Promise<LiveArticle[]> | null };

async function fetchNews(): Promise<LiveArticle[]> {
  if (cache && Date.now() - cache.ts < 30_000) return cache.data;
  if (inflight.p) return inflight.p;
  inflight.p = (async () => {
    try {
      const data = await fetchNewsList({ signal: AbortSignal.timeout(20_000) });
      if (data.length) cache = { data, ts: Date.now() };
      return data;
    } finally {
      inflight.p = null;
    }
  })();
  return inflight.p;
}

function useHomeNews(initial: LiveArticle[]): LiveArticle[] {
  const [articles, setArticles] = useState<LiveArticle[]>(initial);
  useEffect(() => {
    let alive = true;
    fetchNews().then((fresh) => { if (alive && fresh.length) setArticles(fresh); });
    return () => { alive = false; };
  }, []);
  return articles;
}

/** Featured hero + two side cards (top of the home). */
export function HomeFeatured({ initial }: { initial: LiveArticle[] }) {
  const articles = useHomeNews(initial);
  const featured = articles[0];
  const side = articles.slice(1, 3);
  if (!featured) return null;

  return (
    <section className="container mx-auto px-4 py-6 md:py-8">
      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
        {/* Featured article */}
        <article className="lg:col-span-2 relative rounded-2xl overflow-hidden min-h-[360px] md:min-h-[460px]">
          <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-card to-background" />
          <NewsImage src={featured.imageUrl} alt={featured.title} className="absolute inset-0 w-full h-full object-cover opacity-55" />
          <div className="absolute inset-0 opacity-40 mix-blend-overlay" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,200,150,0.4), transparent 40%), radial-gradient(circle at 80% 70%, rgba(220,40,40,0.5), transparent 50%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08), transparent 60%)" }} />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 14px)" }} />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/80 to-transparent" />
          <div className="relative h-full flex flex-col justify-end p-6 md:p-10 min-h-[360px] md:min-h-[460px]">
            <Badge className="bg-red-600 text-white border-0 text-[10px] font-bold tracking-[0.2em] uppercase px-2.5 py-1 mb-4 w-fit">
              {featured.category}
            </Badge>
            <Link href={`/news/${featured.slug}`} className="group">
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[0.95] mb-4 max-w-3xl text-white group-hover:text-red-400 transition-colors">
                {featured.title}
              </h1>
            </Link>
            <p className="hidden md:block text-white/70 text-sm md:text-base max-w-2xl mb-5">{featured.excerpt}</p>
            <div className="flex items-center gap-3">
              <Link href={`/news/${featured.slug}`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors">
                Leer el artículo <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/standings" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-white/20 hover:border-white/40 hover:bg-white/5 text-white text-sm font-semibold transition-colors">
                <Trophy className="h-4 w-4" /> Ver tabla
              </Link>
            </div>
          </div>
        </article>

        {/* Side news cards */}
        <aside className="space-y-4 md:space-y-6">
          {side.map((a) => (
            <Link key={a.slug} href={`/news/${a.slug}`}
              className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-800 via-zinc-900 to-black border border-border hover:border-foreground/30 min-h-[170px] md:min-h-[215px] p-5 md:p-6 flex flex-col justify-between transition-colors block">
              <NewsImage src={a.imageUrl} alt={a.title} className="absolute inset-0 w-full h-full object-cover opacity-45 group-hover:opacity-55 transition-opacity" />
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent" />
              <div className="relative flex items-center gap-2">
                <span className={`text-[10px] font-bold tracking-[0.22em] uppercase px-2 py-0.5 rounded ${CATEGORY_COLORS[a.category] ?? "bg-muted text-muted-foreground"}`}>
                  {a.category}
                </span>
              </div>
              <div className="relative">
                <h3 className="text-base md:text-lg font-black text-white leading-tight group-hover:text-red-400 transition-colors">{a.title}</h3>
                <p className="text-white/70 text-xs md:text-sm mt-1 line-clamp-2">{a.excerpt}</p>
              </div>
            </Link>
          ))}
        </aside>
      </div>
    </section>
  );
}

/** "Más noticias" preview strip (lower on the home). */
export function HomeNewsStrip({ initial }: { initial: LiveArticle[] }) {
  const articles = useHomeNews(initial);
  const preview = articles.slice(3, 6);
  if (preview.length === 0) return null;

  return (
    <div className="container mx-auto px-4 pb-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-red-500" />
          <h2 className="font-bold uppercase tracking-widest text-sm">Más noticias</h2>
        </div>
        <Link href="/news" className="text-xs text-muted-foreground hover:text-foreground/80 flex items-center gap-1 transition-colors">
          Ver todas <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {preview.map((a) => (
          <Link key={a.slug} href={`/news/${a.slug}`}
            className="group rounded-xl border border-border bg-card/50 p-4 hover:border-foreground/30 transition-colors">
            <span className={`text-[10px] font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded mb-2 inline-block ${CATEGORY_COLORS[a.category] ?? "bg-muted text-muted-foreground"}`}>
              {a.category}
            </span>
            <h3 className="font-bold text-sm text-foreground group-hover:text-red-400 transition-colors leading-snug mt-1">{a.title}</h3>
          </Link>
        ))}
      </div>
    </div>
  );
}
