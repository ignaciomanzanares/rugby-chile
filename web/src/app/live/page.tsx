"use client";

import { useEffect, useState } from "react";
import { Radio, MapPin, Clock, Wifi, WifiOff } from "lucide-react";
import { connectSocket, disconnectSocket, getSocket, type LiveMatch } from "@/lib/socket";
import { nextFechaNumber, ROUNDS, parseDateStr, type DivisionKey } from "@/lib/tournament";
import { ClubLogo } from "@/components/club-logo";
import { useEstimatedMinute } from "@/lib/use-estimated-minute";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const DIVISION_LABEL: Record<string, string> = {
  PRIMERA: "Primera",
  INTERMEDIA: "Intermedia",
  PRE_INTERMEDIA: "Pre-Intermedia",
};
const divLabel = (d: string) => DIVISION_LABEL[d] ?? d;

const EVENT_LABELS: Record<string, string> = {
  TRY: "Try", CONVERSION: "Conversión", PENALTY: "Penal",
  DROP_GOAL: "Drop", YELLOW_CARD: "Amarilla", RED_CARD: "Roja",
};
const EVENT_COLORS: Record<string, string> = {
  TRY: "text-emerald-400", CONVERSION: "text-blue-400", PENALTY: "text-yellow-400",
  DROP_GOAL: "text-purple-400", YELLOW_CARD: "text-yellow-400", RED_CARD: "text-red-500",
};

// Busca el partido en el fixture de la fecha en curso para completar datos que
// el feed en vivo no trae (la sede/venue) o para saber su horario real.
function fixtureFor(division: string, home: string, away: string) {
  const rounds = ROUNDS[division as DivisionKey];
  if (!rounds) return undefined;
  const round = rounds.find((r) => r.round === nextFechaNumber());
  return round?.matches.find((m) => m.home === home && m.away === away);
}

function fixtureKickoff(division: string, home: string, away: string): number | null {
  const m = fixtureFor(division, home, away);
  const d = m && parseDateStr(m.date);
  if (!d) return null;
  const [hh, mm] = (m!.time || "00:00").split(":").map(Number);
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d.getTime();
}

function ClubCircle({ team, size = "md" }: { team: string; size?: "sm" | "md" | "xl" }) {
  const dim = size === "xl" ? "w-20 h-20" : size === "md" ? "w-8 h-8" : "w-6 h-6";
  // stopPropagation: live cards can be interactive; navigate to the club safely.
  return <ClubLogo team={team} stopPropagation className={`${dim} rounded-full object-cover flex-shrink-0 ring-1 ring-border`} />;
}

function StatusBadge({ matchId, status, minute }: { matchId: string; status: LiveMatch["status"]; minute: number }) {
  const liveMinute = useEstimatedMinute(matchId, minute, status);
  if (status === "HT") return (
    <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
      Descanso
    </span>
  );
  if (status === "FINISHED") return (
    <span className="text-xs font-bold px-2 py-1 rounded-full bg-secondary/50 text-muted-foreground border border-border">
      Final
    </span>
  );
  if (status === "LIVE") return (
    <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-600/20 text-red-400 border border-red-600/30 flex items-center gap-1 animate-pulse">
      <Clock className="h-3 w-3" /> {liveMinute}&apos;
    </span>
  );
  return (
    <span className="text-xs font-bold px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">
      Próximo
    </span>
  );
}

export default function LivePage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  // Gate de carga: hasta que resuelva el primer fetch/socket no sabemos si hay
  // partidos, así que mostramos skeleton en vez del vacío "No hay partidos"
  // (que aparecía por ~1s antes de que llegaran los datos).
  const [loaded, setLoaded] = useState(false);
  // Reloj para filtrar "próximos" (leer Date.now() en render es impuro). Arranca
  // en 0 y se setea/actualiza en el efecto de abajo.
  const [now, setNow] = useState(0);
  // El socket es un singleton compartido (el ticker del layout ya lo conecta),
  // así que al montar esta página el "connect" quizás ya ocurrió; arrancamos con
  // el estado real para no quedar en un falso "Desconectado".
  const [connected, setConnected] = useState(() => getSocket().connected);

  useEffect(() => {
    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 30_000);

    // Fetch initial state from REST
    fetch(`${API_URL}/api/v1/live`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setMatches(data))
      .catch(() => {})
      .finally(() => setLoaded(true));

    // Subscribe to real-time updates
    const socket = connectSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onInit = (data: LiveMatch[]) => { setMatches(data); setLoaded(true); };

    const onMatchUpdate = (updated: LiveMatch) => {
      setMatches((prev) => {
        const exists = prev.find((m) => m.id === updated.id);
        if (exists) return prev.map((m) => m.id === updated.id ? updated : m);
        return [...prev, updated];
      });
    };

    const onMinuteUpdate = ({ matchId, minute }: { matchId: string; minute: number }) => {
      setMatches((prev) =>
        prev.map((m) => m.id === matchId ? { ...m, minute } : m)
      );
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("live:init", onInit);
    socket.on("match:update", onMatchUpdate);
    socket.on("minute:update", onMinuteUpdate);

    return () => {
      clearInterval(clock);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("live:init", onInit);
      socket.off("match:update", onMatchUpdate);
      socket.off("minute:update", onMinuteUpdate);
      disconnectSocket();
    };
  }, []);

  const liveNow = matches.filter((m) => m.status === "LIVE" || m.status === "HT");
  // "Próximos" = SCHEDULED cuyo horario aún no pasó (o desconocido). Un partido
  // aplazado queda SCHEDULED con su kickoff en el pasado → no es "próximo", así
  // que lo ocultamos (evita listar el aplazado como si fuera a empezar).
  const upcoming = matches.filter((m) => {
    if (m.status !== "SCHEDULED") return false;
    if (now === 0) return true; // aún sin reloj: mostrar hasta que el efecto corra
    const k = fixtureKickoff(m.division, m.homeTeam, m.awayTeam);
    return k == null || k > now - 15 * 60_000;
  });
  const nothingToShow = liveNow.length === 0 && upcoming.length === 0;

  return (
    <div className="min-h-screen bg-background text-foreground">

      <section className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Radio className="h-5 w-5 text-red-500 animate-pulse" />
                <h1 className="text-2xl font-black uppercase tracking-widest">En Vivo</h1>
                {liveNow.length > 0 && (
                  <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {liveNow.length} EN VIVO
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm">Resultados en tiempo real · Temporada 2026</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {connected
                ? <><Wifi className="h-3.5 w-3.5 text-emerald-400" /><span className="text-emerald-400">Conectado</span></>
                : <><WifiOff className="h-3.5 w-3.5 text-muted-foreground/70" /><span className="text-muted-foreground/70">Desconectado</span></>
              }
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 space-y-8">

        {!loaded ? (
          <div className="space-y-6">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-xl border border-border overflow-hidden">
                <div className="bg-card px-5 py-3 border-b border-border h-11" />
                <div className="p-8 flex items-center justify-between gap-4">
                  <div className="flex flex-col items-center gap-3 flex-1">
                    <span className="w-20 h-20 rounded-full bg-muted/60 animate-pulse" />
                    <span className="w-24 h-4 rounded bg-muted/50 animate-pulse" />
                  </div>
                  <span className="w-28 h-14 rounded bg-muted/50 animate-pulse" />
                  <div className="flex flex-col items-center gap-3 flex-1">
                    <span className="w-20 h-20 rounded-full bg-muted/60 animate-pulse" />
                    <span className="w-24 h-4 rounded bg-muted/50 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : nothingToShow ? (
          <div className="rounded-xl border border-border bg-card/50 p-16 text-center">
            <Radio className="h-10 w-10 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">No hay partidos en vivo en este momento</p>
            {(() => {
              const r = nextFechaNumber();
              const dates = ROUNDS.PRIMERA.find((x) => x.round === r)?.dates;
              return <p className="text-muted-foreground/70 text-sm mt-1">Fecha {r}{dates ? ` · ${dates}` : ""}</p>;
            })()}
          </div>
        ) : (
          <>
            {liveNow.length > 0 && (
              <div className="space-y-6">
                {liveNow.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            )}

            {upcoming.length > 0 && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Próximos partidos</h2>
                <div className="space-y-3">
                  {upcoming.map((match) => (
                    <div key={match.id} className="rounded-xl border border-border bg-card/30 px-5 py-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <ClubCircle team={match.homeTeam} size="md" />
                        <span className="font-semibold text-sm">{match.homeTeam}</span>
                      </div>
                      <div className="text-center">
                        <StatusBadge matchId={match.id} status={match.status} minute={match.minute} />
                        <p className="text-muted-foreground/70 text-xs mt-1">{divLabel(match.division)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">{match.awayTeam}</span>
                        <ClubCircle team={match.awayTeam} size="md" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: LiveMatch }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="bg-card px-5 py-3 flex items-center justify-between border-b border-border">
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20">{divLabel(match.division)}</span>
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {match.venue || fixtureFor(match.division, match.homeTeam, match.awayTeam)?.venue || "—"}
          </span>
        </div>
        <StatusBadge matchId={match.id} status={match.status} minute={match.minute} />
      </div>

      <div className="p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col items-center gap-3 flex-1">
            <ClubCircle team={match.homeTeam} size="xl" />
            <span className="font-bold text-lg text-center">{match.homeTeam}</span>
            <span className="text-muted-foreground text-sm">{match.homeTries} tries</span>
          </div>
          <div className="flex flex-col items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className={`text-5xl md:text-7xl font-black tabular-nums ${match.homeScore > match.awayScore ? "text-foreground" : "text-muted-foreground"}`}>
                {match.homeScore}
              </span>
              <span className="text-muted-foreground/50 text-3xl">-</span>
              <span className={`text-5xl md:text-7xl font-black tabular-nums ${match.awayScore > match.homeScore ? "text-foreground" : "text-muted-foreground"}`}>
                {match.awayScore}
              </span>
            </div>
            {match.status === "HT" && (
              <span className="text-amber-400 text-xs font-bold tracking-widest uppercase">Descanso</span>
            )}
          </div>
          <div className="flex flex-col items-center gap-3 flex-1">
            <ClubCircle team={match.awayTeam} size="xl" />
            <span className="font-bold text-lg text-center">{match.awayTeam}</span>
            <span className="text-muted-foreground text-sm">{match.awayTries} tries</span>
          </div>
        </div>
      </div>

      {match.events.length > 0 && (() => {
        // Chronological by game minute (2nd-half clock + 40). Earliest first → 80' last.
        const ordered = [...match.events]
          .map((e) => ({ ...e, gm: (e.half === 2 ? 40 : 0) + e.minute }))
          .sort((a, b) => a.gm - b.gm);
        const firstHalf = ordered.filter((e) => e.half !== 2);
        const htLast = firstHalf[firstHalf.length - 1];
        const htScore = htLast && htLast.homeScore != null ? { home: htLast.homeScore, away: htLast.awayScore } : null;
        const last = ordered[ordered.length - 1];
        return (
          <div className="border-t border-border px-5 py-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Minuto a minuto</h3>
            <div className="space-y-1">
              {ordered.map((ev, i) => {
                const prev = ordered[i - 1];
                const showHt = ev.half === 2 && (!prev || prev.half !== 2);
                return (
                  <div key={i}>
                    {showHt && (
                      <div className="flex items-center justify-center gap-2 py-2 my-1 border-y border-dashed border-border text-[11px] font-bold uppercase tracking-widest text-amber-400">
                        Medio tiempo{htScore ? ` · ${htScore.home}-${htScore.away}` : ""}
                      </div>
                    )}
                    <div className={`flex items-center gap-3 py-1.5 ${ev.team === "away" ? "flex-row-reverse text-right" : ""}`}>
                      <span className="text-xs font-mono text-muted-foreground/70 w-7 flex-shrink-0 text-center">{ev.gm}&apos;</span>
                      <ClubCircle team={ev.team === "home" ? match.homeTeam : match.awayTeam} size="sm" />
                      <span className={`text-xs font-bold ${EVENT_COLORS[ev.type]}`}>{EVENT_LABELS[ev.type]}</span>
                      {ev.playerName && <span className="text-muted-foreground text-xs">{ev.playerName}</span>}
                      {ev.homeScore != null && (
                        <span className="text-xs font-black tabular-nums text-foreground">{ev.homeScore}-{ev.awayScore}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {match.status === "FINISHED" && (
                <div className="flex items-center justify-center gap-2 pt-2 mt-1 border-t border-border text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Fin del partido
                  <span className="text-foreground tabular-nums">· {last?.homeScore ?? match.homeScore}-{last?.awayScore ?? match.awayScore}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
