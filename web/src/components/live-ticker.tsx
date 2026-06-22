"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Radio } from "lucide-react";
import { useLiveMatches } from "@/lib/use-live-matches";
import { LiveMinute } from "@/lib/use-estimated-minute";

const DIVISION_LABEL: Record<string, string> = {
  PRIMERA: "Primera", INTERMEDIA: "Inter", PRE_INTERMEDIA: "Pre-Inter",
};
const divLabel = (d: string) => DIVISION_LABEL[d] ?? d;

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

const EVENT_LABELS: Record<string, string> = {
  TRY: "Try", CONVERSION: "Conversión", PENALTY: "Penal",
  DROP_GOAL: "Drop", YELLOW_CARD: "Amarilla", RED_CARD: "Roja",
};
const EVENT_COLORS: Record<string, string> = {
  TRY: "text-emerald-400", CONVERSION: "text-blue-400", PENALTY: "text-yellow-400",
  DROP_GOAL: "text-purple-400", YELLOW_CARD: "text-yellow-400", RED_CARD: "text-red-500",
};

function initials(team: string) {
  return CLUBS[team]?.initials ?? team.slice(0, 2).toUpperCase();
}

function ClubChip({ team }: { team: string }) {
  const c = CLUBS[team];
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-black flex-shrink-0"
      style={{ backgroundColor: c?.primary ?? "#374151", color: c?.secondary ?? "#fff" }}
    >
      {initials(team)}
    </span>
  );
}

interface TickerEvent {
  id: string;
  type: string;
  minute: number;
  createdAt: string;
  playerName?: string | null;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
}

/**
 * League-wide live ticker. Renders a sticky bar (under the nav) only while
 * matches are LIVE/HT: current scores plus a marquee of the most recent scoring
 * events across every live match, newest first. Pure client component driven by
 * the shared Socket.IO feed — no backend. Returns null when nothing is live.
 */
export function LiveTicker() {
  const liveByPair = useLiveMatches();

  const live = useMemo(
    () =>
      Array.from(liveByPair.values())
        .filter((m) => m.status === "LIVE" || m.status === "HT")
        .sort((a, b) => a.homeTeam.localeCompare(b.homeTeam)),
    [liveByPair],
  );

  const events = useMemo<TickerEvent[]>(() => {
    const all = live.flatMap((m) =>
      m.events.map((e) => ({
        id: e.id,
        type: e.type,
        minute: e.minute,
        createdAt: e.createdAt,
        playerName: e.playerName,
        home: m.homeTeam,
        away: m.awayTeam,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      })),
    );
    // newest first across all matches (createdAt is a real timestamp; minute
    // resets per match so it can't order across games)
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all.slice(0, 15);
  }, [live]);

  if (live.length === 0) return null;

  return (
    <div className="sticky top-20 md:top-24 z-40 border-b border-red-900/40 bg-background/95 backdrop-blur">
      <div className="container mx-auto px-3">
        <div className="flex items-center gap-3 h-10">
          {/* EN VIVO badge */}
          <Link
            href="/live"
            className="flex items-center gap-1.5 flex-shrink-0 group"
            aria-label="Ver partidos en vivo"
          >
            <Radio className="h-3.5 w-3.5 text-red-500 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest text-red-400 group-hover:text-red-300">
              En vivo
            </span>
            <span className="text-[10px] font-bold bg-red-600 text-white rounded-full px-1.5 leading-tight py-0.5">
              {live.length}
            </span>
          </Link>

          {/* current score chips */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-shrink-0 max-w-[45%] md:max-w-[38%]">
            {live.map((m) => (
              <Link
                key={m.id}
                href="/live"
                className="flex items-center gap-1.5 rounded-full bg-card border border-border hover:border-foreground/30 px-2 py-1 flex-shrink-0 transition-colors"
              >
                <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground/70 hidden md:inline">{divLabel(m.division)}</span>
                <ClubChip team={m.homeTeam} />
                <span className="text-xs font-black tabular-nums text-foreground">
                  {m.homeScore}-{m.awayScore}
                </span>
                <ClubChip team={m.awayTeam} />
                <span className="text-[10px] font-bold text-red-400 tabular-nums">
                  {m.status === "HT" ? "ET" : <LiveMinute minute={m.minute} status={m.status} />}
                </span>
              </Link>
            ))}
          </div>

          {/* events marquee (duplicated for a seamless loop) */}
          {events.length > 0 && (
            <div className="relative flex-1 overflow-hidden hidden sm:block">
              <div className="flex items-center gap-7 whitespace-nowrap animate-ticker hover:[animation-play-state:paused]">
                {[...events, ...events].map((e, i) => (
                  <span key={`${e.id}-${i}`} className="inline-flex items-center gap-1.5 text-xs">
                    <span className="font-mono text-muted-foreground/70 tabular-nums">{e.minute}&apos;</span>
                    <span className={`font-bold ${EVENT_COLORS[e.type] ?? "text-foreground/80"}`}>
                      {EVENT_LABELS[e.type] ?? e.type}
                    </span>
                    {e.playerName && <span className="text-foreground/80">{e.playerName}</span>}
                    <span className="text-muted-foreground/70">·</span>
                    <span className="text-muted-foreground">
                      {initials(e.home)} {e.homeScore}-{e.awayScore} {initials(e.away)}
                    </span>
                  </span>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
