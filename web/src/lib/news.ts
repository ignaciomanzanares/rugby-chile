import type { NewsArticle } from "@/data/news";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type LiveArticle = NewsArticle & { imageUrl?: string | null; sourceUrl?: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapNewsRow(a: any): LiveArticle {
  return {
    slug: a.slug, title: a.title, excerpt: a.excerpt ?? "", category: a.category ?? "Noticias",
    date: (a.publishedAt ?? a.createdAt ?? "").slice(0, 10),
    author: a.author ?? "Redacción Top 10", featured: Boolean(a.featured), body: a.body ?? "",
    imageUrl: a.imageUrl ?? null, sourceUrl: a.sourceUrl ?? null,
  };
}

/**
 * Trae las noticias reales (arusa + editorial) desde la API, más nuevas primero.
 * Devuelve [] si falla — el llamador cae al dataset estático. Sirve para SSR
 * (con timeout corto) y para el cliente. No cachea: siempre queremos lo último.
 */
export async function fetchNewsList(init?: RequestInit): Promise<LiveArticle[]> {
  try {
    // Fresco por defecto (cliente); pero si el llamador pide cacheo explícito
    // (p. ej. el home con next.revalidate para ISR) lo respetamos y NO forzamos
    // no-store, que si no dejaría la ruta dinámica.
    const cacheDefault = init?.cache || (init as { next?: unknown })?.next ? {} : { cache: "no-store" as const };
    const res = await fetch(`${API_URL}/api/v1/news`, { ...cacheDefault, ...init });
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(mapNewsRow).sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}
