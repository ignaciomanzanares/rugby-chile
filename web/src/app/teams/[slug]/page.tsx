import { notFound } from "next/navigation";
import Link from "next/link";
import { getClub } from "@/data/clubs";
import { ROUNDS, matchStatus, clubLogo, type RoundMatch } from "@/lib/tournament";
import { MapPin, ArrowLeft, Trophy, BarChart3 } from "lucide-react";
import { PlayerStatsTable } from "./player-stats-table";
import { TeamResults } from "./team-results";
import { ClubStandingsSummary, ClubHighlights } from "./club-live";

export function generateStaticParams() {
  return [
    "cobs","old-boys","pwcc","old-macks","stade-francais",
    "sporting-rc","dobs","uc","old-johns","old-reds",
  ].map((slug) => ({ slug }));
}

function teamLastResults(teamName: string, limit = 5): { round: number; match: RoundMatch }[] {
  const all: { round: number; match: RoundMatch }[] = [];
  for (const r of ROUNDS.PRIMERA) {
    for (const m of r.matches) {
      if (matchStatus(m) === "FINISHED" && (m.home === teamName || m.away === teamName)) {
        all.push({ round: r.round, match: m });
      }
    }
  }
  return all.reverse().slice(0, limit);
}

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = getClub(slug);
  if (!club) notFound();

  const topScorer = [...club.players].sort((a, b) => b.points - a.points)[0];
  const topTryScorer = [...club.players].sort((a, b) => b.tries - a.tries).filter((p) => p.tries > 0)[0];
  const fullRoster = [...club.players].filter((p) => p.matches > 0).sort((a, b) => a.name.localeCompare(b.name));

  const primera = club.standings.find((s) => s.division === "Primera");
  const lastResults = teamLastResults(club.name, 5);

  const logo = clubLogo(club.name);

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${club.primary}33 0%, transparent 60%)` }} />
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: club.primary }} />
        <div className="relative container mx-auto px-4 py-10">
          <Link href="/teams" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Todos los clubes
          </Link>
          <div className="flex items-center gap-6">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={club.name} className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover flex-shrink-0 shadow-2xl ring-2 ring-border" />
            ) : (
              <div
                className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-3xl md:text-4xl font-black flex-shrink-0 shadow-2xl"
                style={{ backgroundColor: club.primary, color: club.secondary }}
              >
                {club.initials}
              </div>
            )}
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight">{club.name}</h1>
              <p className="text-muted-foreground mt-1">{club.full}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{club.location}</span>
                <span className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" />{club.venue}</span>
              </div>
            </div>
          </div>

          {/* Division standings summary (live arusa, static fallback) */}
          <ClubStandingsSummary teamName={club.name} fallback={club.standings} />
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 space-y-10">

        {/* Stats highlight cards (live arusa, static fallback) */}
        <ClubHighlights
          teamName={club.name}
          teamSlug={slug}
          fallbackTopScorer={topScorer}
          fallbackTopTry={topTryScorer}
          fallbackPrimera={primera}
        />

        {/* Últimos resultados — Primera */}
        {lastResults.length > 0 && (
          <TeamResults teamName={club.name} results={lastResults} />
        )}

        {/* Stats table — sortable */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-red-500" />
              <h2 className="font-bold uppercase tracking-widest text-sm">Estadísticas · Top 10</h2>
            </div>
            <span className="text-xs text-muted-foreground">{fullRoster.length} jugadores con presencia</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Toca una columna para ordenar (PJ, Pts, Tries, etc.)</p>
          <PlayerStatsTable players={club.players} teamSlug={slug} />
          <p className="mt-2 text-xs text-muted-foreground/70">PJ=Partidos · Pts=Puntos · T=Tries · C=Conversiones · P=Penales · TA/TR=Tarjetas</p>
        </section>

        {/* Full roster */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Trophy className="h-4 w-4 text-red-500" />
            <h2 className="font-bold uppercase tracking-widest text-sm">Plantel · {fullRoster.length} jugadores</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {fullRoster.map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-card/40 px-3 py-2.5 hover:border-border transition-colors">
                <p className="text-sm font-semibold text-foreground truncate" title={p.name}>{p.name}</p>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <span>{p.matches} PJ</span>
                  {p.points > 0 && <><span className="text-muted-foreground/50">·</span><span>{p.points} pts</span></>}
                  {p.tries > 0 && <><span className="text-muted-foreground/50">·</span><span className="text-emerald-500">{p.tries}T</span></>}
                  {p.yellowCards > 0 && (
                    <span
                      className="inline-block w-2.5 h-3.5 rounded-[2px] bg-yellow-400 ml-1"
                      title={`${p.yellowCards} amarilla(s)`}
                    />
                  )}
                  {p.redCards > 0 && (
                    <span
                      className="inline-block w-2.5 h-3.5 rounded-[2px] bg-red-500"
                      title={`${p.redCards} roja(s)`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="text-xs text-muted-foreground/70 text-center pt-2">
          Datos oficiales: <a href="https://arusa.cl/en/tournament/1328550/summary" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">arusa.cl</a>
        </p>
      </div>
    </div>
  );
}
