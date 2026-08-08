"use client";

import Link from "next/link";
import { Trophy, ArrowRight, Radio } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { STANDINGS, type StandingRow, type DivisionKey } from "@/lib/tournament";
import { ClubLogo } from "@/components/club-logo";
import { useLeveradeStandings } from "@/lib/use-leverade-standings";
import { useLiveMatches, type LiveMatch } from "@/lib/use-live-matches";

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

const DIVISION_TABS: { key: DivisionKey; label: string }[] = [
  { key: "PRIMERA", label: "Primera" },
  { key: "INTERMEDIA", label: "Inter" },
  { key: "PRE_INTERMEDIA", label: "Pre" },
];

function ClubBadge({ team }: { team: string }) {
  return <ClubLogo team={team} className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-1 ring-border" wrapperClassName="flex-shrink-0" />;
}

// Mirror the live-overlay logic from the standings page so the home widget
// keeps moving while a match is on. win=4, draw=2, +1 try bonus (4+), +1 losing
// bonus (≤7).
function applyLiveOverlay(base: StandingRow[], lives: LiveMatch[]): StandingRow[] {
  if (lives.length === 0) return base;
  const byTeam = new Map(base.map((r) => [r.team, { ...r }]));
  for (const lm of lives) {
    if (lm.status !== "LIVE" && lm.status !== "HT") continue;
    const home = byTeam.get(lm.homeTeam);
    const away = byTeam.get(lm.awayTeam);
    if (!home || !away) continue;

    home.pj += 1; away.pj += 1;
    home.pf += lm.homeScore; home.pc += lm.awayScore;
    away.pf += lm.awayScore; away.pc += lm.homeScore;

    const homeWin = lm.homeScore > lm.awayScore;
    const draw = lm.homeScore === lm.awayScore;
    if (draw) { home.pe += 1; away.pe += 1; }
    else if (homeWin) { home.pg += 1; away.pp += 1; }
    else { away.pg += 1; home.pp += 1; }

    let homePts = draw ? 2 : homeWin ? 4 : 0;
    let awayPts = draw ? 2 : homeWin ? 0 : 4;
    if (lm.homeTries >= 4) homePts += 1;
    if (lm.awayTries >= 4) awayPts += 1;
    if (!draw && !homeWin && lm.awayScore - lm.homeScore <= 7) homePts += 1;
    if (!draw && homeWin && lm.homeScore - lm.awayScore <= 7) awayPts += 1;

    home.pts += homePts;
    away.pts += awayPts;
    home.diff = home.pf - home.pc;
    away.diff = away.pf - away.pc;
  }

  return [...byTeam.values()]
    .sort((a, b) => (b.pts !== a.pts ? b.pts - a.pts : b.diff !== a.diff ? b.diff - a.diff : b.pf - a.pf))
    .map((r, i) => ({ ...r, pos: i + 1 }));
}

function liveDivisionKey(raw: string): DivisionKey {
  const s = raw.toLowerCase();
  if (s.includes("pre")) return "PRE_INTERMEDIA";
  if (s.includes("intermedia")) return "INTERMEDIA";
  return "PRIMERA";
}

// Table body for a single division. Mounted with a `key={division}` so switching
// tabs remounts it — the standings hook then starts clean instead of briefly
// showing the previous division's rows.
function DivisionTable({
  division,
  initialRows,
  onLive,
}: {
  division: DivisionKey;
  initialRows?: StandingRow[] | null;
  onLive: (n: number) => void;
}) {
  const { rows: leveradeRows } = useLeveradeStandings(division, initialRows);
  const liveByPair = useLiveMatches();

  const live = useMemo(
    () => Array.from(liveByPair.values()).filter(
      (m) => liveDivisionKey(m.division) === division &&
             (m.status === "LIVE" || m.status === "HT"),
    ),
    [liveByPair, division],
  );

  // Surface the live count to the header (badge) without lifting the hooks up.
  const liveCount = live.length;
  useEffect(() => onLive(liveCount), [liveCount, onLive]);

  const base = leveradeRows ?? STANDINGS[division];
  const rows = useMemo(() => applyLiveOverlay(base, live), [base, live]);

  // Mientras no llega la fuente real (leverade), no pintamos el snapshot
  // estático (baseline Fecha 4 / PJ4): ese es el "flash de datos viejos" que se
  // veía al abrir la home o cambiar de tab. Skeleton hasta tener datos reales.
  if (leveradeRows == null) {
    return (
      <div className="rounded-xl border border-border overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 ${i % 2 === 0 ? "bg-card/30" : ""}`}
          >
            <span className="w-6 h-6 rounded bg-muted/60 animate-pulse flex-shrink-0" />
            <span className="w-7 h-7 rounded-full bg-muted/60 animate-pulse flex-shrink-0" />
            <span className="flex-1 h-4 rounded bg-muted/50 animate-pulse" />
            <span className="w-8 h-4 rounded bg-muted/50 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {rows.map((row, i) => {
        const c = CLUBS[row.team];
        const isTop4 = row.pos <= 4;
        const isRepechaje = row.pos === 9;
        const isDescenso = row.pos === 10;
        const isLive = live.some((m) => m.homeTeam === row.team || m.awayTeam === row.team);
        return (
          <div
            key={row.team}
            className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 ${i % 2 === 0 ? "bg-card/30" : ""}`}
            style={{ borderLeft: `3px solid ${c?.primary ?? "#374151"}` }}
          >
            <span className={`w-6 h-6 rounded text-xs font-bold inline-flex items-center justify-center flex-shrink-0 ${isTop4 ? "bg-emerald-600 text-white" : isRepechaje ? "bg-amber-500 text-zinc-950" : isDescenso ? "bg-red-700 text-white" : "bg-muted text-muted-foreground"}`}>
              {row.pos}
            </span>
            <ClubBadge team={row.team} />
            <span className="flex-1 font-medium text-sm flex items-center gap-1.5">
              {row.team}
              {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
            </span>
            <span className="text-muted-foreground text-xs">{row.pj}PJ</span>
            <span className="font-black text-foreground w-8 text-right">{row.pts}</span>
          </div>
        );
      })}
    </div>
  );
}

export function HomeStandingsPreview({ initialRows }: { initialRows?: StandingRow[] | null }) {
  const [division, setDivision] = useState<DivisionKey>("PRIMERA");
  const [liveCount, setLiveCount] = useState(0);

  const label = DIVISION_TABS.find((t) => t.key === division)?.label ?? "Primera";

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-red-500" />
          <h2 className="font-bold uppercase tracking-widest text-sm">Tabla · {label}</h2>
          {liveCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase tracking-wider">
              <Radio className="h-3 w-3 animate-pulse" /> En vivo
            </span>
          )}
        </div>
        <Link href="/standings" className="text-xs text-muted-foreground hover:text-foreground/80 flex items-center gap-1 transition-colors">
          Ver todo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Category switcher */}
      <div className="flex gap-1 mb-3 rounded-lg bg-muted/40 p-1">
        {DIVISION_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setDivision(t.key)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              division === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground/80"
            }`}
            aria-pressed={division === t.key}
          >
            {t.label}
          </button>
        ))}
      </div>

      <DivisionTable
        key={division}
        division={division}
        initialRows={division === "PRIMERA" ? initialRows : undefined}
        onLive={setLiveCount}
      />

      <Link href="/standings" className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 text-xs font-semibold uppercase tracking-wide transition-colors">
        Tabla completa <ArrowRight className="h-3 w-3" />
      </Link>
    </section>
  );
}
