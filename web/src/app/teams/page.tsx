import Link from "next/link";
import { Trophy, MapPin } from "lucide-react";
import { clubs } from "@/data/clubs";
import { clubLogo } from "@/lib/tournament";

export default function TeamsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <section className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-1">
            <Trophy className="h-5 w-5 text-red-500" />
            <h1 className="text-2xl font-black uppercase tracking-widest">Los 10 Clubes</h1>
          </div>
          <p className="text-zinc-500 text-sm">Primera División · Cada club compite en 3 divisiones</p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">

        {/* Clubs grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clubs.map((club) => {
            const primera = club.standings.find((s) => s.division === "Primera");
            const logo = clubLogo(club.name);
            const pos = primera?.pos ?? 0;
            const pts = primera?.pts ?? 0;

            return (
              <Link
                key={club.slug}
                href={`/teams/${club.slug}`}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-600 transition-colors group block"
              >
                {/* Color bar */}
                <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${club.primary}, ${club.secondary})` }} />

                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logo}
                        alt={club.name}
                        className="w-14 h-14 rounded-full object-cover flex-shrink-0 ring-1 ring-zinc-800 transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black flex-shrink-0 transition-transform group-hover:scale-105"
                        style={{ backgroundColor: club.primary, color: club.secondary }}>
                        {club.initials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-black text-white text-base">{club.name}</h3>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${
                          pos <= 4 ? "bg-emerald-600/20 text-emerald-400" :
                          pos === 9 ? "bg-amber-500/20 text-amber-400" :
                          pos === 10 ? "bg-red-700/20 text-red-400" :
                          "bg-zinc-800 text-zinc-400"
                        }`}>#{pos}</span>
                      </div>
                      <p className="text-zinc-500 text-xs mt-0.5">{club.full}</p>
                      <div className="flex items-center gap-1 mt-2 text-zinc-600 text-xs">
                        <MapPin className="h-3 w-3" />{club.location}
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
                    <div className="text-center">
                      <p className="text-xl font-black text-white">{pts}</p>
                      <p className="text-zinc-600 text-xs uppercase tracking-wide">Puntos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-zinc-400">{club.players.length}</p>
                      <p className="text-zinc-600 text-xs uppercase tracking-wide">Jugadores</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-zinc-400">3</p>
                      <p className="text-zinc-600 text-xs uppercase tracking-wide">Equipos</p>
                    </div>
                  </div>

                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
