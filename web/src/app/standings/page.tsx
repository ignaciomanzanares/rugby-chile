"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Radio, Trophy } from "lucide-react";
import { DIVISIONS, STANDINGS, clubLogo, type DivisionKey, type StandingRow } from "@/lib/tournament";
import { useLeveradeStandings } from "@/lib/use-leverade-standings";
import { useComputedStandings } from "@/lib/use-computed-standings";
import { useLeveradeResults } from "@/lib/use-leverade-results";
import { useTeamForm, type TeamForm } from "@/lib/use-team-form";
import { useVenueStandings } from "@/lib/use-venue-standings";
import { useLiveMatches, type LiveMatch } from "@/lib/use-live-matches";
import { FormPills } from "@/components/form-pills";

const CLUBS: Record<string, { full: string; primary: string; secondary: string; initials: string }> = {
  COBS:             { full: "COBS",               primary: "#1a3a6b", secondary: "#c9a227", initials: "CO" },
  "Old Boys":       { full: "Old Boys RC",        primary: "#cc0000", secondary: "#ffffff", initials: "OB" },
  PWCC:             { full: "Prince of Wales CC", primary: "#003087", secondary: "#FFB81C", initials: "PW" },
  "Old Macks":      { full: "Old Mackayans",      primary: "#b91c1c", secondary: "#ffffff", initials: "OM" },
  "Stade Francais": { full: "Stade Français",     primary: "#1a237e", secondary: "#e8102a", initials: "SF" },
  "Sporting RC":    { full: "Sporting RC",        primary: "#15803d", secondary: "#ffffff", initials: "SP" },
  DOBS:             { full: "DOBS",               primary: "#0369a1", secondary: "#fbbf24", initials: "DO" },
  UC:               { full: "Univ. Católica",     primary: "#1e3a8a", secondary: "#fbbf24", initials: "UC" },
  "Old Johns":      { full: "Old Johns RC",       primary: "#1d4ed8", secondary: "#fef08a", initials: "OJ" },
  "Old Reds":       { full: "Old Reds RC",        primary: "#9f1239", secondary: "#fca5a5", initials: "OR" },
};

function Pos({ pos, division }: { pos: number; division: DivisionKey }) {
  const isPrimera = division === "PRIMERA";
  if (pos <= 4) return <span className="inline-flex w-7 h-7 items-center justify-center rounded text-xs font-bold bg-emerald-600 text-white">{pos}</span>;
  if (isPrimera && pos === 9) return <span className="inline-flex w-7 h-7 items-center justify-center rounded text-xs font-bold bg-amber-500 text-zinc-950">{pos}</span>;
  if (isPrimera && pos === 10) return <span className="inline-flex w-7 h-7 items-center justify-center rounded text-xs font-bold bg-red-700 text-white">{pos}</span>;
  return <span className="inline-flex w-7 h-7 items-center justify-center rounded text-xs font-bold bg-secondary text-foreground">{pos}</span>;
}

// `liveMatches.division` is a free-form string ("Primera XV", "Intermedia"…).
// Map it onto our DivisionKey enum loosely. Check PRE first because
// "Pre-Intermedia" contains "Intermedia".
function liveDivisionKey(raw: string): DivisionKey | null {
  const s = raw.toLowerCase();
  if (s.includes("pre")) return "PRE_INTERMEDIA";
  if (s.includes("intermedia")) return "INTERMEDIA";
  if (s.includes("primera")) return "PRIMERA";
  return null;
}

// Apply LIVE/HT match deltas on top of the base standings rows. Rugby points:
// win=4, draw=2, loss=0, +1 try bonus (4+ tries), +1 losing bonus (≤7).
function applyLiveOverlay(base: StandingRow[], lives: LiveMatch[]): StandingRow[] {
  if (lives.length === 0) return base;

  const byTeam = new Map(base.map((r) => [r.team, { ...r }]));
  for (const lm of lives) {
    if (lm.status !== "LIVE" && lm.status !== "HT") continue;
    const home = byTeam.get(lm.homeTeam);
    const away = byTeam.get(lm.awayTeam);
    if (!home || !away) continue;

    const hs = lm.homeScore;
    const as = lm.awayScore;
    const ht = lm.homeTries;
    const at = lm.awayTries;

    home.pj += 1; away.pj += 1;
    home.pf += hs; home.pc += as;
    away.pf += as; away.pc += hs;

    const homeWin = hs > as;
    const draw = hs === as;
    if (draw) { home.pe += 1; away.pe += 1; }
    else if (homeWin) { home.pg += 1; away.pp += 1; }
    else { away.pg += 1; home.pp += 1; }

    let homePts = draw ? 2 : homeWin ? 4 : 0;
    let awayPts = draw ? 2 : homeWin ? 0 : 4;
    if (ht >= 4) homePts += 1;
    if (at >= 4) awayPts += 1;
    if (!draw && !homeWin && as - hs <= 7) homePts += 1;
    if (!draw && homeWin && hs - as <= 7) awayPts += 1;

    home.pts += homePts;
    away.pts += awayPts;
    home.diff = home.pf - home.pc;
    away.diff = away.pf - away.pc;
  }

  const sorted = [...byTeam.values()].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return b.pf - a.pf;
  });
  return sorted.map((r, i) => ({ ...r, pos: i + 1 }));
}

// Build a home-only / away-only table from finished arusa results. Rugby points
// without the try bonus (no per-match try data): win=4, draw=2, +1 losing bonus.
function computeVenueTable(
  results: Map<string, { finished: boolean; homeScore?: number; awayScore?: number }>,
  division: DivisionKey,
  teams: string[],
  venue: "home" | "away",
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teams.map((t) => [t, { pos: 0, team: t, pj: 0, pg: 0, pe: 0, pp: 0, pf: 0, pc: 0, diff: 0, pts: 0 }]),
  );
  for (const [key, r] of results) {
    if (!r.finished || r.homeScore == null || r.awayScore == null) continue;
    const [div, home, away] = key.split("|");
    if (div !== division) continue;
    const team = venue === "home" ? home : away;
    const row = rows.get(team);
    if (!row) continue;
    const tf = venue === "home" ? r.homeScore : r.awayScore;
    const ta = venue === "home" ? r.awayScore : r.homeScore;
    row.pj += 1; row.pf += tf; row.pc += ta;
    if (tf > ta) { row.pg += 1; row.pts += 4; }
    else if (tf === ta) { row.pe += 1; row.pts += 2; }
    else { row.pp += 1; if (ta - tf <= 7) row.pts += 1; }
    row.diff = row.pf - row.pc;
  }
  return [...rows.values()]
    .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.pf - a.pf)
    .map((r, i) => ({ ...r, pos: i + 1 }));
}

function DivisionTable({ division }: { division: DivisionKey }) {
  // Source priority for the table base:
  //   1. live arusa standings (authoritative, real-time, all 3 grades)
  //   2. our computed table (Fecha-4 baseline + finished live matches) when
  //      arusa is unreachable
  //   3. the static snapshot as a last resort
  // The LIVE/HT overlay is always applied on top.
  const { rows: leveradeRows } = useLeveradeStandings(division);
  const { rows: computedRows, loading, refresh } = useComputedStandings(division);
  const { form, refresh: refreshForm } = useTeamForm(division);
  const leveradeResults = useLeveradeResults();
  const liveByPair = useLiveMatches();
  const [venue, setVenue] = useState<"total" | "home" | "away">("total");

  const live = useMemo(
    () => Array.from(liveByPair.values()).filter(
      (m) => liveDivisionKey(m.division) === division &&
             (m.status === "LIVE" || m.status === "HT"),
    ),
    [liveByPair, division],
  );

  // When a match in this division finishes it leaves the LIVE/HT overlay and is
  // now persisted in the computed base — re-pull immediately so it stays in the
  // table instead of momentarily disappearing until the next 60s poll.
  const finishedCount = useMemo(
    () => Array.from(liveByPair.values()).filter(
      (m) => liveDivisionKey(m.division) === division && m.status === "FINISHED",
    ).length,
    [liveByPair, division],
  );
  useEffect(() => { refresh(); refreshForm(); }, [finishedCount, refresh, refreshForm]);

  const base = leveradeRows ?? computedRows ?? STANDINGS[division];
  const overlayRows = useMemo(() => applyLiveOverlay(base, live), [base, live]);
  // Home/away tables with full bonus (incl. offensive try bonus) come from the
  // server, which has per-match tries. While that loads we show the client-side
  // approximation (defensive bonus only) so the filter feels instant.
  const venueServer = useVenueStandings(division, venue !== "total");
  const venueRows = useMemo(() => {
    if (venue === "total") return null;
    const serverRows = venue === "home" ? venueServer.home : venueServer.away;
    if (serverRows && serverRows.length) return serverRows;
    return computeVenueTable(leveradeResults, division, base.map((r) => r.team), venue);
  }, [venue, venueServer, leveradeResults, division, base]);
  const rows = venueRows ?? overlayRows;
  const usingStatic = !leveradeRows && !computedRows && !loading;

  // Form guide follows the venue filter: home-only / away-only when filtered.
  const displayForm = useMemo(() => {
    if (venue === "total") return form;
    const wantHome = venue === "home";
    const out: TeamForm = {};
    for (const [team, matches] of Object.entries(form)) {
      out[team] = matches.filter((m) => m.home === wantHome);
    }
    return out;
  }, [form, venue]);

  return (
    <>
      {(live.length > 0 || usingStatic) && (
        <div className="mb-3 flex items-center justify-between gap-2 text-xs">
          {live.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-red-400 font-semibold">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              {live.length === 1 ? "1 partido en vivo" : `${live.length} partidos en vivo`} · tabla actualizada en tiempo real
            </span>
          ) : <span />}
          {usingStatic && (
            <span className="text-muted-foreground/70">Datos en caché · sin conexión al servidor</span>
          )}
        </div>
      )}

      {/* Venue filter */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {([["total", "Total"], ["home", "Local"], ["away", "Visita"]] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setVenue(v)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              venue === v ? "bg-red-600 text-white" : "bg-card border border-border text-muted-foreground hover:text-white hover:border-foreground/30"
            }`}
          >
            {label}
          </button>
        ))}
        {venue !== "total" && (
          <span className="text-[11px] text-muted-foreground/70 ml-2">
            Solo partidos de {venue === "home" ? "local" : "visita"}
            {venueServer.loading ? " · calculando bonus de tries…" : ""}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-card/80 hover:bg-card/80">
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider w-12 text-center">#</TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Club</TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-center">PJ</TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-center hidden sm:table-cell">PG</TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-center hidden sm:table-cell">PE</TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-center hidden sm:table-cell">PP</TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-center hidden md:table-cell">PF</TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-center hidden md:table-cell">PC</TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-center hidden lg:table-cell">DIF</TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-center hidden lg:table-cell">Forma</TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-center font-bold">PTS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const club = CLUBS[row.team];
              const isLive = live.some((m) => m.homeTeam === row.team || m.awayTeam === row.team);
              return (
                <TableRow
                  key={row.team}
                  className="border-border hover:bg-card/60 transition-colors"
                  style={{ borderLeft: `3px solid ${club?.primary ?? "#374151"}` }}
                >
                  <TableCell className="text-center py-3"><Pos pos={row.pos} division={division} /></TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      {clubLogo(row.team) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={clubLogo(row.team)!} alt={row.team} className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-1 ring-border" />
                      ) : (
                        <span
                          className="w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: club?.primary, color: club?.secondary }}
                        >
                          {club?.initials}
                        </span>
                      )}
                      <div>
                        <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                          {row.team}
                          {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-label="en vivo" />}
                        </p>
                        <p className="text-muted-foreground text-xs hidden sm:block">{club?.full}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-foreground/80 text-sm">{row.pj}</TableCell>
                  <TableCell className="text-center text-foreground/80 text-sm hidden sm:table-cell">{row.pg}</TableCell>
                  <TableCell className="text-center text-foreground/80 text-sm hidden sm:table-cell">{row.pe}</TableCell>
                  <TableCell className="text-center text-foreground/80 text-sm hidden sm:table-cell">{row.pp}</TableCell>
                  <TableCell className="text-center text-foreground/80 text-sm hidden md:table-cell">{row.pf}</TableCell>
                  <TableCell className="text-center text-foreground/80 text-sm hidden md:table-cell">{row.pc}</TableCell>
                  <TableCell className={`text-center text-sm font-medium hidden lg:table-cell ${row.diff > 0 ? "text-emerald-400" : row.diff < 0 ? "text-red-400" : "text-foreground/80"}`}>
                    {row.diff > 0 ? `+${row.diff}` : row.diff}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex justify-center"><FormPills form={displayForm[row.team]} /></div>
                  </TableCell>
                  <TableCell className="text-center font-black text-lg text-foreground">{row.pts}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground/70">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-600 inline-block" /> Playoffs (Top 4)</span>
        {division === "PRIMERA" && (
          <>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Repechaje (9°)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-700 inline-block" /> Descenso directo (10°)</span>
          </>
        )}
        <span className="ml-auto">PJ=Jugados · PG=Ganados · PE=Empatados · PP=Perdidos · PF/PC=Pts F/C · DIF=Diferencia</span>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground/70">
        Sistema de puntos: 4 ganado · 2 empate · 0 perdido · +1 por 4 tries · +1 por perder por 7 o menos
        {division === "PRE_INTERMEDIA" ? " · +1 extra por presentar 23 jugadores (6 primeras líneas)" : ""}.
        Ver <a href="/reglamento" className="text-muted-foreground hover:text-foreground underline underline-offset-2">reglamento</a>.
      </p>
    </>
  );
}

export default function StandingsPage() {
  const [active, setActive] = useState<DivisionKey>("PRIMERA");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-1">
            <Trophy className="h-5 w-5 text-red-500" />
            <h1 className="text-2xl font-black uppercase tracking-widest">Tabla de Posiciones</h1>
          </div>
          <p className="text-muted-foreground text-sm">Primera División · Temporada 2026 · 3 divisiones por club</p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={active} onValueChange={(v) => setActive(v as DivisionKey)}>
          <TabsList className="bg-card border border-border p-1 h-auto gap-1 mb-6 flex-wrap">
            {DIVISIONS.map((d) => (
              <TabsTrigger
                key={d.key}
                value={d.key}
                className="text-muted-foreground data-[state=active]:bg-red-600 data-[state=active]:text-white rounded px-5 py-2 text-sm font-semibold uppercase tracking-wide"
              >
                {d.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {DIVISIONS.map((d) => (
            <TabsContent key={d.key} value={d.key}>
              <DivisionTable division={d.key} />
            </TabsContent>
          ))}
        </Tabs>

        <p className="mt-8 text-xs text-muted-foreground/70 text-center">
          Datos oficiales: <a href="https://arusa.cl/en/tournament/1328550/summary" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">arusa.cl</a>
        </p>
      </div>
    </div>
  );
}
