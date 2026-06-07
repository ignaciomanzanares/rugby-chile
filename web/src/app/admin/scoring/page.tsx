"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Radio, Play, Pause, Square, RotateCcw, Plus, Minus, Clock, AlertCircle, Link2, Copy, Check } from "lucide-react";
import { connectSocket, disconnectSocket, type LiveMatch } from "@/lib/socket";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const CLUBS = [
  "COBS", "Old Boys", "PWCC", "Old Macks", "Stade Francais",
  "Sporting RC", "DOBS", "UC", "Old Johns", "Old Reds",
];
const DIVISIONS = ["Primera XV", "Intermedia", "Pre-Intermedia"];
const VENUES: Record<string, string> = {
  "COBS":           "Estadio COBS",
  "Old Boys":       "Old Grangonian Club",
  "PWCC":           "Prince of Wales Country Club",
  "Old Macks":      "Old Mackayans Club",
  "Stade Francais": "Club Stade Français",
  "Sporting RC":    "Sporting Club",
  "DOBS":           "Cancha Federación",
  "UC":             "San Carlos de Apoquindo",
  "Old Johns":      "Colegio Saint John's",
  "Old Reds":       "Cancha Federación",
};

const CLUB_COLORS: Record<string, { primary: string; secondary: string; initials: string }> = {
  "COBS":           { primary: "#1a3a6b", secondary: "#c9a227", initials: "CO" },
  "Old Boys":       { primary: "#cc0000", secondary: "#ffffff", initials: "OB" },
  "PWCC":           { primary: "#003087", secondary: "#FFB81C", initials: "PW" },
  "Old Macks":      { primary: "#b91c1c", secondary: "#ffffff", initials: "OM" },
  "Stade Francais": { primary: "#1a237e", secondary: "#e8102a", initials: "SF" },
  "Sporting RC":    { primary: "#15803d", secondary: "#ffffff", initials: "SP" },
  "DOBS":           { primary: "#0369a1", secondary: "#fbbf24", initials: "DO" },
  "UC":             { primary: "#1e3a8a", secondary: "#fbbf24", initials: "UC" },
  "Old Johns":      { primary: "#1d4ed8", secondary: "#fef08a", initials: "OJ" },
  "Old Reds":       { primary: "#9f1239", secondary: "#fca5a5", initials: "OR" },
};

const EVENT_TYPES = [
  { type: "TRY",         label: "Try",         points: 5, color: "bg-emerald-600 hover:bg-emerald-500" },
  { type: "CONVERSION",  label: "Conversión",  points: 2, color: "bg-blue-600 hover:bg-blue-500" },
  { type: "PENALTY",     label: "Penal",       points: 3, color: "bg-yellow-600 hover:bg-yellow-500" },
  { type: "DROP_GOAL",   label: "Drop",        points: 3, color: "bg-purple-600 hover:bg-purple-500" },
  { type: "YELLOW_CARD", label: "T. Amarilla", points: 0, color: "bg-yellow-500 hover:bg-yellow-400" },
  { type: "RED_CARD",    label: "T. Roja",     points: 0, color: "bg-red-700 hover:bg-red-600" },
];

function ClubBadge({ team, size = "sm" }: { team: string; size?: "sm" | "lg" }) {
  const c = CLUB_COLORS[team] ?? { primary: "#374151", secondary: "#fff", initials: team.slice(0, 2).toUpperCase() };
  const dim = size === "lg" ? "w-16 h-16 text-xl" : "w-10 h-10 text-sm";
  return (
    <span className={`${dim} rounded-full inline-flex items-center justify-center font-black flex-shrink-0`}
      style={{ backgroundColor: c.primary, color: c.secondary }}>
      {c.initials}
    </span>
  );
}

async function postMatch(homeTeam: string, awayTeam: string, division: string, venue: string): Promise<LiveMatch> {
  const res = await fetch(`${API_URL}/api/v1/live/matches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ homeTeam, awayTeam, division, venue }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return { ...data, events: data.events ?? [] };
}

// Inner component — uses useSearchParams, must be inside Suspense
function ScoringInner() {
  const params = useSearchParams();

  const preHome     = params.get("home")     ?? "";
  const preAway     = params.get("away")     ?? "";
  const preDivision = params.get("division") ?? "Primera XV";
  const preVenue    = params.get("venue")    ?? "";

  const hasPreset = Boolean(preHome && preAway);

  const [match, setMatch]     = useState<LiveMatch | null>(null);
  const [loading, setLoading] = useState(hasPreset); // start in loading state if preset
  const [error, setError]     = useState<string | null>(null);
  const [scorerUrl, setScorerUrl] = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);

  const [homeTeam, setHomeTeam] = useState(preHome || "Old Johns");
  const [awayTeam, setAwayTeam] = useState(preAway || "Stade Francais");
  const [division, setDivision] = useState(preDivision);
  const [venue, setVenue]       = useState(preVenue || VENUES[preHome] || "");

  const [minute, setMinute]   = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef(connectSocket());

  // Auto-create if preset params were provided
  useEffect(() => {
    if (!hasPreset) return;
    postMatch(preHome, preAway, preDivision, preVenue || VENUES[preHome] || "")
      .then((m) => setMatch(m))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  // run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Socket listener
  useEffect(() => {
    const socket = socketRef.current;
    const handler = (updated: LiveMatch) => {
      setMatch((prev) => prev?.id === updated.id ? updated : prev);
    };
    socket.on("match:update", handler);
    return () => {
      socket.off("match:update", handler);
      disconnectSocket();
    };
  }, []);

  // Clock
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setMinute((m) => {
          const next = m + 1;
          socketRef.current.emit("minute:update", { matchId: match?.id, minute: next });
          return next;
        });
      }, 60_000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, match?.id]);

  async function createMatch() {
    setLoading(true);
    setError(null);
    try {
      const m = await postMatch(homeTeam, awayTeam, division, venue || VENUES[homeTeam] || "");
      setMatch(m);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function emit(event: string, payload: unknown) {
    socketRef.current.emit(event, payload);
  }

  function startMatch()   { if (match) { setRunning(true);  emit("match:start",       match.id); } }
  function halfTime()     { if (match) { setRunning(false); emit("match:ht",           match.id); } }
  function secondHalf()   { if (match) { setRunning(true);  emit("match:second_half",  match.id); } }
  function finishMatch()  { if (match) { setRunning(false); emit("match:finish",        match.id); } }
  function undoLast()     { if (match) { emit("event:undo", match.id); } }
  function addEvent(team: "home" | "away", type: string, points: number) {
    if (!match) return;
    emit("event:add", { matchId: match.id, team, type, minute, points });
  }
  function resetMatch() { setMatch(null); setMinute(0); setRunning(false); setError(null); setScorerUrl(null); }

  async function generateScorerLink() {
    if (!match) return;
    const res = await fetch(`${API_URL}/api/v1/live/matches/${match.id}/scorer-token`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return;
    const { token } = await res.json();
    const webUrl = typeof window !== "undefined" ? window.location.origin : "";
    setScorerUrl(`${webUrl}/scorer?token=${token}`);
  }

  async function copyUrl() {
    if (!scorerUrl) return;
    await navigator.clipboard.writeText(scorerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
        <Radio className="h-5 w-5 animate-pulse text-red-500" />
        Creando partido…
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-900/20 p-6 flex items-start gap-3 max-w-lg">
        <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-red-400 text-sm">No se pudo conectar con la API</p>
          <p className="text-red-400/70 text-xs mt-1">{error}</p>
          <p className="text-muted-foreground text-xs mt-2">Asegúrate de que el servidor API está corriendo en <code className="text-foreground/80">localhost:4000</code></p>
          <button
            onClick={() => { setError(null); setLoading(false); }}
            className="mt-3 text-xs px-3 py-1.5 rounded bg-muted hover:bg-secondary text-foreground font-semibold transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  // ── Setup form ──
  if (!match) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
            <Radio className="h-5 w-5 text-red-500" /> Puntuación en Vivo
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Selecciona el partido para comenzar a marcar</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-6 max-w-lg space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">División</label>
            <select value={division} onChange={(e) => setDivision(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-red-500">
              {DIVISIONS.map((d) => <option key={d} value={d} className="bg-muted">{d}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Local</label>
              <select value={homeTeam} onChange={(e) => { setHomeTeam(e.target.value); setVenue(VENUES[e.target.value] ?? ""); }}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-red-500">
                {CLUBS.map((c) => <option key={c} value={c} className="bg-muted">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Visitante</label>
              <select value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-red-500">
                {CLUBS.map((c) => <option key={c} value={c} className="bg-muted">{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Cancha</label>
            <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)}
              placeholder="Nombre de la cancha"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-red-500" />
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-muted/50 border border-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClubBadge team={homeTeam} />
              <span className="font-bold text-sm">{homeTeam}</span>
            </div>
            <span className="text-muted-foreground/70 font-bold text-sm">vs</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{awayTeam}</span>
              <ClubBadge team={awayTeam} />
            </div>
          </div>

          <button onClick={createMatch} disabled={homeTeam === awayTeam}
            className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-secondary disabled:text-muted-foreground text-white font-bold text-sm transition-colors flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" /> Crear partido
          </button>
          {homeTeam === awayTeam && <p className="text-xs text-red-400 text-center">Los equipos deben ser distintos</p>}
        </div>
      </div>
    );
  }

  // ── Scoring interface ──
  const isLive     = match.status === "LIVE";
  const isHT       = match.status === "HT";
  const isFinished = match.status === "FINISHED";
  const isScheduled = match.status === "SCHEDULED";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
          <Radio className={`h-5 w-5 ${isLive ? "text-red-500 animate-pulse" : "text-muted-foreground"}`} />
          Puntuación en Vivo
        </h1>
        <button onClick={resetMatch}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
          <RotateCcw className="h-3.5 w-3.5" /> Nuevo partido
        </button>
      </div>

      {/* Scoreboard */}
      <div className="rounded-xl border border-border bg-card/60 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col items-center gap-2 flex-1">
            <ClubBadge team={match.homeTeam} size="lg" />
            <span className="font-bold text-sm text-center">{match.homeTeam}</span>
            <span className="text-muted-foreground/70 text-xs">{match.homeTries} tries</span>
          </div>

          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-5xl font-black tabular-nums">{match.homeScore}</span>
              <span className="text-muted-foreground/50 text-2xl">-</span>
              <span className="text-5xl font-black tabular-nums">{match.awayScore}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {isLive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
              <span className={`text-sm font-bold ${isLive ? "text-red-400" : isHT ? "text-amber-400" : isFinished ? "text-muted-foreground" : "text-muted-foreground"}`}>
                {isLive ? `${minute}'` : isHT ? "Descanso" : isFinished ? "Final" : "Próximo"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 flex-1">
            <ClubBadge team={match.awayTeam} size="lg" />
            <span className="font-bold text-sm text-center">{match.awayTeam}</span>
            <span className="text-muted-foreground/70 text-xs">{match.awayTries} tries</span>
          </div>
        </div>

        {/* Match controls */}
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          {isScheduled && (
            <button onClick={startMatch}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-1.5 transition-colors">
              <Play className="h-4 w-4" /> Iniciar partido
            </button>
          )}
          {isLive && (
            <>
              <button onClick={running ? () => setRunning(false) : () => setRunning(true)}
                className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary text-foreground font-bold text-sm flex items-center gap-1.5 transition-colors">
                {running ? <><Pause className="h-4 w-4" /> Pausar reloj</> : <><Play className="h-4 w-4" /> Reanudar reloj</>}
              </button>
              <button onClick={halfTime}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm flex items-center gap-1.5 transition-colors">
                <Clock className="h-4 w-4" /> Descanso
              </button>
            </>
          )}
          {isHT && (
            <button onClick={secondHalf}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-1.5 transition-colors">
              <Play className="h-4 w-4" /> Iniciar 2ª mitad
            </button>
          )}
          {(isLive || isHT) && (
            <button onClick={finishMatch}
              className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white font-bold text-sm flex items-center gap-1.5 transition-colors">
              <Square className="h-4 w-4" /> Finalizar
            </button>
          )}
        </div>

        {/* Scorer PWA link */}
        <div className="mt-4 pt-4 border-t border-border">
          {scorerUrl ? (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={scorerUrl}
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground/80 font-mono truncate"
              />
              <button
                onClick={copyUrl}
                className="flex-shrink-0 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary text-foreground text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                {copied ? <><Check className="h-3 w-3 text-emerald-400" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
              </button>
            </div>
          ) : (
            <button
              onClick={generateScorerLink}
              className="w-full py-2 rounded-lg bg-muted hover:bg-secondary border border-border text-foreground/80 hover:text-foreground font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Link2 className="h-3.5 w-3.5" /> Generar enlace para anotador
            </button>
          )}
        </div>

        {/* Manual minute adjust */}
        {(isLive || isHT) && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button onClick={() => setMinute((m) => Math.max(0, m - 1))}
              className="w-7 h-7 rounded bg-muted hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors">
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-muted-foreground text-xs font-mono w-20 text-center">Minuto: {minute}</span>
            <button onClick={() => setMinute((m) => m + 1)}
              className="w-7 h-7 rounded bg-muted hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors">
              <Plus className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Event buttons */}
      {(isLive || isHT) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {(["home", "away"] as const).map((side) => {
            const teamName = side === "home" ? match.homeTeam : match.awayTeam;
            return (
              <div key={side} className="rounded-xl border border-border bg-card/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <ClubBadge team={teamName} />
                  <div>
                    <p className="font-bold text-sm">{teamName}</p>
                    <p className="text-muted-foreground text-xs">{side === "home" ? "Local" : "Visitante"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_TYPES.map((ev) => (
                    <button key={ev.type} onClick={() => addEvent(side, ev.type, ev.points)}
                      className={`${ev.color} text-foreground font-bold text-xs py-2.5 px-3 rounded-lg transition-colors flex items-center justify-between`}>
                      <span>{ev.label}</span>
                      {ev.points > 0 && <span className="opacity-70 text-[10px]">+{ev.points}</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Event log */}
      {match.events.length > 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Registro de eventos</h3>
            <button onClick={undoLast}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
              <RotateCcw className="h-3 w-3" /> Deshacer último
            </button>
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {[...match.events].reverse().map((ev, i) => {
              const teamName = ev.team === "home" ? match.homeTeam : match.awayTeam;
              const evMeta = EVENT_TYPES.find((e) => e.type === ev.type);
              return (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground/70 w-7">{ev.minute}&apos;</span>
                    <ClubBadge team={teamName} size="sm" />
                    <span className="text-xs font-semibold text-foreground">{teamName}</span>
                    <span className="text-xs text-muted-foreground">{evMeta?.label ?? ev.type}</span>
                  </div>
                  {ev.points > 0 && <span className="text-xs font-bold text-emerald-400">+{ev.points}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Suspense boundary required by Next.js App Router for useSearchParams
export default function ScoringPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
        <Radio className="h-5 w-5 animate-pulse text-red-500" />
        Cargando…
      </div>
    }>
      <ScoringInner />
    </Suspense>
  );
}
