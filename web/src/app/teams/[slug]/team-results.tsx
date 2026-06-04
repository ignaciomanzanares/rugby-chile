"use client";

import { CheckCircle } from "lucide-react";
import { clubLogo, type RoundMatch } from "@/lib/tournament";
import { useLeveradeResults, getLeveradeResult } from "@/lib/use-leverade-results";

type Props = {
  teamName: string;
  results: { round: number; match: RoundMatch }[];
};

export function TeamResults({ teamName, results }: Props) {
  const leveradeResults = useLeveradeResults();

  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <CheckCircle className="h-4 w-4 text-emerald-500" />
        <h2 className="font-bold uppercase tracking-widest text-sm">Últimos resultados · Primera</h2>
      </div>
      <div className="space-y-2">
        {results.map(({ round, match }, i) => {
          const lev = getLeveradeResult(leveradeResults, "PRIMERA", match.home, match.away, round);
          const isHome = match.home === teamName;
          const ourScore = isHome ? lev?.homeScore : lev?.awayScore;
          const theirScore = isHome ? lev?.awayScore : lev?.homeScore;
          const hasScore = ourScore !== undefined && theirScore !== undefined;
          const result = !hasScore ? "?" : ourScore > theirScore ? "W" : ourScore < theirScore ? "L" : "D";
          const opponent = isHome ? match.away : match.home;
          const opLogo = clubLogo(opponent);
          return (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-black flex-shrink-0 ${
                  result === "W" ? "bg-emerald-600 text-white" :
                  result === "L" ? "bg-red-700 text-white" :
                  result === "D" ? "bg-zinc-700 text-white" :
                  "bg-zinc-800 text-zinc-500"
                }`}>{result}</span>
                <span className="text-zinc-500 text-xs font-bold tracking-wider uppercase w-14 flex-shrink-0">F{round}</span>
                <span className="text-zinc-500 text-xs flex-shrink-0">{isHome ? "vs" : "@"}</span>
                {opLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={opLogo} alt={opponent} className="w-7 h-7 rounded-full object-cover ring-1 ring-zinc-800 flex-shrink-0" />
                )}
                <span className="flex-1 font-semibold text-sm">{opponent}</span>
                {hasScore ? (
                  <span className="font-black text-lg tabular-nums">
                    {ourScore}<span className="text-zinc-700 mx-1">-</span>{theirScore}
                  </span>
                ) : (
                  <span className="text-zinc-600 text-sm">–</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
