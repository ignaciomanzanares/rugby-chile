import Link from "next/link";
import { MapPin, Trophy, Users } from "lucide-react";
import { clubs } from "@/data/clubs";

export default function TeamsPage() {
  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-2xl font-black uppercase tracking-wide">Equipos</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Los 10 clubes · 3 divisiones cada uno</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {clubs.map((club) => {
          const primera = club.standings.find((s) => s.division === "Primera XV");
          return (
            <div key={club.slug} className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              {/* Color bar */}
              <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${club.primary}, ${club.secondary})` }} />

              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-black text-base flex-shrink-0"
                    style={{ backgroundColor: club.primary, color: club.secondary }}
                  >
                    {club.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-black text-white">{club.name}</h3>
                      {primera && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${
                          primera.pos <= 4 ? "bg-emerald-600/20 text-emerald-400" :
                          primera.pos >= 9 ? "bg-red-700/20 text-red-400" :
                          "bg-zinc-800 text-zinc-400"
                        }`}>
                          #{primera.pos}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-xs mt-0.5">{club.full}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {club.location} · {club.venue}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5" />
                    {primera
                      ? `1ª XV: #${primera.pos} · ${primera.pts}pts · ${primera.pg}G ${primera.pp}P`
                      : "Sin datos"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> {club.players.length} jugadores registrados
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/teams/${club.slug}`}
                    className="flex-1 text-center py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors"
                  >
                    Ver perfil
                  </Link>
                  <button className="flex-1 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors">
                    Editar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
