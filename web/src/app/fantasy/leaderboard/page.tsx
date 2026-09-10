"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Trophy, Medal, Gamepad2, X, Crown, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { LeagueBar } from "@/components/league-bar";
import { FANTASY_LIVE, FantasyComingSoon } from "@/lib/fantasy-flags";
import { FORMATION, POSITION_SHORT, getPositionInfo, type Position } from "@/lib/fantasy";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const DIVISIONS = [
  { key: "primera",        label: "Primera",        short: "Primera" },
  { key: "intermedia",     label: "Intermedia",     short: "Inter" },
  { key: "pre-intermedia", label: "Pre-Intermedia", short: "Pre" },
];

type LbEntry = {
  rank: number; squadId: string; userId: string; teamName: string; userName: string;
  totalPoints: number; playerCount: number; roundPoints: Record<number, number>;
};
type LbData = {
  entries: LbEntry[]; rounds: number[];
  roundWinners: Record<number, { userName: string; teamName: string; points: number }>;
  currentRound?: number;   // fecha en juego: la única que se oculta
};
// El XV de un equipo en una fecha (GET /fantasy/squad/:id?round=N). El servidor
// ya filtró lo que no corresponde ver: `hidden` son los titulares que no vinieron.
type SquadPlayer = { arusaId: string; playerName: string; clubSlug: string; points: number; played: boolean; wasSub: boolean };
type SquadView = {
  teamName: string; userName: string; round: number; currentRound: number; isOwn: boolean;
  points: number; scored: boolean; captainId: string | null;
  starters: string[]; superSubId: string | null; players: SquadPlayer[]; hidden: number;
};

// Apellido paterno (penúltima palabra; última si solo hay nombre+apellido).
function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  let s = parts.length <= 1 ? (parts[0] ?? "") : parts.length === 2 ? parts[1] : parts[parts.length - 2];
  if (s && s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|[-\s])\p{L}/gu, (c) => c.toUpperCase());
  return s;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Medal className="h-5 w-5 text-amber-400" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-foreground/80" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="w-5 text-center text-sm font-bold text-muted-foreground">{rank}</span>;
}

function LeaderboardInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const division = searchParams.get("division") ?? "primera";

  const [data, setData] = useState<LbData>({ entries: [], rounds: [], roundWinners: {} });
  const [loading, setLoading] = useState(true);
  const [league, setLeague] = useState<string | null>(null);
  const [fecha, setFecha] = useState<number | "total">("total"); // qué columna de puntos mostrar
  const [viewTeam, setViewTeam] = useState<LbEntry | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = `${API_URL}/api/v1/fantasy/leaderboard?division=${division}${league ? `&league=${league}` : ""}`;
    fetch(url, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setData(d && Array.isArray(d.entries) ? d : { entries: [], rounds: [], roundWinners: {} }))
      .catch(() => setData({ entries: [], rounds: [], roundWinners: {} }))
      .finally(() => setLoading(false));
  }, [division, league]);

  const divLabel = DIVISIONS.find((d) => d.key === division)?.label ?? division;

  // Filas ordenadas según la fecha elegida (Total o una jornada).
  const rows = useMemo(() => {
    const pointsOf = (e: LbEntry) => (fecha === "total" ? e.totalPoints : e.roundPoints[fecha] ?? 0);
    return [...data.entries]
      .sort((a, b) => pointsOf(b) - pointsOf(a))
      .map((e, i) => ({ ...e, shownPoints: pointsOf(e), shownRank: i + 1 }));
  }, [data.entries, fecha]);

  const winner = fecha !== "total" ? data.roundWinners[fecha] : null;

  // Total + cada fecha puntuada, en orden: lo que recorren las flechas.
  const opcionesFecha = useMemo<(number | "total")[]>(() => ["total", ...data.rounds], [data.rounds]);
  const idxFecha = opcionesFecha.indexOf(fecha);
  const vecina = (paso: number) => opcionesFecha[Math.min(Math.max(idxFecha + paso, 0), opcionesFecha.length - 1)] ?? "total";

  // Fechas por las que se puede viajar dentro del modal: las puntuadas y además
  // la que está en juego (ahí el equipo ajeno sale tapado hasta que juegue).
  const fechasModal = useMemo(() => {
    const set = new Set(data.rounds);
    if (data.currentRound) set.add(data.currentRound);
    return [...set].sort((a, b) => a - b);
  }, [data.rounds, data.currentRound]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">

        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-5 w-5 text-amber-400" />
              <h1 className="text-2xl font-black text-foreground">Fantasy Leaderboard</h1>
            </div>
            <p className="text-muted-foreground text-sm">{divLabel} · Temporada 2026</p>
          </div>
          <Link href={`/fantasy/team?division=${division}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-600/40 bg-amber-600/10 hover:bg-amber-600/20 transition-colors text-sm font-semibold text-amber-400">
            <Gamepad2 className="h-4 w-4" />Mi equipo
          </Link>
        </div>

        {/* Division tabs */}
        <div className="flex gap-1 p-1 bg-card border border-border rounded-lg mb-4">
          {DIVISIONS.map((div) => (
            <button key={div.key} onClick={() => router.push(`/fantasy/leaderboard?division=${div.key}`)}
              className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${division === div.key ? "bg-amber-500 text-zinc-950" : "text-muted-foreground hover:text-foreground"}`}>
              <span className="sm:hidden">{div.short}</span>
              <span className="hidden sm:inline">{div.label}</span>
            </button>
          ))}
        </div>

        {/* Selector de fecha (Total o una jornada), con flechas para recorrerlas */}
        <div className="flex items-center gap-1.5 mb-4">
          <button onClick={() => setFecha(vecina(-1))} disabled={idxFecha <= 0} aria-label="Fecha anterior"
            className="flex-none w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <FechaChip active={fecha === "total"} onClick={() => setFecha("total")}>Total</FechaChip>
            {data.rounds.map((r) => (
              <FechaChip key={r} active={fecha === r} onClick={() => setFecha(r)}>Fecha {r}</FechaChip>
            ))}
          </div>
          <button onClick={() => setFecha(vecina(1))} disabled={idxFecha >= opcionesFecha.length - 1} aria-label="Fecha siguiente"
            className="flex-none w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Selector de liga */}
        <div className="mb-4"><LeagueBar value={league} onChange={setLeague} /></div>

        {/* Mejor de la fecha */}
        {winner && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-transparent px-4 py-3">
            <Crown className="h-6 w-6 text-amber-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-amber-400/80 font-bold">Mejor de la Fecha {fecha}</p>
              <p className="text-sm font-bold truncate">{winner.teamName} <span className="text-muted-foreground font-normal">· {winner.userName}</span></p>
            </div>
            <span className="ml-auto text-2xl font-black text-amber-400 tabular-nums">{winner.points}</span>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-2.5 border-b border-border text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest">
            <span>#</span><span>Equipo</span><span className="text-right">Puntos</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-muted-foreground/70 text-sm">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground mb-3">Aún no hay equipos en {divLabel}</p>
              <Link href={`/fantasy/team?division=${division}`} className="text-amber-500 hover:text-amber-400 text-sm font-semibold">Sé el primero en armar tu equipo →</Link>
            </div>
          ) : (
            rows.map((row) => {
              const isMe = user?.id === row.userId;
              return (
                <button key={row.squadId} onClick={() => setViewTeam(row)}
                  className={`w-full grid grid-cols-[auto_1fr_auto] gap-3 items-center px-4 py-3 border-b border-border/60 last:border-0 text-left transition-colors ${isMe ? "bg-amber-600/10 hover:bg-amber-600/20" : "hover:bg-muted/40"}`}>
                  <div className="flex items-center justify-center w-5"><RankBadge rank={row.shownRank} /></div>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${isMe ? "text-amber-300" : "text-foreground"}`}>
                      {row.teamName} {isMe && <span className="text-xs font-normal text-amber-600">(tú)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.userName} · toca para ver el equipo</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-black ${row.shownRank <= 3 ? "text-amber-400" : "text-foreground"}`}>{row.shownPoints}</span>
                    <span className="text-xs text-muted-foreground/70 ml-0.5">pts</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {!user && (
          <div className="mt-6 rounded-xl border border-border bg-card/40 p-6 text-center">
            <p className="text-muted-foreground mb-3">Crea una cuenta para participar</p>
            <Link href="/login" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 transition-colors text-sm font-bold text-white">Crear cuenta gratis</Link>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/fantasy" className="text-muted-foreground/70 hover:text-muted-foreground text-sm transition-colors">← Volver a Fantasy</Link>
        </div>
      </div>

      {viewTeam && (
        <TeamViewModal entry={viewTeam} rounds={fechasModal} onClose={() => setViewTeam(null)}
          initialRound={typeof fecha === "number" ? fecha : (data.rounds[data.rounds.length - 1] ?? data.currentRound ?? 1)} />
      )}
    </div>
  );
}

// ── Ver el equipo de otro (mismo XV en cancha que "Mi equipo", solo lectura) ──
//
// El XV lo sirve la API por fecha, no el leaderboard: así se puede viajar por
// las jornadas de cualquier equipo, y el anti-copia de la fecha en juego lo
// aplica el servidor (los jugadores tapados ni siquiera llegan al navegador).
function TeamViewModal({ entry, rounds, initialRound, onClose }: {
  entry: LbEntry; rounds: number[]; initialRound: number; onClose: () => void;
}) {
  const [round, setRound] = useState(initialRound);
  const [view, setView] = useState<SquadView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const i = rounds.indexOf(round);
        const j = e.key === "ArrowLeft" ? i - 1 : i + 1;
        if (i >= 0 && j >= 0 && j < rounds.length) setRound(rounds[j]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, rounds, round]);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    fetch(`${API_URL}/api/v1/fantasy/squad/${entry.squadId}?round=${round}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d: SquadView) => { if (vivo && d && Array.isArray(d.starters)) setView(d); })
      .catch(() => { if (vivo) setView(null); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [entry.squadId, round]);

  const byId = useMemo(() => new Map((view?.players ?? []).map((p) => [p.arusaId, p])), [view]);

  // Sienta a los que sí llegaron en su puesto; los que faltan (tapados) quedan
  // como candado en los slots libres.
  const seated = useMemo(() => {
    const s: Record<string, string | null> = Object.fromEntries(FORMATION.map((f) => [f.id, null]));
    const ids = view?.starters ?? [];
    const taken = new Set<string>();
    for (const slot of FORMATION) {
      const id = ids.find((r) => !taken.has(r) && getPositionInfo(r)?.primary === slot.position)
        ?? ids.find((r) => !taken.has(r) && getPositionInfo(r)?.secondary === slot.position);
      if (id) { s[slot.id] = id; taken.add(id); }
    }
    const rest = ids.filter((r) => !taken.has(r));
    for (const slot of FORMATION) { if (!s[slot.id] && rest.length) { const id = rest.shift()!; s[slot.id] = id; taken.add(id); } }
    return s;
  }, [view]);

  const tapados = view?.hidden ?? 0;
  // Los titulares que el servidor no mandó ocupan los primeros puestos libres.
  const conCandado = useMemo(() => {
    const libres = FORMATION.filter((f) => !seated[f.id]).map((f) => f.id);
    return new Set(libres.slice(0, tapados));
  }, [seated, tapados]);
  const idx = rounds.indexOf(round);
  const superSub = view?.superSubId ? byId.get(view.superSubId) : null;
  const subPts = superSub && superSub.played ? Math.round(superSub.points * (superSub.wasSub ? 2 : 0.5)) : 0;
  const conPuntos = view?.scored ?? false;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="min-w-0">
            <h3 className="font-bold truncate">{entry.teamName}</h3>
            <p className="text-xs text-muted-foreground">
              {entry.userName} · Fecha {round}: <b className="text-amber-400">{conPuntos ? `${view?.points ?? 0} pts` : "por jugar"}</b>
              <span className="text-muted-foreground/60"> · Total {entry.totalPoints}</span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <div className="overflow-y-auto p-3">
          <div className={`relative rounded-2xl overflow-hidden border border-emerald-900/50 transition-opacity ${loading ? "opacity-60" : ""}`}
            style={{ aspectRatio: "3 / 3.5", background: "linear-gradient(180deg,#0d5c2f 0%,#0a4d28 50%,#083d20 100%)" }}>
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <div className="absolute inset-x-[5%] top-[2.5%] bottom-[2.5%] border border-white/30 rounded" />
              <div className="absolute left-[5%] right-[5%] top-1/2 border-t border-dashed border-white/30" />
            </div>

            {/* Viajar por las fechas, igual que en Mi equipo */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-black/35 rounded-full px-1 py-0.5 border border-amber-400/50">
              <button disabled={idx <= 0} onClick={() => setRound(rounds[idx - 1])} aria-label="Fecha anterior"
                className="w-6 h-6 flex items-center justify-center text-amber-300 hover:text-white disabled:opacity-25"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-xs font-black text-amber-200 tabular-nums px-1 whitespace-nowrap">Fecha {round}</span>
              <button disabled={idx < 0 || idx >= rounds.length - 1} onClick={() => setRound(rounds[idx + 1])} aria-label="Fecha siguiente"
                className="w-6 h-6 flex items-center justify-center text-amber-300 hover:text-white disabled:opacity-25"><ChevronRight className="h-4 w-4" /></button>
            </div>

            {FORMATION.map((slot) => {
              const id = seated[slot.id];
              const p = id ? byId.get(id) : null;
              const isCap = !!id && view?.captainId === id;
              const tapado = !p && conCandado.has(slot.id);
              return (
                <div key={slot.id} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center w-[54px]" style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
                  {p ? (
                    <>
                      {isCap && <span className="absolute -top-1 -right-0 bg-yellow-400 text-black rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black z-10">C</span>}
                      <MiniLogo slug={p.clubSlug} />
                      <span className="text-[9px] font-bold text-white text-center leading-none mt-0.5 truncate w-[54px]">{surname(p.playerName)}</span>
                      {conPuntos && (
                        <span className={`text-[9px] font-black tabular-nums leading-tight ${p.played ? "text-emerald-300" : "text-white/40"}`}>
                          {p.played ? `${isCap ? p.points * 2 : p.points} pts` : "no jugó"}
                        </span>
                      )}
                    </>
                  ) : tapado ? (
                    <>
                      <div className="w-8 h-8 rounded-full bg-black/30 ring-2 ring-white/20 flex items-center justify-center"><Lock className="h-3.5 w-3.5 text-white/60" /></div>
                      <span className="text-[9px] font-bold text-white/50 text-center leading-none mt-0.5">{POSITION_SHORT[slot.position as Position]}</span>
                    </>
                  ) : (
                    <div className="w-7 h-7 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center text-[8px] text-white/70">{POSITION_SHORT[slot.position as Position]}</div>
                  )}
                </div>
              );
            })}
          </div>

          {tapados > 0 && (
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Fecha en juego: cada jugador se destapa cuando arranca el partido de su club. Las fechas ya jugadas se ven completas.
            </p>
          )}

          {(superSub || tapados > 0) && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-orange-500/40 bg-orange-500/5 p-3">
              {superSub ? (
                <>
                  <MiniLogo slug={superSub.clubSlug} />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-orange-400 font-bold">Super Sub</p>
                    <p className="text-sm font-semibold truncate">{superSub.playerName}</p>
                  </div>
                  {conPuntos && (
                    <span className={`ml-auto text-sm font-black tabular-nums ${superSub.played ? "text-emerald-400" : "text-muted-foreground"}`}>
                      {superSub.played ? `${subPts} pts` : "no jugó"}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center"><Lock className="h-4 w-4 text-muted-foreground" /></div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-orange-400 font-bold">Super Sub</p>
                    <p className="text-sm text-muted-foreground">Se revela al jugar</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniLogo({ slug }: { slug: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/clubs/${slug}.jpg`} alt="" className="w-8 h-8 rounded-full ring-2 ring-white/20 object-cover bg-white"
    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />;
}

function FechaChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex-none px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${active ? "bg-amber-500 text-zinc-950 border-amber-400" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}

export default function FantasyLeaderboardPage() {
  if (!FANTASY_LIVE) return <FantasyComingSoon />;
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LeaderboardInner />
    </Suspense>
  );
}
