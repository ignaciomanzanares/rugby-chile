import Link from "next/link";
import { ArrowRight, Clock, Tag, ExternalLink } from "lucide-react";
import { articles as staticArticles } from "@/data/news";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ApiArticle {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  publishedAt: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  featured: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  Resultados: "bg-emerald-600/20 text-emerald-400 border-emerald-600/30",
  Análisis:   "bg-blue-600/20 text-blue-400 border-blue-600/30",
  Fichajes:   "bg-amber-600/20 text-amber-400 border-amber-600/30",
  Entrevista: "bg-purple-600/20 text-purple-400 border-purple-600/30",
  Noticias:   "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function getArticles(): Promise<ApiArticle[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/news`, { next: { revalidate: 300 } });
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
  }));
}

export default async function NewsPage() {
  const all = await getArticles();
  const [featured, ...rest] = all;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="container mx-auto px-4 py-8 space-y-10">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-wide">Noticias</h1>
            <p className="text-zinc-500 text-sm mt-1">Top 10 ARUSA · Temporada 2026</p>
          </div>
          <span className="text-xs text-zinc-600 hidden sm:block">Actualizado automáticamente desde Rugbiers y Rugby Chile</span>
        </div>

        {/* Featured */}
        {featured && (
          <Link href={`/news/${featured.slug}`} className="group block rounded-2xl overflow-hidden relative min-h-[300px] md:min-h-[380px]">
            <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-zinc-900 to-zinc-950" />
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: "radial-gradient(circle at 20% 30%, rgba(220,38,38,0.6), transparent 50%), radial-gradient(circle at 80% 70%, rgba(120,20,20,0.5), transparent 50%)",
            }} />
            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black via-black/70 to-transparent" />
            <div className="relative h-full flex flex-col justify-end p-6 md:p-10 min-h-[300px] md:min-h-[380px]">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-bold tracking-[0.2em] uppercase px-2.5 py-1 rounded border ${CATEGORY_COLORS[featured.category] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                  {featured.category}
                </span>
                {featured.sourceName && (
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase px-2.5 py-1 rounded border bg-zinc-800/60 text-zinc-400 border-zinc-700">
                    vía {featured.sourceName}
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-4xl font-black leading-tight mb-3 group-hover:text-red-400 transition-colors max-w-3xl">
                {featured.title}
              </h2>
              <p className="text-zinc-400 text-sm md:text-base max-w-2xl mb-4 hidden md:block">{featured.excerpt}</p>
              <div className="flex items-center gap-4 text-zinc-500 text-xs">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(featured.publishedAt)}</span>
                <span>{featured.author}</span>
              </div>
            </div>
          </Link>
        )}

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rest.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>

      </div>
    </div>
  );
}

function ArticleCard({ article }: { article: ApiArticle }) {
  const isExternal = Boolean(article.sourceUrl);
  const href = article.sourceUrl ?? `/news/${article.slug}`;
  const external = isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <a href={href} {...external}
      className="group rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-600 transition-colors flex flex-col">
      <div className={`h-1 ${article.category === "Resultados" ? "bg-emerald-500" : article.category === "Análisis" ? "bg-blue-500" : article.category === "Fichajes" ? "bg-amber-500" : "bg-zinc-600"}`} />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-[10px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded border ${CATEGORY_COLORS[article.category] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
            <Tag className="h-2.5 w-2.5 inline mr-1" />{article.category}
          </span>
          {article.sourceName && (
            <span className="text-[10px] text-zinc-600 font-medium">{article.sourceName}</span>
          )}
        </div>
        <h3 className="font-black text-white text-base leading-snug mb-2 group-hover:text-red-400 transition-colors flex-1">
          {article.title}
        </h3>
        <p className="text-zinc-500 text-xs leading-relaxed mb-4 line-clamp-3">{article.excerpt}</p>
        <div className="flex items-center justify-between mt-auto">
          <span className="text-zinc-600 text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" />{formatDate(article.publishedAt)}
          </span>
          <span className="text-red-500 text-xs font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
            {isExternal ? <><ExternalLink className="h-3 w-3" /> Ver nota</> : <>Leer <ArrowRight className="h-3 w-3" /></>}
          </span>
        </div>
      </div>
    </a>
  );
}
