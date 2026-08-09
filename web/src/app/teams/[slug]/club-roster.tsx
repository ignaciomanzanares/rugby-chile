"use client";

import { useMemo } from "react";
import { Trophy } from "lucide-react";
import type { Player } from "@/data/clubs";
import { useClubPlayers } from "@/lib/use-club-players";

const NUM_FIELDS: (keyof Player)[] = [
  "matches", "points", "tries", "penaltyTries", "conversions",
  "penalties", "drops", "yellowCards", "redCards", "mvp",
];

/** Plantel del club EN VIVO (suma los 3 grados por jugador). Skeleton mientras
 *  carga; el estático (fallback) solo si el fetch ya resolvió y falló. */
export function ClubRoster({ teamSlug, fallback }: { teamSlug: string; fallback: Player[] }) {
  const { players: live, loading } = useClubPlayers(teamSlug);

  const roster = useMemo(() => {
    const src = live ?? (loading ? [] : fallback.map((p) => ({ ...p, grade: "Primera" })));
    const byId = new Map<string, Player>();
    for (const p of src) {
      const cur = byId.get(p.id);
      if (cur) { for (const f of NUM_FIELDS) (cur[f] as number) += p[f] as number; }
      else byId.set(p.id, { ...p });
    }
    return [...byId.values()]
      .filter((p) => p.matches > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [live, loading, fallback]);

  const showSkeleton = loading && !live;

  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <Trophy className="h-4 w-4 text-red-500" />
        <h2 className="font-bold uppercase tracking-widest text-sm">
          Plantel{showSkeleton ? "" : ` · ${roster.length} jugadores`}
        </h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {showSkeleton
          ? Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
                <span className="block h-4 w-24 rounded bg-muted/50 animate-pulse" />
                <span className="block h-3 w-16 rounded bg-muted/40 animate-pulse mt-1.5" />
              </div>
            ))
          : roster.map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-card/40 px-3 py-2.5 hover:border-border transition-colors">
                <p className="text-sm font-semibold text-foreground truncate" title={p.name}>{p.name}</p>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <span>{p.matches} PJ</span>
                  {p.points > 0 && <><span className="text-muted-foreground/50">·</span><span>{p.points} pts</span></>}
                  {p.tries > 0 && <><span className="text-muted-foreground/50">·</span><span className="text-emerald-500">{p.tries}T</span></>}
                  {p.yellowCards > 0 && (
                    <span className="inline-block w-2.5 h-3.5 rounded-[2px] bg-yellow-400 ml-1" title={`${p.yellowCards} amarilla(s)`} />
                  )}
                  {p.redCards > 0 && (
                    <span className="inline-block w-2.5 h-3.5 rounded-[2px] bg-red-500" title={`${p.redCards} roja(s)`} />
                  )}
                </div>
              </div>
            ))}
      </div>
    </section>
  );
}
