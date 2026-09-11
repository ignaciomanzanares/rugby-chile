import Link from "next/link";
import { ArrowRight, Clock, Tag, ExternalLink } from "lucide-react";
import { NewsImage } from "@/components/news-image";

// Pieza compartida entre la página de noticias (servidor) y el listado que se
// corrige en el navegador, para no importar una *page* desde un componente
// cliente (arrastraría el módulo de servidor al bundle).

export interface ApiArticle {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  publishedAt: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  featured: boolean;
}

export const CATEGORY_COLORS: Record<string, string> = {
  Resultados: "bg-emerald-600/20 text-emerald-400 border-emerald-600/30",
  Análisis:   "bg-blue-600/20 text-blue-400 border-blue-600/30",
  Fichajes:   "bg-amber-600/20 text-amber-400 border-amber-600/30",
  Entrevista: "bg-purple-600/20 text-purple-400 border-purple-600/30",
  Noticias:   "bg-secondary/40 text-muted-foreground border-foreground/30/30",
};

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function ArticleCard({ article }: { article: ApiArticle }) {
  const isExternal = Boolean(article.sourceUrl);
  const href = article.sourceUrl ?? `/news/${article.slug}`;
  const external = isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <a href={href} {...external}
      className="group rounded-xl border border-border bg-card/50 overflow-hidden hover:border-foreground/30 transition-colors flex flex-col">
      <div className="relative h-40 overflow-hidden bg-muted">
        <NewsImage src={article.imageUrl} alt={article.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className={`h-1 ${article.category === "Resultados" ? "bg-emerald-500" : article.category === "Análisis" ? "bg-blue-500" : article.category === "Fichajes" ? "bg-amber-500" : "bg-secondary"}`} />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-[10px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded border ${CATEGORY_COLORS[article.category] ?? "bg-muted text-muted-foreground border-border"}`}>
            <Tag className="h-2.5 w-2.5 inline mr-1" />{article.category}
          </span>
          {article.sourceName && (
            <span className="text-[10px] text-muted-foreground/70 font-medium">{article.sourceName}</span>
          )}
        </div>
        <h3 className="font-black text-foreground text-base leading-snug mb-2 group-hover:text-red-400 transition-colors flex-1">
          {article.title}
        </h3>
        <p className="text-muted-foreground text-xs leading-relaxed mb-4 line-clamp-3">{article.excerpt}</p>
        <div className="flex items-center justify-between mt-auto">
          <span className="text-muted-foreground/70 text-xs flex items-center gap-1">
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
