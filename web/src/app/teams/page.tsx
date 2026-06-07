"use client";

import Link from "next/link";
import { Trophy, MapPin } from "lucide-react";
import { clubs } from "@/data/clubs";
import { clubLogo } from "@/lib/tournament";
import { useLeveradeStandings } from "@/lib/use-leverade-standings";

export default function TeamsPage() {
  // Live Primera standings drive each card's position + points (static fallback).
  const { rows: live } = useLeveradeStandings("PRIMERA");

  const cards = clubs
    .map((club) => {
      const liveRow = live?.find((r) => r.team === club.name);
      const staticPrimera = club.standings.find((s) => s.division === "Primera");
      return {
        club,
        pos: liveRow?.pos ?? staticPrimera?.pos ?? 0,
        pts: liveRow?.pts ?? staticPrimera?.pts ?? 0,
      };
    })
    .sort((a, b) => (a.pos || 99) - (b.pos || 99));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-1">
            <Trophy className="h-5 w-5 text-red-500" />
            <h1 className="text-2xl font-black uppercase tracking-widest">Los 10 Clubes</h1>
          </div>
          <p className="text-muted-foreground text-sm">Primera División · Cada club compite en 3 divisiones</p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">

        {/* Clubs grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map(({ club, pos, pts }) => {
            const logo = clubLogo(club.name);

            return (
              <Link
                key={club.slug}
                href={`/teams/${club.slug}`}
                className="rounded-xl border border-border bg-card/50 overflow-hidden hover:border-foreground/30 transition-colors group block"
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
                        className="w-14 h-14 rounded-full object-cover flex-shrink-0 ring-1 ring-border transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black flex-shrink-0 transition-transform group-hover:scale-105"
                        style={{ backgroundColor: club.primary, color: club.secondary }}>
                        {club.initials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-black text-foreground text-base">{club.name}</h3>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${
                          pos <= 4 ? "bg-emerald-600/20 text-emerald-400" :
                          pos === 9 ? "bg-amber-500/20 text-amber-400" :
                          pos === 10 ? "bg-red-700/20 text-red-400" :
                          "bg-muted text-muted-foreground"
                        }`}>#{pos}</span>
                      </div>
                      <p className="text-muted-foreground text-xs mt-0.5">{club.full}</p>
                      <div className="flex items-center gap-1 mt-2 text-muted-foreground/70 text-xs">
                        <MapPin className="h-3 w-3" />{club.location}
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <div className="text-center">
                      <p className="text-xl font-black text-foreground">{pts}</p>
                      <p className="text-muted-foreground/70 text-xs uppercase tracking-wide">Puntos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-muted-foreground">{club.players.length}</p>
                      <p className="text-muted-foreground/70 text-xs uppercase tracking-wide">Jugadores</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-muted-foreground">3</p>
                      <p className="text-muted-foreground/70 text-xs uppercase tracking-wide">Equipos</p>
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
