"use client";

import Link from "next/link";
import { Trophy, Zap, Target, Award } from "lucide-react";
import { useArusaPlayerStats } from "@/lib/use-arusa-player-stats";
import { clubLogo } from "@/lib/tournament";
import type { DivisionPlayerStat } from "@/data/player-stats";

export function HomeLeaders() {
  const players = useArusaPlayerStats("PRIMERA");
  if (!players || players.length === 0) return null;

  const top = (key: keyof DivisionPlayerStat) =>
    [...players].filter((p) => (p[key] as number) > 0).sort((a, b) => (b[key] as number) - (a[key] as number))[0];

  const cards = [
    { label: "Máximo goleador", icon: Target, color: "text-blue-400", p: top("points"), val: (x: DivisionPlayerStat) => x.points, unit: "pts" },
    { label: "Líder en tries", icon: Zap, color: "text-emerald-400", p: top("tries"), val: (x: DivisionPlayerStat) => x.tries, unit: "tries" },
    { label: "MVP", icon: Award, color: "text-amber-300", p: top("mvp"), val: (x: DivisionPlayerStat) => x.mvp, unit: "MVP" },
  ].filter((c) => c.p);

  if (cards.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-red-500" />
          <h2 className="font-bold uppercase tracking-widest text-sm">Líderes · Primera</h2>
        </div>
        <Link href="/estadisticas" className="text-xs text-muted-foreground hover:text-foreground/80 transition-colors">Ver todas →</Link>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          const p = c.p!;
          const logo = clubLogo(p.team);
          return (
            <Link
              key={c.label}
              href={`/jugador/${p.id}`}
              className="rounded-xl border border-border bg-card/50 p-5 hover:border-foreground/30 transition-colors block"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`h-4 w-4 ${c.color}`} />
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{c.label}</span>
              </div>
              <p className="text-2xl font-black text-foreground">
                {c.val(p)} <span className="text-sm text-muted-foreground font-semibold">{c.unit}</span>
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                {logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={p.team} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                )}
                <p className="text-foreground/80 font-semibold text-sm truncate">{p.name}</p>
              </div>
              <p className="text-muted-foreground text-xs mt-0.5">{p.team} · {p.matches} PJ</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
