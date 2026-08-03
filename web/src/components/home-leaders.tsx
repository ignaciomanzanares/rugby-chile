"use client";

import Link from "next/link";
import { useState } from "react";
import { Trophy, Zap, Target, Award } from "lucide-react";
import { useArusaPlayerStats } from "@/lib/use-arusa-player-stats";
import { clubLogo } from "@/lib/tournament";
import type { DivisionKey, DivisionPlayerStat } from "@/data/player-stats";

const TABS: { key: DivisionKey; label: string }[] = [
  { key: "PRIMERA", label: "Primera" },
  { key: "INTERMEDIA", label: "Inter" },
  { key: "PRE_INTERMEDIA", label: "Pre" },
];

const CARDS: { key: keyof DivisionPlayerStat; label: string; icon: React.ElementType; color: string; unit: string }[] = [
  { key: "points", label: "Máximo goleador", icon: Target, color: "text-blue-400", unit: "pts" },
  { key: "tries", label: "Líder en tries", icon: Zap, color: "text-emerald-400", unit: "tries" },
  { key: "mvp", label: "MVP", icon: Award, color: "text-amber-300", unit: "MVP" },
];

function PlayerLogo({ team, size }: { team: string; size: number }) {
  const logo = clubLogo(team);
  if (!logo) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logo} alt={team} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />;
}

export function HomeLeaders() {
  const [division, setDivision] = useState<DivisionKey>("PRIMERA");
  const players = useArusaPlayerStats(division);
  const label = TABS.find((t) => t.key === division)?.label ?? "Primera";

  const top3 = (key: keyof DivisionPlayerStat): DivisionPlayerStat[] =>
    (players ?? [])
      .filter((p) => (p[key] as number) > 0)
      .sort((a, b) => (b[key] as number) - (a[key] as number))
      .slice(0, 3);

  return (
    <section className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-red-500" />
          <h2 className="font-bold uppercase tracking-widest text-sm">Líderes · {label}</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Category switcher */}
          <div className="flex gap-1 rounded-lg bg-muted/40 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setDivision(t.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide transition-colors ${
                  division === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/80"
                }`}
                aria-pressed={division === t.key}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Link href="/estadisticas" className="text-xs text-muted-foreground hover:text-foreground/80 transition-colors">Ver todas →</Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {CARDS.map((c) => {
          const Icon = c.icon;
          const [first, ...rest] = top3(c.key);
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`h-4 w-4 ${c.color}`} />
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{c.label}</span>
              </div>

              {!first ? (
                <p className="text-sm text-muted-foreground py-4">Sin datos {players === null ? "· cargando…" : "aún"}</p>
              ) : (
                <>
                  {/* Leader */}
                  <Link href={`/jugador/${first.id}`} className="block group">
                    <p className="text-2xl font-black text-foreground">
                      {first[c.key] as number} <span className="text-sm text-muted-foreground font-semibold">{c.unit}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <PlayerLogo team={first.team} size={20} />
                      <p className="text-foreground/90 font-semibold text-sm truncate group-hover:text-red-400 transition-colors">{first.name}</p>
                    </div>
                    <p className="text-muted-foreground text-xs mt-0.5">{first.team} · {first.matches} PJ</p>
                  </Link>

                  {/* #2 and #3 */}
                  {rest.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                      {rest.map((p, i) => (
                        <Link key={p.id} href={`/jugador/${p.id}`} className="flex items-center gap-2 group">
                          <span className="text-[10px] font-bold text-muted-foreground/70 w-3 flex-shrink-0">{i + 2}</span>
                          <PlayerLogo team={p.team} size={16} />
                          <span className="text-xs text-foreground/80 truncate flex-1 group-hover:text-red-400 transition-colors">{p.name}</span>
                          <span className="text-xs font-bold tabular-nums text-foreground/70 flex-shrink-0">{p[c.key] as number}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
