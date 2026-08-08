"use client";

import { useMemo } from "react";
import { Zap, Target, Trophy } from "lucide-react";
import { useArusaPlayerStats } from "@/lib/use-arusa-player-stats";
import { useLeveradeStandings } from "@/lib/use-leverade-standings";
import type { Player, ClubStanding } from "@/data/clubs";
import type { StandingRow } from "@/lib/tournament";

const GRADE_LABELS = ["Primera", "Intermedia", "Pre-Intermedia"] as const;

type SummaryRow = { division: string; pos: number; pts: number; pg: number; pe: number; pp: number; pf: number; pc: number };

/** Hero position cards for all 3 grades — live arusa standings, static fallback. */
export function ClubStandingsSummary({ teamName, fallback }: { teamName: string; fallback: ClubStanding[] }) {
  const liveByLabel: Record<string, StandingRow[] | null> = {
    Primera: useLeveradeStandings("PRIMERA").rows,
    Intermedia: useLeveradeStandings("INTERMEDIA").rows,
    "Pre-Intermedia": useLeveradeStandings("PRE_INTERMEDIA").rows,
  };

  const cards: SummaryRow[] = GRADE_LABELS.map((label): SummaryRow | null => {
    const live = liveByLabel[label]?.find((r) => r.team === teamName);
    if (live) return { division: label, pos: live.pos, pts: live.pts, pg: live.pg, pe: live.pe, pp: live.pp, pf: live.pf, pc: live.pc };
    const fb = fallback.find((s) => s.division === label);
    return fb ? { division: label, pos: fb.pos, pts: fb.pts, pg: fb.pg, pe: fb.pe, pp: fb.pp, pf: fb.pf, pc: fb.pc } : null;
  }).filter((x): x is SummaryRow => x !== null);

  return (
    <div className="flex flex-wrap gap-3 mt-8">
      {cards.map((s) => {
        const isPrimera = s.division === "Primera";
        const posColor =
          s.pos <= 4 ? "text-emerald-400" :
          isPrimera && s.pos === 9 ? "text-amber-400" :
          isPrimera && s.pos === 10 ? "text-red-400" :
          "text-foreground";
        return (
          <div key={s.division} className="rounded-xl border border-border bg-card/60 px-4 py-3 min-w-36">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">{s.division}</p>
            <div className="flex items-end gap-3">
              <span className={`text-2xl font-black ${posColor}`}>#{s.pos}</span>
              <div className="text-right ml-auto">
                <p className="text-xl font-black text-foreground">{s.pts}</p>
                <p className="text-muted-foreground/70 text-xs">pts</p>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {s.pg}G{s.pe > 0 ? ` · ${s.pe}E` : ""} · {s.pp}P · {s.pf}-{s.pc}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The three highlight cards — live arusa player stats + Primera standing, static fallback. */
export function ClubHighlights({
  teamName, teamSlug, fallbackTopScorer, fallbackTopTry, fallbackPrimera,
}: {
  teamName: string;
  teamSlug: string;
  fallbackTopScorer?: Player;
  fallbackTopTry?: Player;
  fallbackPrimera?: ClubStanding;
}) {
  // Pull all 3 grades and accumulate a player's stats across them (arusa id is
  // stable), so the club's try-leader / top-scorer reflect SEASON TOTALS — a
  // player who scores in Intermedia + Pre outranks a Primera-only scorer.
  const { players: primeraStats } = useArusaPlayerStats("PRIMERA");
  const { players: interStats } = useArusaPlayerStats("INTERMEDIA");
  const { players: preStats } = useArusaPlayerStats("PRE_INTERMEDIA");

  const clubPlayers = useMemo(() => {
    const all = [primeraStats, interStats, preStats].flatMap((g) => g ?? []);
    const inClub = all.filter((p) => (p as { teamSlug?: string }).teamSlug === teamSlug);
    if (inClub.length === 0) return null;
    const byId = new Map<string, Player>();
    for (const p of inClub as unknown as Player[]) {
      const cur = byId.get(p.id);
      if (cur) {
        cur.matches += p.matches; cur.points += p.points; cur.tries += p.tries;
        cur.penaltyTries += p.penaltyTries; cur.conversions += p.conversions;
        cur.penalties += p.penalties; cur.drops += p.drops;
        cur.yellowCards += p.yellowCards; cur.redCards += p.redCards; cur.mvp += p.mvp;
      } else {
        byId.set(p.id, { ...p });
      }
    }
    return [...byId.values()];
  }, [primeraStats, interStats, preStats, teamSlug]);

  const topScorer = clubPlayers && clubPlayers.length
    ? [...clubPlayers].sort((a, b) => b.points - a.points)[0]
    : fallbackTopScorer;
  const topTry = clubPlayers && clubPlayers.length
    ? [...clubPlayers].filter((p) => p.tries > 0).sort((a, b) => b.tries - a.tries)[0]
    : fallbackTopTry;

  const live = useLeveradeStandings("PRIMERA").rows?.find((r) => r.team === teamName);
  const primera = live ?? fallbackPrimera;

  return (
    <section className="grid sm:grid-cols-3 gap-4">
      {topTry && (
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Líder en tries</span>
          </div>
          <p className="text-2xl font-black text-foreground">{topTry.tries}</p>
          <p className="text-foreground/80 font-semibold text-sm mt-1">{topTry.name}</p>
          <p className="text-muted-foreground text-xs mt-0.5">{topTry.matches} partidos jugados</p>
        </div>
      )}
      {topScorer && (
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Máximo goleador</span>
          </div>
          <p className="text-2xl font-black text-foreground">{topScorer.points} pts</p>
          <p className="text-foreground/80 font-semibold text-sm mt-1">{topScorer.name}</p>
          <p className="text-muted-foreground text-xs mt-0.5">{topScorer.tries}T · {topScorer.conversions}C · {topScorer.penalties}P</p>
        </div>
      )}
      {primera && (
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-red-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Primera</span>
          </div>
          <p className={`text-2xl font-black ${primera.pos <= 4 ? "text-emerald-400" : primera.pos >= 9 ? "text-red-400" : "text-foreground"}`}>
            #{primera.pos} · {primera.pts} pts
          </p>
          <p className="text-foreground/80 font-semibold text-sm mt-1">{primera.pg}G{primera.pe > 0 ? ` · ${primera.pe}E` : ""} · {primera.pp}P</p>
          <p className="text-muted-foreground text-xs mt-0.5">{primera.pf} pts a favor · {primera.pc} en contra</p>
        </div>
      )}
    </section>
  );
}
