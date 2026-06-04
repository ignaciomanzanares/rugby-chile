"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, ArrowRight, ChevronRight } from "lucide-react";
import { clubLogo, type DivisionKey } from "@/lib/tournament";
import { MatchDetailSheet } from "@/components/match-detail-sheet";
import { useLiveMatches, getLive } from "@/lib/use-live-matches";
import { useLeveradeResults, getLeveradeResult } from "@/lib/use-leverade-results";
import { matchStatus } from "@/lib/tournament";
import { LiveScore } from "@/components/live-score";

const CLUBS: Record<string, { primary: string }> = {
  COBS:             { primary: "#1a3a6b" },
  "Old Boys":       { primary: "#cc0000" },
  PWCC:             { primary: "#003087" },
  "Old Macks":      { primary: "#b91c1c" },
  "Stade Francais": { primary: "#1a237e" },
  "Sporting RC":    { primary: "#15803d" },
  DOBS:             { primary: "#0369a1" },
  UC:               { primary: "#1e3a8a" },
  "Old Johns":      { primary: "#1d4ed8" },
  "Old Reds":       { primary: "#9f1239" },
};

function ClubBadge({ team }: { team: string }) {
  const logo = clubLogo(team);
  const c = CLUBS[team];
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt={team} className="w-9 h-9 rounded-full flex-shrink-0 object-cover ring-1 ring-zinc-800" />;
  }
  return (
    <div
      className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
      style={{ backgroundColor: c?.primary ?? "#374151" }}
    >
      {team.slice(0, 2).toUpperCase()}
    </div>
  );
}

type MatchRow = {
  home: string;
  away: string;
  date: string;
  time: string;
  venue: string;
};

type Props = {
  round: number;
  matches: MatchRow[];
  division: DivisionKey;
};

export function HomeMatchesSection({ round, matches, division }: Props) {
  const [selected, setSelected] = useState<(MatchRow & { round: number; division: DivisionKey }) | null>(null);
  const liveMap = useLiveMatches();
  const leveradeResults = useLeveradeResults();

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-red-500" />
          <h2 className="font-bold uppercase tracking-widest text-sm">Fecha {round} · Próxima</h2>
        </div>
        <Link href="/schedule" className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
          Ver todo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {matches.map((f, i) => {
          const hc = CLUBS[f.home];
          const live = getLive(liveMap, f.home, f.away);
          const lev = getLeveradeResult(leveradeResults, division, f.home, f.away, round);
          const isLive = live?.status === "LIVE" || live?.status === "HT";
          const isFinished = live?.status === "FINISHED" || lev?.finished || matchStatus(f) === "FINISHED";
          return (
            <button
              key={i}
              onClick={() => setSelected({ ...f, round, division })}
              className={`w-full text-left rounded-xl border bg-zinc-900/50 overflow-hidden active:scale-[0.99] transition-all cursor-pointer ${
                isLive
                  ? "border-red-600/50 shadow-[0_0_12px_rgba(220,38,38,0.1)]"
                  : "border-zinc-800 hover:border-zinc-600"
              }`}
            >
              <div className="flex items-stretch">
                <div className="w-1 flex-shrink-0" style={{ backgroundColor: hc?.primary ?? "#374151" }} />
                <div className="flex-1 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <ClubBadge team={f.home} />
                      <span className="font-semibold text-sm text-white">{f.home}</span>
                    </div>
                    <LiveScore
                      live={live}
                      staticHome={lev?.homeScore}
                      staticAway={lev?.awayScore}
                      finished={isFinished}
                    />
                    <div className="flex items-center gap-2 flex-1 flex-row-reverse">
                      <ClubBadge team={f.away} />
                      <span className="font-semibold text-sm text-right text-white">{f.away}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-700 flex-shrink-0" />
                  </div>
                  <p className="text-zinc-500 text-xs mt-1.5">{f.date} · {f.time} · {f.venue}</p>
                </div>
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
                const lev = getLeveradeResult(leveradeResults, division, selected.home, selected.away, selected.round);
                const live = getLive(liveMap, selected.home, selected.away);
                const fin = live?.status === "FINISHED" || lev?.finished || matchStatus(selected) === "FINISHED";
                return {
                  ...selected,
                  status: fin ? "FINISHED" as const : "UPCOMING" as const,
                  homeScore: live?.homeScore ?? lev?.homeScore,
                  awayScore: live?.awayScore ?? lev?.awayScore,
                };
              })()
            : null
        }
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
