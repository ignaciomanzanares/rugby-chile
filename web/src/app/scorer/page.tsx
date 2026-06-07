"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Wifi, WifiOff, Minus, Plus } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type EventType = "TRY" | "CONVERSION" | "PENALTY" | "DROP_GOAL" | "YELLOW_CARD" | "RED_CARD";

type LiveEvent = {
  id: string;
  team: "home" | "away";
  type: EventType;
  minute: number;
  playerName: string | null;
  points: number;
};

type Match = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  division: string;
  homeScore: number;
  awayScore: number;
  homeTries: number;
  awayTries: number;
  minute: number;
  status: string;
  events: LiveEvent[];
};

const SCORING_BUTTONS: { type: EventType; label: string; pts: number; color: string }[] = [
  { type: "TRY",       label: "Ensayo",     pts: 5, color: "bg-emerald-600 active:bg-emerald-700" },
  { type: "CONVERSION",label: "Conversión", pts: 2, color: "bg-blue-600 active:bg-blue-700" },
  { type: "PENALTY",   label: "Penal",      pts: 3, color: "bg-amber-500 active:bg-amber-600" },
  { type: "DROP_GOAL", label: "Drop",       pts: 3, color: "bg-purple-600 active:bg-purple-700" },
  { type: "YELLOW_CARD",label: "Amarilla",  pts: 0, color: "bg-yellow-400 active:bg-yellow-500 text-black" },
  { type: "RED_CARD",  label: "Roja",       pts: 0, color: "bg-red-700 active:bg-red-800" },
];

function ScoreButton({
  label, pts, color, onClick, disabled,
}: {
  label: string; pts: number; color: string; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${color} text-foreground font-bold rounded-xl py-5 px-2 text-center w-full transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed select-none`}
    >
      <div className="text-lg leading-tight">{label}</div>
      {pts > 0 && <div className="text-xs opacity-75 mt-0.5">+{pts} pts</div>}
    </button>
  );
}

export default function ScorerPage() {
  const params = useSearchParams();
  const token = params.get("token");

  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [minute, setMinute] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const fetchMatch = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/scorer/${token}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Error al cargar el partido");
        return;
      }
      const data = await res.json();
      setMatch(data);
      setMinute(data.minute ?? 0);
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMatch();
    const interval = setInterval(fetchMatch, 15000);
    return () => clearInterval(interval);
  }, [fetchMatch]);

  const addEvent = async (team: "home" | "away", type: EventType) => {
    if (!token || busy) return;
    setBusy(true);
    const POINTS: Record<EventType, number> = {
      TRY: 5, CONVERSION: 2, PENALTY: 3, DROP_GOAL: 3, YELLOW_CARD: 0, RED_CARD: 0,
    };
    try {
      const res = await fetch(`${API_URL}/api/v1/scorer/${token}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team, type, minute }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMatch(updated);
        setMinute(updated.minute ?? minute);
        const teamName = team === "home" ? match?.homeTeam : match?.awayTeam;
        const pts = POINTS[type];
        setLastAction(`${teamName}: ${type}${pts > 0 ? ` (+${pts})` : ""}`);
        setTimeout(() => setLastAction(null), 3000);
      }
    } catch {
      setConnected(false);
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (status: "LIVE" | "HT" | "FINISHED") => {
    if (!token || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/scorer/${token}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, minute }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMatch(updated);
      }
    } catch {
      setConnected(false);
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg font-bold">Enlace inválido</p>
          <p className="text-muted-foreground text-sm mt-1">Solicita un nuevo enlace al administrador.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Cargando partido...</div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg font-bold">{error ?? "Partido no encontrado"}</p>
        </div>
      </div>
    );
  }

  const isFinished = match.status === "FINISHED";
  const isHT = match.status === "HT";
  const isLive = match.status === "LIVE";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{match.division}</p>
          <p className="text-sm font-bold">Marcador en vivo</p>
        </div>
        <div className="flex items-center gap-2">
          {connected
            ? <Wifi className="h-4 w-4 text-emerald-400" />
            : <WifiOff className="h-4 w-4 text-red-400" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
            isFinished ? "bg-secondary text-foreground/80"
            : isHT ? "bg-amber-500/20 text-amber-400"
            : isLive ? "bg-red-600/20 text-red-400"
            : "bg-secondary text-foreground/80"
          }`}>
            {isFinished ? "Final" : isHT ? "Descanso" : isLive ? "En vivo" : "Programado"}
          </span>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="bg-card/50 px-4 py-5 border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-center">
            <p className="font-bold text-base leading-tight">{match.homeTeam}</p>
            <p className="text-muted-foreground text-xs mt-0.5">{match.homeTries} ensayo{match.homeTries !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-4xl font-black tabular-nums">{match.homeScore}</span>
            <span className="text-muted-foreground/70 text-xl">–</span>
            <span className="text-4xl font-black tabular-nums">{match.awayScore}</span>
          </div>
          <div className="flex-1 text-center">
            <p className="font-bold text-base leading-tight">{match.awayTeam}</p>
            <p className="text-muted-foreground text-xs mt-0.5">{match.awayTries} ensayo{match.awayTries !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {/* Minute control */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Minuto</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMinute(m => Math.max(0, m - 1))}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground active:bg-secondary"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="text-2xl font-black tabular-nums w-12 text-center">{minute}'</span>
          <button
            onClick={() => setMinute(m => Math.min(120, m + 1))}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground active:bg-secondary"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <div className="w-16" />
      </div>

      {/* Last action toast */}
      {lastAction && (
        <div className="mx-4 mt-3 bg-emerald-900/50 border border-emerald-700/50 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          <span className="text-xs text-emerald-300 font-medium">{lastAction}</span>
        </div>
      )}

      {/* Scoring buttons */}
      {!isFinished && (
        <div className="flex-1 px-4 pt-4 pb-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{match.homeTeam}</p>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {SCORING_BUTTONS.map((b) => (
              <ScoreButton
                key={`home-${b.type}`}
                label={b.label}
                pts={b.pts}
                color={b.color}
                disabled={busy}
                onClick={() => addEvent("home", b.type)}
              />
            ))}
          </div>

          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{match.awayTeam}</p>
          <div className="grid grid-cols-3 gap-2">
            {SCORING_BUTTONS.map((b) => (
              <ScoreButton
                key={`away-${b.type}`}
                label={b.label}
                pts={b.pts}
                color={b.color}
                disabled={busy}
                onClick={() => addEvent("away", b.type)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Match controls */}
      <div className="px-4 py-4 border-t border-border space-y-2">
        {!isLive && !isFinished && !isHT && (
          <button
            onClick={() => updateStatus("LIVE")}
            disabled={busy}
            className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-4 rounded-xl text-base disabled:opacity-40"
          >
            Iniciar partido
          </button>
        )}
        {isLive && (
          <button
            onClick={() => updateStatus("HT")}
            disabled={busy}
            className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-black font-bold py-4 rounded-xl text-base disabled:opacity-40"
          >
            Medio tiempo
          </button>
        )}
        {isHT && (
          <button
            onClick={() => updateStatus("LIVE")}
            disabled={busy}
            className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-4 rounded-xl text-base disabled:opacity-40"
          >
            Iniciar 2do tiempo
          </button>
        )}
        {(isLive || isHT) && (
          <button
            onClick={() => updateStatus("FINISHED")}
            disabled={busy}
            className="w-full bg-secondary hover:bg-secondary active:bg-secondary text-foreground font-bold py-4 rounded-xl text-base disabled:opacity-40"
          >
            Finalizar partido
          </button>
        )}
        {isFinished && (
          <div className="text-center py-4">
            <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <p className="font-bold text-lg">Partido finalizado</p>
            <p className="text-muted-foreground text-sm mt-1">
              {match.homeTeam} {match.homeScore} – {match.awayScore} {match.awayTeam}
            </p>
          </div>
        )}
      </div>

      {/* Recent events log */}
      {match.events.length > 0 && (
        <div className="px-4 pb-6">
          <p className="text-xs font-bold text-muted-foreground/70 uppercase tracking-wider mb-2">Últimos eventos</p>
          <div className="space-y-1">
            {[...match.events].reverse().slice(0, 10).map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums text-muted-foreground/70 w-8">{e.minute}'</span>
                <span className={e.team === "home" ? "text-foreground" : "text-foreground/80"}>
                  {e.team === "home" ? match.homeTeam : match.awayTeam}
                </span>
                <span className="text-muted-foreground/70">·</span>
                <span>{e.type}</span>
                {e.points > 0 && <span className="text-emerald-500">+{e.points}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
