export const dynamic = "force-dynamic";
import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";
import { HomeMatchesSection } from "@/components/home-matches-section";
import { HomeResultsSection } from "@/components/home-results-section";
import { HomeStandingsPreview } from "@/components/home-standings-preview";
import { HomeProjectionPreview } from "@/components/home-projection-preview";
import { HomeFeatured, HomeNewsStrip } from "@/components/home-news";
import { FixturesStrip } from "@/components/fixtures-strip";
import { HomeLeaders } from "@/components/home-leaders";
import {
  ROUNDS,
  nextFechaNumber,
  lastFechaNumber,
  clubLogo,
} from "@/lib/tournament";
import { articles, type NewsArticle } from "@/data/news";
import { fetchLeveradeStandings, fetchLeveradeResults } from "@/lib/leverade";
import type { Projection } from "@/components/home-projection-preview";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Seed the season projection server-side so the home shows it on first paint.
// Bounded timeout: on a cold Render instance the Monte Carlo call can be slow, so
// we cap the wait and let the client refresh finish it rather than block the page.
async function fetchProjection(): Promise<Projection | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/predict/season`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Projection;
  } catch {
    return null;
  }
}

// Fetch news server-side from the API. The scraper populates the DB every 6h;
// we revalidate every 5 minutes so updates roll through without a full rebuild.
// Falls back to the bundled static articles if the API is unavailable.
type LiveArticle = NewsArticle & { imageUrl?: string | null; sourceUrl?: string | null };

async function fetchLiveNews(): Promise<LiveArticle[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/news`, { cache: "no-store" });
    if (!res.ok) return articles;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Fetch live standings + results server-side so the first paint is already
  // fresh. Without this the client widgets briefly flash their static snapshot
  // before the client-side poll lands. Cache: no-store — page is force-dynamic.
  const [initialStandings, initialResults, initialProjection] = await Promise.all([
    fetchLeveradeStandings("PRIMERA", { cache: "no-store" }),
    fetchLeveradeResults({ cache: "no-store" }),
    fetchProjection(),
  ]);

  // News data — SSR seed (live from API, static fallback). The client components
  // re-fetch so a cold-start SSR miss (stale static articles) self-heals.
  const liveArticles = await fetchLiveNews();
  const sortedArticles = [...liveArticles].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-screen bg-background text-foreground">

      {nextRound && (
        <FixturesStrip round={nextRound.round} fixtures={stripFixtures} initialResults={initialResults} />
      )}

      {/* Hero + side cards (client-refreshed so a cold-start SSR miss self-heals) */}
      <HomeFeatured initial={sortedArticles} />

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
                initialResults={initialResults}
              />
            )}

            {lastRound && (
              <HomeResultsSection round={lastRound.round} matches={lastRound.matches} initialResults={initialResults} />
            )}
          </div>

          <div className="space-y-8">
            <HomeStandingsPreview initialRows={initialStandings} />
            <HomeProjectionPreview initialProjection={initialProjection} />
          </div>

        </div>
      </div>

      {/* News preview strip (client-refreshed) */}
      <HomeNewsStrip initial={sortedArticles} />

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
