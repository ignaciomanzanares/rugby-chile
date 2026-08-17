"use client";

import { useState } from "react";
import { CheckCircle, ChevronRight } from "lucide-react";
import { byKickoff, type RoundMatch } from "@/lib/tournament";
import { ClubLogo } from "@/components/club-logo";
import { useLeveradeResults, getLeveradeResult, type LeveradeResult } from "@/lib/use-leverade-results";
import { MatchDetailSheet } from "@/components/match-detail-sheet";

function ClubBadge({ team, size = "md" }: { team: string; size?: "sm" | "md" }) {
  const dim = size === "md" ? "w-9 h-9" : "w-7 h-7";
  // Inside the match <button>, so navigate to the club without nesting anchors.
  return <ClubLogo team={team} stopPropagation className={`${dim} rounded-full flex-shrink-0 object-cover ring-1 ring-border`} />;
}

type Props = { round: number; matches: RoundMatch[]; initialResults?: Record<string, LeveradeResult> };

export function HomeResultsSection({ round, matches, initialResults }: Props) {
  const leveradeResults = useLeveradeResults(initialResults);
  const [selected, setSelected] = useState<RoundMatch | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <h2 className="font-bold uppercase tracking-widest text-sm">Fecha {round} · Resultados</h2>
        </div>
      </div>
      <div className="space-y-2">
        {[...matches].sort(byKickoff).map((r, i) => {
          const lev = getLeveradeResult(leveradeResults, "PRIMERA", r.home, r.away, round);
          const homeScore = lev?.homeScore;
          const awayScore = lev?.awayScore;
          const hasScore = homeScore !== undefined && awayScore !== undefined;
          const homeWon = hasScore && homeScore > awayScore;
          const draw = hasScore && homeScore === awayScore;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(r)}
              className="w-full text-left rounded-xl border border-border bg-card/50 px-4 py-3 hover:border-foreground/30 active:scale-[0.99] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <ClubBadge team={r.home} />
                  <span className={`font-semibold text-sm ${!hasScore || homeWon || draw ? "text-foreground" : "text-muted-foreground"}`}>
                    {r.home}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {hasScore ? (
                    <>
                      <span className={`text-xl font-black tabular-nums ${homeWon || draw ? "text-foreground" : "text-muted-foreground"}`}>{homeScore}</span>
                      <span className="text-muted-foreground/50 text-sm">—</span>
                      <span className={`text-xl font-black tabular-nums ${!homeWon || draw ? "text-foreground" : "text-muted-foreground"}`}>{awayScore}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/70 text-sm font-medium px-2">Finalizado</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-1 flex-row-reverse">
                  <ClubBadge team={r.away} />
                  <span className={`font-semibold text-sm text-right ${!hasScore || !homeWon || draw ? "text-foreground" : "text-muted-foreground"}`}>
                    {r.away}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      <MatchDetailSheet
        open={!!selected}
        match={
          selected
            ? (() => {
                const lev = getLeveradeResult(leveradeResults, "PRIMERA", selected.home, selected.away, round);
                return {
                  home: selected.home,
                  away: selected.away,
                  date: selected.date,
                  time: selected.time,
                  venue: selected.venue,
                  status: "FINISHED" as const,
                  homeScore: lev?.homeScore,
                  awayScore: lev?.awayScore,
                  round,
                  division: "PRIMERA" as const,
                };
              })()
            : null
        }
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
