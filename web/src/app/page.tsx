export const dynamic = "force-dynamic";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Trophy, ArrowRight, Newspaper, Radio } from "lucide-react";
import { HomeMatchesSection } from "@/components/home-matches-section";
import { HomeResultsSection } from "@/components/home-results-section";
import { HomeStandingsPreview } from "@/components/home-standings-preview";
import { FixturesStrip } from "@/components/fixtures-strip";
import { HomeLeaders } from "@/components/home-leaders";
import { NewsImage } from "@/components/news-image";
import {
  ROUNDS,
  nextFechaNumber,
  lastFechaNumber,
  clubLogo,
} from "@/lib/tournament";
import { articles, type NewsArticle } from "@/data/news";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Fetch news server-side from the API. The scraper populates the DB every 6h;
// we revalidate every 5 minutes so updates roll through without a full rebuild.
// Falls back to the bundled static articles if the API is unavailable.
type LiveArticle = NewsArticle & { imageUrl?: string | null; sourceUrl?: string | null };

async function fetchLiveNews(): Promise<LiveArticle[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/news`, { cache: "no-store" });
    if (!res.ok) return articles;
    const rows: any[] = await res.json();
    if (!rows.length) return articles;
    return rows.map((a) => ({
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt ?? "",
      category: a.category ?? "Noticias",
      date: (a.publishedAt ?? a.createdAt ?? "").slice(0, 10),
      author: a.author ?? "Redacción Top 10",
      featured: Boolean(a.featured),
      body: a.body ?? "",
      imageUrl: a.imageUrl ?? null,
      sourceUrl: a.sourceUrl ?? null,
    }));
  } catch {
    return articles;
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  Resultados: "bg-emerald-600/20 text-emerald-400",
  Análisis:   "bg-blue-600/20 text-blue-400",
  Fichajes:   "bg-amber-600/20 text-amber-400",
};

const CLUBS: Record<string, { primary: string; secondary: string; initials: string }> = {
  COBS:             { primary: "#1a3a6b", secondary: "#c9a227", initials: "CO" },
  "Old Boys":       { primary: "#cc0000", secondary: "#ffffff", initials: "OB" },
  PWCC:             { primary: "#003087", secondary: "#FFB81C", initials: "PW" },
  "Old Macks":      { primary: "#b91c1c", secondary: "#ffffff", initials: "OM" },
  "Stade Francais": { primary: "#1a237e", secondary: "#e8102a", initials: "SF" },
  "Sporting RC":    { primary: "#15803d", secondary: "#ffffff", initials: "SP" },
  DOBS:             { primary: "#0369a1", secondary: "#fbbf24", initials: "DO" },
  UC:               { primary: "#1e3a8a", secondary: "#fbbf24", initials: "UC" },
  "Old Johns":      { primary: "#1d4ed8", secondary: "#fef08a", initials: "OJ" },
  "Old Reds":       { primary: "#9f1239", secondary: "#fca5a5", initials: "OR" },
};

function ClubBadge({ team, size = "sm" }: { team: string; size?: "sm" | "md" | "lg" }) {
  const c = CLUBS[team] ?? { primary: "#374151", secondary: "#fff", initials: team.slice(0, 2).toUpperCase() };
  const dim =
    size === "lg" ? "w-10 h-10 text-sm" :
    size === "md" ? "w-9 h-9 text-sm" :
                    "w-7 h-7 text-xs";
  const logo = clubLogo(team);
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={team}
        className={`${dim} rounded-full flex-shrink-0 object-cover ring-1 ring-border`}
      />
    );
  }
  return (
    <span
      className={`${dim} rounded-full inline-flex items-center justify-center font-bold flex-shrink-0`}
      style={{ backgroundColor: c.primary, color: c.secondary }}
    >
      {c.initials}
    </span>
  );
}

// "Sáb 16 May" → "16 May"
function shortDate(d: string): string {
  const parts = d.split(" ");
  return parts.length >= 3 ? `${parts[1]} ${parts[2]}` : d;
}

export default async function HomePage() {
  const primeraRounds = ROUNDS.PRIMERA;
  const nextN = nextFechaNumber();
  const lastN = lastFechaNumber();
  const nextRound = primeraRounds.find((r) => r.round === nextN);
  const lastRound = lastN !== undefined ? primeraRounds.find((r) => r.round === lastN) : undefined;

  const stripFixtures = (nextRound?.matches ?? []).map((m) => ({
    home: m.home,
    away: m.away,
    date: m.date,
    dateLabel: shortDate(m.date),
    time: m.time,
    venue: m.venue,
    round: nextRound!.round,
    division: "PRIMERA" as const,
  }));

  // News data (live from API, static fallback)
  const liveArticles = await fetchLiveNews();
  const sortedArticles = [...liveArticles].sort((a, b) => b.date.localeCompare(a.date));
  const featuredArticle = sortedArticles[0];
  const sideArticles = sortedArticles.slice(1, 3);
  const newsPreview = sortedArticles.slice(3, 6);

  return (
    <div className="min-h-screen bg-background text-foreground">

      {nextRound && (
        <FixturesStrip round={nextRound.round} fixtures={stripFixtures} />
      )}

      {/* Hero + side cards */}
      <section className="container mx-auto px-4 py-6 md:py-8">
        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">

          {/* Featured article */}
          <article className="lg:col-span-2 relative rounded-2xl overflow-hidden min-h-[360px] md:min-h-[460px]">
            <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-card to-background" />
            {featuredArticle.imageUrl && (
              <NewsImage src={featuredArticle.imageUrl} alt={featuredArticle.title} className="absolute inset-0 w-full h-full object-cover opacity-55" />
            )}
            <div
              className="absolute inset-0 opacity-40 mix-blend-overlay"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 30%, rgba(255,200,150,0.4), transparent 40%), radial-gradient(circle at 80% 70%, rgba(220,40,40,0.5), transparent 50%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08), transparent 60%)",
              }}
            />
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 14px)",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/80 to-transparent" />
            <div className="relative h-full flex flex-col justify-end p-6 md:p-10 min-h-[360px] md:min-h-[460px]">
              <Badge className="bg-red-600 text-white border-0 text-[10px] font-bold tracking-[0.2em] uppercase px-2.5 py-1 mb-4 w-fit">
                {featuredArticle.category}
              </Badge>
              <Link href={`/news/${featuredArticle.slug}`} className="group">
                <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[0.95] mb-4 max-w-3xl text-white group-hover:text-red-400 transition-colors">
                  {featuredArticle.title}
                </h1>
              </Link>
              <p className="hidden md:block text-white/70 text-sm md:text-base max-w-2xl mb-5">
                {featuredArticle.excerpt}
              </p>
              <div className="flex items-center gap-3">
                <Link
                  href={`/news/${featuredArticle.slug}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors"
                >
                  Leer el artículo <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/standings"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-white/20 hover:border-white/40 hover:bg-white/5 text-white text-sm font-semibold transition-colors"
                >
                  <Trophy className="h-4 w-4" /> Ver tabla
                </Link>
              </div>
            </div>
          </article>

          {/* Side news cards */}
          <aside className="space-y-4 md:space-y-6">
            {sideArticles.map((a) => (
              <Link key={a.slug} href={`/news/${a.slug}`}
                className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-800 via-zinc-900 to-black border border-border hover:border-foreground/30 min-h-[170px] md:min-h-[215px] p-5 md:p-6 flex flex-col justify-between transition-colors block">
                {a.imageUrl ? (
                  <NewsImage src={a.imageUrl} alt={a.title} className="absolute inset-0 w-full h-full object-cover opacity-45 group-hover:opacity-55 transition-opacity" />
                ) : (
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: "radial-gradient(circle at 80% 20%, rgba(220,40,40,0.45), transparent 50%)",
                    }}
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent" />
                <div className="relative flex items-center gap-2">
                  <span className={`text-[10px] font-bold tracking-[0.22em] uppercase px-2 py-0.5 rounded ${CATEGORY_COLORS[a.category] ?? "bg-muted text-muted-foreground"}`}>
                    {a.category}
                  </span>
                </div>
                <div className="relative">
                  <h3 className="text-base md:text-lg font-black text-white leading-tight group-hover:text-red-400 transition-colors">
                    {a.title}
                  </h3>
                  <p className="text-white/70 text-xs md:text-sm mt-1 line-clamp-2">{a.excerpt}</p>
                </div>
              </Link>
            ))}
          </aside>

        </div>
      </section>

      {/* Individual leaders */}
      <HomeLeaders />

      {/* Fixtures + results + standings */}
      <div className="container mx-auto px-4 pb-12">
        <div className="grid lg:grid-cols-3 gap-8">

          <div className="lg:col-span-2 space-y-8">

            {nextRound && (
              <HomeMatchesSection
                round={nextRound.round}
                matches={nextRound.matches.map((m) => ({
                  home: m.home,
                  away: m.away,
                  date: m.date,
                  time: m.time,
                  venue: m.venue,
                }))}
                division="PRIMERA"
              />
            )}

            {lastRound && (
              <HomeResultsSection round={lastRound.round} matches={lastRound.matches} />
            )}
          </div>

          <HomeStandingsPreview />

        </div>
      </div>

      {/* News preview strip */}
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
          {newsPreview.map((a) => (
            <Link key={a.slug} href={`/news/${a.slug}`}
              className="group rounded-xl border border-border bg-card/50 p-4 hover:border-foreground/30 transition-colors">
              <span className={`text-[10px] font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded mb-2 inline-block ${CATEGORY_COLORS[a.category] ?? "bg-muted text-muted-foreground"}`}>
                {a.category}
              </span>
              <h3 className="font-bold text-sm text-foreground group-hover:text-red-400 transition-colors leading-snug mt-1">
                {a.title}
              </h3>
            </Link>
          ))}
        </div>
      </div>

      {/* Live link */}
      <div className="container mx-auto px-4 pb-12">
        <Link href="/live"
          className="flex items-center justify-between rounded-xl border border-red-800/40 bg-red-950/30 px-6 py-4 hover:bg-red-950/50 transition-colors group">
          <div className="flex items-center gap-3">
            <Radio className="h-5 w-5 text-red-500 animate-pulse" />
            <div>
              <p className="font-bold text-foreground text-sm">Marcador en vivo</p>
              <p className="text-muted-foreground text-xs">Sigue los partidos en tiempo real</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
      </div>

    </div>
  );
}
