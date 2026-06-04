import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Tag, ArrowRight, ExternalLink } from "lucide-react";
import { getArticle, getRelated } from "@/data/news";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Article = {
  slug: string; title: string; excerpt: string; body: string;
  category: string; author: string; date: string;
  sourceName?: string | null; sourceUrl?: string | null;
};

// Prefer the live API (arusa / RSS / DB), fall back to the static seed set.
async function getArticleData(slug: string): Promise<Article | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/news/${slug}`, { next: { revalidate: 60 } });
    if (res.ok) {
      const a = await res.json();
      if (a && a.slug) {
        return {
          slug: a.slug, title: a.title, excerpt: a.excerpt ?? "",
          body: a.body ?? a.excerpt ?? "", category: a.category ?? "Noticias",
          author: a.author ?? "ARUSA", date: String(a.publishedAt ?? "").slice(0, 10),
          sourceName: a.sourceName, sourceUrl: a.sourceUrl,
        };
      }
    }
  } catch { /* fall through to static */ }
  const s = getArticle(slug);
  return s ? { ...s, sourceName: null, sourceUrl: null } : null;
}

const CATEGORY_COLORS: Record<string, string> = {
  Resultados: "bg-emerald-600/20 text-emerald-400 border-emerald-600/30",
  Análisis:   "bg-blue-600/20 text-blue-400 border-blue-600/30",
  Fichajes:   "bg-amber-600/20 text-amber-400 border-amber-600/30",
  Entrevista: "bg-purple-600/20 text-purple-400 border-purple-600/30",
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${d} de ${months[m - 1]} de ${y}`;
}

function renderBody(body: string) {
  return body.split("\n\n").map((para, i) => {
    // Bold: **text** → <strong>
    const parts = para.split(/(\*\*[^*]+\*\*)/g).map((chunk, j) => {
      if (chunk.startsWith("**") && chunk.endsWith("**")) {
        return <strong key={j} className="text-white font-bold">{chunk.slice(2, -2)}</strong>;
      }
      return chunk;
    });
    // Heading: starts with **...:** pattern — treat as subheading
    const isHeading = para.startsWith("**") && para.includes(":**");
    if (isHeading) {
      return (
        <h3 key={i} className="text-lg font-black text-white mt-6 mb-2">
          {parts}
        </h3>
      );
    }
    return (
      <p key={i} className="text-zinc-300 leading-relaxed">
        {parts}
      </p>
    );
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleData(slug);
  if (!article) notFound();

  const related = getRelated(slug);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">

        {/* Back */}
        <Link href="/news" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-sm mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Todas las noticias
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-[10px] font-bold tracking-[0.2em] uppercase px-2.5 py-1 rounded border ${CATEGORY_COLORS[article.category] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
              <Tag className="h-2.5 w-2.5 inline mr-1" />{article.category}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black leading-tight mb-5">
            {article.title}
          </h1>

          <p className="text-zinc-400 text-lg leading-relaxed mb-5 border-l-4 border-red-600 pl-4">
            {article.excerpt}
          </p>

          <div className="flex items-center gap-4 text-zinc-500 text-sm border-t border-b border-zinc-800 py-3">
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{formatDate(article.date)}</span>
            <span className="text-zinc-700">·</span>
            <span>{article.author}</span>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 text-base">
          {renderBody(article.body)}
        </div>

        {article.sourceUrl && (
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 px-4 py-2.5 rounded-lg bg-red-600/15 border border-red-600/30 text-red-400 hover:bg-red-600/25 text-sm font-semibold transition-colors"
          >
            <ExternalLink className="h-4 w-4" /> Leer el artículo completo{article.sourceName ? ` en ${article.sourceName}` : ""}
          </a>
        )}

        {/* Related articles */}
        {related.length > 0 && (
          <div className="mt-12 pt-8 border-t border-zinc-800">
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">También te puede interesar</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {related.map((r) => (
                <Link key={r.slug} href={`/news/${r.slug}`}
                  className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-600 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded border ${CATEGORY_COLORS[r.category] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                      {r.category}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-white group-hover:text-red-400 transition-colors leading-snug mb-2">
                    {r.title}
                  </h3>
                  <span className="text-red-500 text-xs font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                    Leer <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
