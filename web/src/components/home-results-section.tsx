"use client";

import { useState } from "react";
import { CheckCircle, ChevronRight } from "lucide-react";
import { clubLogo, type RoundMatch } from "@/lib/tournament";
import { useLeveradeResults, getLeveradeResult, type LeveradeResult } from "@/lib/use-leverade-results";
import { MatchDetailSheet } from "@/components/match-detail-sheet";

const CLUBS: Record<string, { primary: string; secondary: string; initials: string }> = {
  COBS:             { primary: "#1a3a6b", secondary: "#c9a227", initials: "CO" },
  "Old Boys":       { primary: "#cc0000", secondary: "#ffffff", initials: "OB" },
  PWCC:             { primary: "#003087", secondary: "#FFB81C", initials: "PW" },
  "Old Macks":      { primary: "#b91c1c", secondary: "#ffffff", initials: "OM" },
  "Stade Francais": { primary: "#1a237e", secondary: "#e8102a", initials: "SF" },
  "Sporting RC":    { primary: "#15803d", secondary: "#ffffff", initials: "SP" },
  DOBS:             { primary: "#0369a1", secondary: "#fbbf24", initials: "DO" },
  UC:               { primary: "#1e3a8a", secondary: "#fbbf24", initials: "UC" },
  "Old Johns":      { primary: "#1d4ed8", secondary: "#fef08a", initials: "OJ" },
  "Old Reds":       { primary: "#9f1239", secondary: "#fca5a5", initials: "OR" },
};

function ClubBadge({ team, size = "md" }: { team: string; size?: "sm" | "md" }) {
  const c = CLUBS[team] ?? { primary: "#374151", secondary: "#fff", initials: team.slice(0, 2).toUpperCase() };
  const dim = size === "md" ? "w-9 h-9 text-sm" : "w-7 h-7 text-xs";
  const logo = clubLogo(team);
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt={team} className={`${dim} rounded-full flex-shrink-0 object-cover ring-1 ring-border`} />;
  }
  return (
    <span className={`${dim} rounded-full inline-flex items-center justify-center font-bold flex-shrink-0`}
      style={{ backgroundColor: c.primary, color: c.secondary }}>
      {c.initials}
    </span>
  );
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
        {matches.map((r, i) => {
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
