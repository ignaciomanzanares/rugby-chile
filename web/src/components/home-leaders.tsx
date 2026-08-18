"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Trophy, Zap, Target, Award } from "lucide-react";
import { useArusaPlayerStats } from "@/lib/use-arusa-player-stats";
import { useLivePlayerStats } from "@/lib/use-live-player-stats";
import { useLiveMatches } from "@/lib/use-live-matches";
import { mergeLiveStats, type MergedStat } from "@/lib/merge-live-stats";
import { ClubLogo } from "@/components/club-logo";
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
  const cls = size >= 20 ? "w-5 h-5" : "w-4 h-4";
  // Inside a player <Link>, so navigate to the club without nesting anchors.
  return <ClubLogo team={team} stopPropagation className={`${cls} rounded-full object-cover flex-shrink-0`} />;
}

// Skeleton mientras carga (Render frío): mismo layout que un card de líder
// —número grande + fila del líder + dos filas— para no mostrar texto pelado.
function LeaderSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-16 rounded bg-muted/60" />
      <div className="flex items-center gap-2 mt-2">
        <span className="w-5 h-5 rounded-full bg-muted/60 flex-shrink-0" />
        <span className="h-4 flex-1 max-w-[70%] rounded bg-muted/50" />
      </div>
      <div className="h-3 w-24 rounded bg-muted/40 mt-1.5" />
      <div className="mt-3 pt-3 border-t border-border space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-muted/60 flex-shrink-0" />
            <span className="h-3 flex-1 rounded bg-muted/40" />
            <span className="h-3 w-5 rounded bg-muted/40 flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Punto rojo pulsante: el líder se está moviendo con eventos en vivo.
function LiveDot() {
  return <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse ml-1.5 align-middle" aria-label="actualizándose en vivo" />;
}

// Enlaza al jugador salvo que sea una fila live-only (id "live-…", un anotador
// que aún no está en el baseline de arusa): esos no tienen ficha, así que van
// sin enlace en vez de a un 404.
function PlayerLink({ id, className, children }: { id: string | number; className?: string; children: React.ReactNode }) {
  const isLiveOnly = String(id).startsWith("live-");
  if (isLiveOnly) return <div className={className}>{children}</div>;
  return <Link href={`/jugador/${id}`} className={className}>{children}</Link>;
}

export function HomeLeaders() {
  const [division, setDivision] = useState<DivisionKey>("PRIMERA");
  const { players, loading } = useArusaPlayerStats(division);
  const { players: livePlayers, refresh } = useLivePlayerStats(division);
  const liveByPair = useLiveMatches();
  const label = TABS.find((t) => t.key === division)?.label ?? "Primera";

  // Re-traer los stats en vivo apenas cae un evento o termina un partido, así
  // goleador/tries/tarjetas se mueven en tiempo real durante los partidos.
  const liveSignal = useMemo(() => {
    const ms = Array.from(liveByPair.values());
    const events = ms.reduce((n, m) => n + m.events.length, 0);
    const finished = ms.filter((m) => m.status === "FINISHED").length;
    return `${events}|${finished}`;
  }, [liveByPair]);
  useEffect(() => { refresh(); }, [liveSignal, refresh]);

  // Base: stats de temporada de arusa; encima se suman los eventos en vivo.
  const pool: MergedStat[] = useMemo(
    () => mergeLiveStats(players ?? [], livePlayers),
    [players, livePlayers],
  );

  const top3 = (key: keyof DivisionPlayerStat): MergedStat[] =>
    pool
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
                loading ? (
                  <LeaderSkeleton />
                ) : (
                  <p className="text-sm text-muted-foreground py-4">Sin datos aún</p>
                )
              ) : (
                <>
                  {/* Leader */}
                  <PlayerLink id={first.id} className="block group">
                    <p className="text-2xl font-black text-foreground">
                      {first[c.key] as number} <span className="text-sm text-muted-foreground font-semibold">{c.unit}</span>
                      {first.live && <LiveDot />}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <PlayerLogo team={first.team} size={20} />
                      <p className="text-foreground/90 font-semibold text-sm truncate group-hover:text-red-400 transition-colors">{first.name}</p>
                    </div>
                    <p className="text-muted-foreground text-xs mt-0.5">{first.team} · {first.matches} PJ</p>
                  </PlayerLink>

                  {/* #2 and #3 */}
                  {rest.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                      {rest.map((p, i) => (
                        <PlayerLink key={p.id} id={p.id} className="flex items-center gap-2 group">
                          <span className="text-[10px] font-bold text-muted-foreground/70 w-3 flex-shrink-0">{i + 2}</span>
                          <PlayerLogo team={p.team} size={16} />
                          <span className="text-xs text-foreground/80 truncate flex-1 group-hover:text-red-400 transition-colors">{p.name}</span>
                          {p.live && <LiveDot />}
                          <span className="text-xs font-bold tabular-nums text-foreground/70 flex-shrink-0">{p[c.key] as number}</span>
                        </PlayerLink>
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
