"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Clock, CheckCircle, AlertCircle, ChevronRight, ChevronLeft } from "lucide-react";
import { DIVISIONS, nextFechaNumber, matchStatus, byKickoff, type DivisionKey, type RoundMatch } from "@/lib/tournament";
import { effectiveRounds, fetchArusaCalendar, type ArusaCalendar } from "@/lib/calendar";
import { ClubLogo } from "@/components/club-logo";
import { MatchDetailSheet } from "@/components/match-detail-sheet";
import { useLiveMatches, getLive } from "@/lib/use-live-matches";
import { useLeveradeResults, getLeveradeResult } from "@/lib/use-leverade-results";
import { useFixtureResults, getFixtureResult } from "@/lib/use-fixture-results";
import { LiveScore } from "@/components/live-score";

function ClubBadge({ team }: { team: string }) {
  // Inside the match <button>, so navigate to the club without nesting anchors.
  return <ClubLogo team={team} stopPropagation className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-border" />;
}

type MatchRowProps = {
  m: RoundMatch;
  round: number;
  division: DivisionKey;
  onClick: () => void;
  liveMap: ReturnType<typeof useLiveMatches>;
  leveradeResults: ReturnType<typeof useLeveradeResults>;
  fixtureResults: ReturnType<typeof useFixtureResults>;
};

function MatchRow({ m, round, division, onClick, liveMap, leveradeResults, fixtureResults }: MatchRowProps) {
  const live = getLive(liveMap, division, m.home, m.away);
  // DB results (offline, accurate) are preferred; Leverade scrape is the fallback.
  const result = getFixtureResult(fixtureResults, division, m.home, m.away, round)
    ?? getLeveradeResult(leveradeResults, division, m.home, m.away, round);
  const isLive = live?.status === "LIVE" || live?.status === "HT";
  const postponed = !!m.postponed; // suspendido por lluvia/clima — espera reprogramación
  const finished = !postponed && (live?.status === "FINISHED" || result?.finished || matchStatus(m) === "FINISHED");
  const suspended = !postponed && !finished && !isLive && (!m.date || m.date === "Por definir");
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border bg-card/50 overflow-hidden active:scale-[0.99] transition-all cursor-pointer ${
        isLive
          ? "border-red-600/50 shadow-[0_0_14px_rgba(220,38,38,0.12)]"
          : suspended || postponed
            ? "border-amber-500/30"
            : "border-border hover:border-foreground/30"
      }`}
    >
      <div className="flex items-stretch">
        <div className="flex-1 px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <ClubBadge team={m.home} />
              <span className="font-semibold text-sm text-foreground">{m.home}</span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 min-w-20 justify-center">
              <LiveScore
                live={live}
                staticHome={result?.homeScore}
                staticAway={result?.awayScore}
                finished={finished}
              />
            </div>
            <div className="flex items-center gap-3 flex-1 flex-row-reverse">
              <ClubBadge team={m.away} />
              <span className="font-semibold text-sm text-right text-foreground">{m.away}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground/70 flex-wrap">
            {!suspended && !postponed && m.time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{m.time}</span>}
            {!suspended && !postponed && m.venue && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m.venue}</span>}
            {finished && !isLive && <span className="flex items-center gap-1 text-emerald-600 ml-auto"><CheckCircle className="h-3 w-3" />Finalizado</span>}
            {!finished && !suspended && !postponed && !isLive && <span className="ml-auto text-muted-foreground/50 text-[10px]">Ver formación →</span>}
            {postponed && (
              <span className="flex items-center gap-1 text-amber-400 ml-auto" title={`Partido aplazado. ${m.reschedule ? `Reprogramación: ${m.reschedule}.` : "Pendiente de reprogramación."}`}>
                <AlertCircle className="h-3 w-3" />Aplazado{m.reschedule ? ` · ${m.reschedule}` : " · a reprogramar"}
              </span>
            )}
            {suspended && (
              <span className="flex items-center gap-1 text-amber-400 ml-auto" title="Equipo no presentó pre-intermedia. Pasa a la Dirección de Torneos: W.O. 28-0 + 5 pts al rival. Sin reprogramación.">
                <AlertCircle className="h-3 w-3" />Sin presentación · pendiente W.O.
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function SchedulePage() {
  const [division, setDivision] = useState<DivisionKey>("PRIMERA");
  // Calendario de arusa (horarios/sedes/aplazados) superpuesto sobre ROUNDS.
  const [cal, setCal] = useState<ArusaCalendar | null>(null);
  useEffect(() => {
    fetchArusaCalendar().then((c) => c && setCal(c));
  }, []);
  const rounds = useMemo(() => effectiveRounds(cal)[division], [cal, division]);
  const nextRound = nextFechaNumber();
  const [activeRound, setActiveRound] = useState<number>(nextRound);
  const current = rounds.find((r) => r.round === activeRound) ?? rounds[0];
  const liveMap = useLiveMatches();
  const leveradeResults = useLeveradeResults();
  const fixtureResults = useFixtureResults();

  const minRound = rounds[0].round;
  const maxRound = rounds[rounds.length - 1].round;
  const go = (n: number) => setActiveRound(Math.max(minRound, Math.min(maxRound, n)));

  const [selectedMatch, setSelectedMatch] = useState<{
    m: RoundMatch; round: number; division: DivisionKey;
  } | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-1">
            <Calendar className="h-5 w-5 text-red-500" />
            <h1 className="text-2xl font-black uppercase tracking-widest">Fixture 2026</h1>
          </div>
          <p className="text-muted-foreground text-sm">Primera División · Asociación Rugby de Santiago</p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">

        <Tabs
          value={division}
          onValueChange={(v) => setDivision(v as DivisionKey)}
        >
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
        </Tabs>

        {/* Gameweek stepper */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => go(activeRound - 1)}
            disabled={activeRound <= minRound}
            aria-label="Fecha anterior"
            className="p-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="px-4 py-2 rounded-lg bg-card border border-border text-sm font-bold text-center min-w-40">
            Fecha {current.round}
            <span className="text-muted-foreground font-normal"> · {current.dates}</span>
          </div>
          <button
            onClick={() => go(activeRound + 1)}
            disabled={activeRound >= maxRound}
            aria-label="Fecha siguiente"
            className="p-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {activeRound !== nextRound && (
            <button
              onClick={() => setActiveRound(nextRound)}
              className="ml-1 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 transition-colors"
            >
              Hoy
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap mb-8">
          {rounds.map((r) => (
            <button
              key={r.round}
              onClick={() => setActiveRound(r.round)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeRound === r.round
                  ? "bg-red-600 text-white"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              Fecha {r.round}
              {r.round === nextRound && <span className="ml-2 text-xs opacity-70">Próxima</span>}
            </button>
          ))}
        </div>

        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-bold">Fecha {current.round}</h2>
            <span className="text-muted-foreground text-sm">{current.dates}</span>
            {current.round === nextRound && (
              <Badge className="bg-red-600/20 text-red-400 border border-red-600/30 text-xs">Próxima</Badge>
            )}
          </div>
          <div className="space-y-3">
            {[...current.matches].sort(byKickoff).map((m, i) => (
              <MatchRow
                key={i}
                m={m}
                leveradeResults={leveradeResults}
                fixtureResults={fixtureResults}
                round={current.round}
                division={division}
                liveMap={liveMap}
                onClick={() => setSelectedMatch({ m, round: current.round, division })}
              />
            ))}
          </div>
        </div>

        <p className="mt-10 text-xs text-muted-foreground/70 text-center">
          Datos oficiales: <a href="https://arusa.cl/en/tournament/1328550/summary" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">arusa.cl</a>
        </p>
      </div>

      <MatchDetailSheet
        open={!!selectedMatch}
        match={
          selectedMatch
            ? (() => {
                const res = getFixtureResult(fixtureResults, selectedMatch.division, selectedMatch.m.home, selectedMatch.m.away, selectedMatch.round)
                  ?? getLeveradeResult(leveradeResults, selectedMatch.division, selectedMatch.m.home, selectedMatch.m.away, selectedMatch.round);
                const live = getLive(liveMap, selectedMatch.division, selectedMatch.m.home, selectedMatch.m.away);
                const isFinished = live?.status === "FINISHED" || res?.finished || matchStatus(selectedMatch.m) === "FINISHED";
                return {
                  ...selectedMatch.m,
                  status: isFinished ? "FINISHED" as const : "UPCOMING" as const,
                  homeScore: live?.homeScore ?? res?.homeScore,
                  awayScore: live?.awayScore ?? res?.awayScore,
                  round: selectedMatch.round,
                  division: selectedMatch.division,
                };
              })()
            : null
        }
        onClose={() => setSelectedMatch(null)}
      />
    </div>
  );
}
