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
  nextFechaNumber,
  lastFechaNumber,
  clubLogo,
} from "@/lib/tournament";
import { overlayRounds, fetchArusaCalendar } from "@/lib/calendar";
import { articles } from "@/data/news";

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
  // Fixture con horarios/aplazados frescos de arusa (superpuesto sobre ROUNDS).
  // Timeout corto: el endpoint es SWR/rápido, pero si falla cae a ROUNDS y el
  // home igual pinta al instante.
  const cal = await fetchArusaCalendar({ signal: AbortSignal.timeout(3500) });
  const primeraRounds = overlayRounds("PRIMERA", cal);
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

  // Nada de fetches en el servidor: el home pinta al instante (shell estático) y
  // cada widget (tabla, resultados, proyección, noticias, líderes) trae sus datos
  // por su cuenta en el cliente, con skeleton. Antes esta página era
  // force-dynamic y esperaba varias llamadas a la API antes de pintar — con la API
  // fría (Render duerme a los 15min) eso se iba a >10s y Vercel cortaba la función
  // a los 10s. Ahora la navegación al home es inmediata y los datos entran solos.
  const sortedArticles = [...articles].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-screen bg-background text-foreground">

      {nextRound && (
        <FixturesStrip round={nextRound.round} fixtures={stripFixtures} />
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
              />
            )}

            {lastRound && (
              <HomeResultsSection round={lastRound.round} matches={lastRound.matches} />
            )}
          </div>

          <div className="space-y-8">
            <HomeStandingsPreview />
            <HomeProjectionPreview />
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
