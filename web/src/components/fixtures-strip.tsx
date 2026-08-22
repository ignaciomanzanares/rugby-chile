"use client";

import { useRef, useState } from "react";
import { Tv, ChevronLeft, ChevronRight } from "lucide-react";
import { ClubLogo } from "@/components/club-logo";
import type { DivisionKey } from "@/lib/tournament";
import { MatchDetailSheet } from "@/components/match-detail-sheet";
import { useLiveMatches, getLive } from "@/lib/use-live-matches";
import { useLeveradeResults, getLeveradeResult, type LeveradeResult } from "@/lib/use-leverade-results";
import { useFixtureResults, getFixtureResult, type FixtureResult } from "@/lib/use-fixture-results";
import { matchStatus, byKickoff, parseDateStr } from "@/lib/tournament";
import { LiveScore } from "@/components/live-score";

export interface FixtureItem {
  home: string;
  away: string;
  dateLabel: string;
  time: string;
  venue: string;
  channel?: string;
  round: number;
  division: DivisionKey;
  date: string;
}

function ClubBadge({ team }: { team: string }) {
  // Inside the fixture <button>, so navigate to the club without nesting anchors.
  return <ClubLogo team={team} stopPropagation className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-1 ring-border" />;
}

function FixtureCell({
  item,
  onSelect,
  liveMap,
  leveradeResults,
  fixtureResults,
}: {
  item: FixtureItem;
  onSelect?: (item: FixtureItem) => void;
  liveMap: ReturnType<typeof useLiveMatches>;
  leveradeResults: ReturnType<typeof useLeveradeResults>;
  fixtureResults: ReturnType<typeof useFixtureResults>;
}) {
  const { home, away, dateLabel, time, channel, division, round } = item;
  // Un partido con fecha futura nunca está en vivo/finalizado (fecha reagendada).
  const fd = parseDateStr(item.date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isFuture = fd ? fd.getTime() > today.getTime() : false;
  const live = isFuture ? undefined : getLive(liveMap, division, home, away);
  // DB /results (offline, confiable) primero; leverade de fallback.
  const lev = isFuture ? undefined : (getFixtureResult(fixtureResults, division, home, away, round)
    ?? getLeveradeResult(leveradeResults, division, home, away, round));
  const isLive = live?.status === "LIVE" || live?.status === "HT";
  const isFinished = !isFuture && (live?.status === "FINISHED" || lev?.finished || matchStatus(item) === "FINISHED");

  return (
    <button
      type="button"
      onClick={() => onSelect?.(item)}
      className={`flex-shrink-0 w-[260px] md:w-[280px] snap-start bg-card/70 border transition-all rounded-lg px-3 py-2.5 text-left cursor-pointer active:scale-[0.98] ${
        isLive
          ? "border-red-600/50 shadow-[0_0_12px_rgba(220,38,38,0.15)]"
          : "border-border hover:border-foreground/30"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold tracking-wider">
          <span className="text-foreground">{dateLabel}</span>
          {channel && (
            <>
              <span className="text-muted-foreground/70">·</span>
              <span className="inline-flex items-center gap-1 text-amber-400">
                <Tv className="h-3 w-3" /> {channel}
              </span>
            </>
          )}
        </div>
        <span className="text-sm font-black text-foreground tabular-nums">{time}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ClubBadge team={home} />
          <span className="text-xs font-semibold text-foreground truncate">{home}</span>
        </div>
        <LiveScore
          live={live}
          staticHome={lev?.homeScore}
          staticAway={lev?.awayScore}
          finished={isFinished}
        />
        <div className="flex items-center gap-2 flex-1 flex-row-reverse min-w-0">
          <ClubBadge team={away} />
          <span className="text-xs font-semibold text-foreground truncate text-right">{away}</span>
        </div>
      </div>
    </button>
  );
}

export function FixturesStrip({ round, fixtures, initialResults, initialFixtureResults }: { round: number; fixtures: FixtureItem[]; initialResults?: Record<string, LeveradeResult>; initialFixtureResults?: Record<string, FixtureResult> }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<FixtureItem | null>(null);
  const liveMap = useLiveMatches();
  const leveradeResults = useLeveradeResults(initialResults);
  const fixtureResults = useFixtureResults(initialFixtureResults);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.8, 280);
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  };

  return (
    <>
      <section className="bg-card border-b border-border">
        <div className="container mx-auto px-2 md:px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-center justify-center px-4 py-2 bg-red-600 rounded-md flex-shrink-0">
              <span className="text-[9px] font-bold tracking-widest text-red-100 uppercase leading-none">Fecha</span>
              <span className="text-xl font-black text-white leading-none">{round}</span>
            </div>
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => scrollBy(-1)}
              className="hidden md:inline-flex items-center justify-center h-9 w-9 rounded-md bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors flex-shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div
              ref={scrollerRef}
              className="flex-1 overflow-x-auto snap-x snap-mandatory scrollbar-none"
            >
              <div className="flex items-stretch gap-2 md:gap-3 pr-2">
                {[...fixtures].sort(byKickoff).map((f, i) => (
                  <FixtureCell key={i} item={f} onSelect={setSelected} liveMap={liveMap} leveradeResults={leveradeResults} fixtureResults={fixtureResults} />
                ))}
              </div>
            </div>
            <button
              type="button"
              aria-label="Siguiente"
              onClick={() => scrollBy(1)}
              className="hidden md:inline-flex items-center justify-center h-9 w-9 rounded-md bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors flex-shrink-0"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <MatchDetailSheet
        open={!!selected}
        match={
          selected
            ? (() => {
                const lev = getFixtureResult(fixtureResults, selected.division, selected.home, selected.away, selected.round)
                  ?? getLeveradeResult(leveradeResults, selected.division, selected.home, selected.away, selected.round);
                const live = getLive(liveMap, selected.division, selected.home, selected.away);
                const fin = live?.status === "FINISHED" || lev?.finished || matchStatus(selected) === "FINISHED";
                return {
                  home: selected.home,
                  away: selected.away,
                  date: selected.date,
                  time: selected.time,
                  venue: selected.venue,
                  status: fin ? "FINISHED" as const : "UPCOMING" as const,
                  homeScore: live?.homeScore ?? lev?.homeScore,
                  awayScore: live?.awayScore ?? lev?.awayScore,
                  round: selected.round,
                  division: selected.division,
                };
              })()
            : null
        }
        onClose={() => setSelected(null)}
      />
    </>
  );
}
