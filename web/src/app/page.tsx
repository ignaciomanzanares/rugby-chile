// ISR: el home se pre-renderiza y se revalida en segundo plano cada 2 min, así
// se sirve al instante (shell cacheado) sin esperar los fetches de la API en el
// camino crítico. El calendario/noticias del shell pueden estar hasta 2 min
// viejos, pero los widgets del cliente refrescan todo en vivo por su cuenta.
export const revalidate = 120;
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
import { fetchNewsList, type LiveArticle } from "@/lib/news";
import { fetchLeveradeStandings } from "@/lib/leverade";
import { fetchPlayerStats } from "@/lib/player-stats-api";
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
  // Calendario (horarios/aplazados de arusa, superpuesto sobre ROUNDS) y noticias
  // frescas, en paralelo y con timeouts cortos: los endpoints son SWR/rápidos,
  // pero si la API está fría caen al fallback y el home igual pinta al instante.
  // También sembramos la tabla y los líderes de PRIMERA (el tab por defecto):
  // son datos históricos que ya existen, no tienen por qué "cargar" en cada
  // visita. Al venir en el shell ISR, salen al instante sin skeleton; el cliente
  // igual refresca encima para lo que esté en vivo.
  const [cal, freshNews, standings, playerStats] = await Promise.all([
    fetchArusaCalendar({ next: { revalidate: 120 }, signal: AbortSignal.timeout(3500) }),
    fetchNewsList({ next: { revalidate: 120 }, signal: AbortSignal.timeout(3500) }),
    fetchLeveradeStandings("PRIMERA", { next: { revalidate: 120 }, signal: AbortSignal.timeout(3500) }),
    fetchPlayerStats("PRIMERA", { next: { revalidate: 120 }, signal: AbortSignal.timeout(3500) }),
  ]);
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

  // El resto de los widgets (tabla, resultados, proyección, líderes) traen sus
  // datos en el cliente con skeleton, así el home pinta al instante sin esperar
  // a la API fría (Render duerme a los 15min; Vercel corta la función a los 10s).
  // Semilla de noticias: lo real y actual de la API; el dataset estático (viejo)
  // es solo el último recurso si la API no responde. Antes se sembraba siempre
  // con lo estático (mayo, Fecha 5) y solo se reemplazaba si el fetch del cliente
  // alcanzaba — por eso "a veces" salía info vieja en el hero. El cliente igual
  // refresca encima para mantenerlo vivo.
  const staticSorted = [...articles].sort((a, b) => b.date.localeCompare(a.date));
  const newsSeed: LiveArticle[] = freshNews.length ? freshNews : staticSorted;

  return (
    <div className="min-h-screen bg-background text-foreground">

      {nextRound && (
        <FixturesStrip round={nextRound.round} fixtures={stripFixtures} />
      )}

      {/* Hero + side cards (client-refreshed so a cold-start SSR miss self-heals) */}
      <HomeFeatured initial={newsSeed} />

      {/* Individual leaders */}
      <HomeLeaders initialPlayers={playerStats} />

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
            <HomeStandingsPreview initialRows={standings} />
            <HomeProjectionPreview />
          </div>

        </div>
      </div>

      {/* News preview strip (client-refreshed) */}
      <HomeNewsStrip initial={newsSeed} />

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
