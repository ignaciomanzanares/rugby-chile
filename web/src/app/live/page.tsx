"use client";

import { useEffect, useState } from "react";
import { Radio, MapPin, Clock, Wifi, WifiOff } from "lucide-react";
import { connectSocket, disconnectSocket, type LiveMatch } from "@/lib/socket";
import { nextFechaNumber, ROUNDS, clubLogo } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const DIVISION_LABEL: Record<string, string> = {
  PRIMERA: "Primera",
  INTERMEDIA: "Intermedia",
  PRE_INTERMEDIA: "Pre-Intermedia",
};
const divLabel = (d: string) => DIVISION_LABEL[d] ?? d;

const CLUBS: Record<string, { primary: string; secondary: string; initials: string }> = {
  "COBS":             { primary: "#1a3a6b", secondary: "#c9a227", initials: "CO" },
  "Old Boys":         { primary: "#cc0000", secondary: "#ffffff", initials: "OB" },
  "PWCC":             { primary: "#003087", secondary: "#FFB81C", initials: "PW" },
  "Old Macks":        { primary: "#b91c1c", secondary: "#ffffff", initials: "OM" },
  "Stade Francais":   { primary: "#1a237e", secondary: "#e8102a", initials: "SF" },
  "Sporting RC":      { primary: "#15803d", secondary: "#ffffff", initials: "SP" },
  "DOBS":             { primary: "#0369a1", secondary: "#fbbf24", initials: "DO" },
  "UC":               { primary: "#1e3a8a", secondary: "#fbbf24", initials: "UC" },
  "Old Johns":        { primary: "#1d4ed8", secondary: "#fef08a", initials: "OJ" },
  "Old Reds":         { primary: "#9f1239", secondary: "#fca5a5", initials: "OR" },
};

const EVENT_LABELS: Record<string, string> = {
  TRY: "Try", CONVERSION: "Conversión", PENALTY: "Penal",
  DROP_GOAL: "Drop", YELLOW_CARD: "Amarilla", RED_CARD: "Roja",
};
const EVENT_COLORS: Record<string, string> = {
  TRY: "text-emerald-400", CONVERSION: "text-blue-400", PENALTY: "text-yellow-400",
  DROP_GOAL: "text-purple-400", YELLOW_CARD: "text-yellow-400", RED_CARD: "text-red-500",
};
const EVENT_POINTS: Record<string, number> = {
  TRY: 5, CONVERSION: 2, PENALTY: 3, DROP_GOAL: 3, YELLOW_CARD: 0, RED_CARD: 0,
};

function ClubCircle({ team, size = "md" }: { team: string; size?: "sm" | "md" | "xl" }) {
  const logo = clubLogo(team);
  const c = CLUBS[team] ?? { primary: "#374151", secondary: "#fff", initials: team.slice(0, 2).toUpperCase() };
  const dim = size === "xl" ? "w-20 h-20" : size === "md" ? "w-8 h-8" : "w-6 h-6";
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt={team} className={`${dim} rounded-full object-cover flex-shrink-0 ring-1 ring-border`} />;
  }
  const txt = size === "xl" ? "text-2xl" : size === "md" ? "text-xs" : "text-[10px]";
  return (
    <span className={`${dim} ${txt} rounded-full inline-flex items-center justify-center font-black flex-shrink-0`}
      style={{ backgroundColor: c.primary, color: c.secondary }}>
      {c.initials}
    </span>
  );
}

function StatusBadge({ status, minute }: { status: LiveMatch["status"]; minute: number }) {
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
      <Clock className="h-3 w-3" /> {minute}&apos;
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
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Fetch initial state from REST
    fetch(`${API_URL}/api/v1/live`)
      .then((r) => r.json())
      .then((data) => setMatches(data))
      .catch(() => {});

    // Subscribe to real-time updates
    const socket = connectSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onInit = (data: LiveMatch[]) => setMatches(data);

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
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("live:init", onInit);
      socket.off("match:update", onMatchUpdate);
      socket.off("minute:update", onMinuteUpdate);
      disconnectSocket();
    };
  }, []);

  const liveNow = matches.filter((m) => m.status === "LIVE" || m.status === "HT");
  const upcoming = matches.filter((m) => m.status === "SCHEDULED");

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

        {matches.length === 0 ? (
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
                        <StatusBadge status={match.status} minute={match.minute} />
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
          <span className="text-xs text-muted-foreground">{match.venue || "—"}</span>
        </div>
        <StatusBadge status={match.status} minute={match.minute} />
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

      {match.events.length > 0 && (
        <div className="border-t border-border px-5 py-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Cronología</h3>
          <div className="space-y-1">
            {[...match.events].sort((a, b) => a.minute - b.minute).map((ev, i) => (
              <div key={i} className={`flex items-center gap-3 py-1.5 ${ev.team === "away" ? "flex-row-reverse" : ""}`}>
                <span className="text-xs font-mono text-muted-foreground/70 w-7 flex-shrink-0 text-center">{ev.minute}&apos;</span>
                <ClubCircle team={ev.team === "home" ? match.homeTeam : match.awayTeam} size="sm" />
                <span className={`text-xs font-bold ${EVENT_COLORS[ev.type]}`}>{EVENT_LABELS[ev.type]}</span>
                {ev.playerName && <span className="text-muted-foreground text-xs">{ev.playerName}</span>}
                {EVENT_POINTS[ev.type] > 0 && (
                  <span className="text-muted-foreground/70 text-xs">+{EVENT_POINTS[ev.type]}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
