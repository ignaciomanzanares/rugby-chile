import { notFound } from "next/navigation";
import Link from "next/link";
import { getClub } from "@/data/clubs";
import { ROUNDS, matchStatus, clubLogo, type RoundMatch } from "@/lib/tournament";
import { MapPin, ArrowLeft, Trophy, BarChart3, Target, Zap } from "lucide-react";
import { PlayerStatsTable } from "./player-stats-table";
import { TeamResults } from "./team-results";

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
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${club.primary}33 0%, transparent 60%)` }} />
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: club.primary }} />
        <div className="relative container mx-auto px-4 py-10">
          <Link href="/teams" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Todos los clubes
          </Link>
          <div className="flex items-center gap-6">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={club.name} className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover flex-shrink-0 shadow-2xl ring-2 ring-zinc-800" />
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
              <p className="text-zinc-400 mt-1">{club.full}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-zinc-500">
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{club.location}</span>
                <span className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" />{club.venue}</span>
              </div>
            </div>
          </div>

          {/* Division standings summary */}
          <div className="flex flex-wrap gap-3 mt-8">
            {club.standings.map((s) => {
              const isPrimera = s.division === "Primera";
              const posColor =
                s.pos <= 4 ? "text-emerald-400" :
                isPrimera && s.pos === 9 ? "text-amber-400" :
                isPrimera && s.pos === 10 ? "text-red-400" :
                "text-white";
              return (
              <div key={s.division} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 min-w-36">
                <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wide mb-1">{s.division}</p>
                <div className="flex items-end gap-3">
                  <div>
                    <span className={`text-2xl font-black ${posColor}`}>
                      #{s.pos}
                    </span>
                  </div>
                  <div className="text-right ml-auto">
                    <p className="text-xl font-black text-white">{s.pts}</p>
                    <p className="text-zinc-600 text-xs">pts</p>
                  </div>
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  {s.pg}G{s.pe > 0 ? ` · ${s.pe}E` : ""} · {s.pp}P · {s.pf}-{s.pc}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 space-y-10">

        {/* Stats highlight cards */}
        <section className="grid sm:grid-cols-3 gap-4">
          {topTryScorer && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Líder en tries</span>
              </div>
              <p className="text-2xl font-black text-white">{topTryScorer.tries}</p>
              <p className="text-zinc-300 font-semibold text-sm mt-1">{topTryScorer.name}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{topTryScorer.matches} partidos jugados</p>
            </div>
          )}
          {topScorer && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Máximo goleador</span>
              </div>
              <p className="text-2xl font-black text-white">{topScorer.points} pts</p>
              <p className="text-zinc-300 font-semibold text-sm mt-1">{topScorer.name}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{topScorer.tries}T · {topScorer.conversions}C · {topScorer.penalties}P</p>
            </div>
          )}
          {primera && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-red-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Primera</span>
              </div>
              <p className={`text-2xl font-black ${primera.pos <= 4 ? "text-emerald-400" : primera.pos >= 9 ? "text-red-400" : "text-white"}`}>
                #{primera.pos} · {primera.pts} pts
              </p>
              <p className="text-zinc-300 font-semibold text-sm mt-1">{primera.pg}G{primera.pe > 0 ? ` · ${primera.pe}E` : ""} · {primera.pp}P</p>
              <p className="text-zinc-500 text-xs mt-0.5">{primera.pf} pts a favor · {primera.pc} en contra</p>
            </div>
          )}
        </section>

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
            <span className="text-xs text-zinc-500">{fullRoster.length} jugadores con presencia</span>
          </div>
          <p className="mb-3 text-xs text-zinc-500">Toca una columna para ordenar (PJ, Pts, Tries, etc.)</p>
          <PlayerStatsTable players={club.players} teamSlug={slug} />
          <p className="mt-2 text-xs text-zinc-600">PJ=Partidos · Pts=Puntos · T=Tries · C=Conversiones · P=Penales · TA/TR=Tarjetas</p>
        </section>

        {/* Full roster */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Trophy className="h-4 w-4 text-red-500" />
            <h2 className="font-bold uppercase tracking-widest text-sm">Plantel · {fullRoster.length} jugadores</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {fullRoster.map((p) => (
              <div key={p.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 hover:border-zinc-700 transition-colors">
                <p className="text-sm font-semibold text-zinc-200 truncate" title={p.name}>{p.name}</p>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-zinc-500 uppercase tracking-wider">
                  <span>{p.matches} PJ</span>
                  {p.points > 0 && <><span className="text-zinc-700">·</span><span>{p.points} pts</span></>}
                  {p.tries > 0 && <><span className="text-zinc-700">·</span><span className="text-emerald-500">{p.tries}T</span></>}
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

        <p className="text-xs text-zinc-600 text-center pt-2">
          Datos oficiales: <a href="https://arusa.cl/en/tournament/1328550/summary" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">arusa.cl</a>
        </p>
      </div>
    </div>
  );
}
