"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { NewsImage } from "@/components/news-image";
import { ArticleCard, CATEGORY_COLORS, formatDate, type ApiArticle } from "@/components/news-card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * El listado de noticias, corregido en el navegador.
 *
 * La página se arma en el servidor con un timeout corto contra la API. Si la API
 * está fría (Render tarda ~30s en despertar), ese render cae al respaldo
 * estático, que son notas de mayo — y eso queda cacheado. Acá se vuelve a pedir
 * la lista desde el navegador, sin apuro, y si llega algo más nuevo se
 * reemplaza: el usuario nunca se queda mirando noticias viejas.
 */
export function NewsLive({ inicial }: { inicial: ApiArticle[] }) {
  const [articles, setArticles] = useState(inicial);

  useEffect(() => {
    let vivo = true;
    fetch(`${API_URL}/api/v1/news`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ApiArticle[] | null) => {
        if (!vivo || !Array.isArray(d) || d.length === 0) return;
        const masNueva = (l: ApiArticle[]) => Math.max(...l.map((a) => Date.parse(a.publishedAt) || 0));
        if (masNueva(d) >= masNueva(articles)) setArticles(d);
      })
      .catch(() => {});
    return () => { vivo = false; };
    // Solo al montar: después manda lo que haya traído la API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [featured, ...rest] = articles;

  return (
    <>
      {featured && (
        <Link href={`/news/${featured.slug}`} className="group block rounded-2xl overflow-hidden relative min-h-[300px] md:min-h-[380px]">
          <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-card to-background" />
          <NewsImage src={featured.imageUrl} alt={featured.title} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-70 group-hover:scale-105 transition-all duration-500" />
          <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black via-black/70 to-transparent" />
          <div className="relative h-full flex flex-col justify-end p-6 md:p-10 min-h-[300px] md:min-h-[380px]">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-bold tracking-[0.2em] uppercase px-2.5 py-1 rounded border ${CATEGORY_COLORS[featured.category] ?? "bg-muted text-muted-foreground border-border"}`}>
                {featured.category}
              </span>
              {featured.sourceName && (
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase px-2.5 py-1 rounded border bg-muted/60 text-muted-foreground border-border">
                  vía {featured.sourceName}
                </span>
              )}
            </div>
            <h2 className="text-2xl md:text-4xl font-black leading-tight mb-3 text-white group-hover:text-red-400 transition-colors max-w-3xl">
              {featured.title}
            </h2>
            <p className="text-white/70 text-sm md:text-base max-w-2xl mb-4 hidden md:block">{featured.excerpt}</p>
            <div className="flex items-center gap-4 text-white/60 text-xs">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(featured.publishedAt)}</span>
              <span>{featured.author}</span>
            </div>
          </div>
        </Link>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
        {rest.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
    </>
  );
}
