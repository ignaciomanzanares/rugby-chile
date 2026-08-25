"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Trophy, Medal, Gamepad2, X, Crown, Lock } from "lucide-react";
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

type RosterPlayer = { arusaId: string; playerName: string; clubSlug: string };
type LbEntry = {
  rank: number; squadId: string; userId: string; teamName: string; userName: string;
  totalPoints: number; playerCount: number;
  roundPoints: Record<number, number>; roster: RosterPlayer[];
  starters: string[]; superSubId: string | null; captainId: string | null;
};
type LbData = {
  entries: LbEntry[]; rounds: number[];
  roundWinners: Record<number, { userName: string; teamName: string; points: number }>;
  revealedClubs?: string[]; // clubes cuyo partido de la fecha ya arrancó (anti-copia)
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
      .then((d) => setData(d && Array.isArray(d.entries) ? d : { entries: [], rounds: [], roundWinners: {}, revealedClubs: [] }))
      .catch(() => setData({ entries: [], rounds: [], roundWinners: {}, revealedClubs: [] }))
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

        {/* Selector de fecha (Total o una jornada) */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
          <FechaChip active={fecha === "total"} onClick={() => setFecha("total")}>Total</FechaChip>
          {data.rounds.map((r) => (
            <FechaChip key={r} active={fecha === r} onClick={() => setFecha(r)}>Fecha {r}</FechaChip>
          ))}
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
        <TeamViewModal entry={viewTeam} fecha={fecha} onClose={() => setViewTeam(null)}
          revealedClubs={data.revealedClubs ?? []} isOwn={user?.id === viewTeam.userId} />
      )}
    </div>
  );
}

// ── Ver el equipo de un usuario (XV en cancha, solo lectura) ──────────────────
function TeamViewModal({ entry, fecha, onClose, revealedClubs, isOwn }: {
  entry: LbEntry; fecha: number | "total"; onClose: () => void; revealedClubs: string[]; isOwn: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Un jugador se ve solo si es TU equipo, o si el club ya arrancó su partido de
  // la fecha. Los que juegan más tarde (ej. domingo) quedan ocultos hasta el kickoff.
  const revealed = useMemo(() => new Set(revealedClubs), [revealedClubs]);
  const canSee = (clubSlug: string) => isOwn || revealed.has(clubSlug);

  const rosterById = useMemo(() => new Map(entry.roster.map((r) => [r.arusaId, r])), [entry.roster]);
  const seated = useMemo(() => {
    const s: Record<string, string | null> = Object.fromEntries(FORMATION.map((f) => [f.id, null]));
    const taken = new Set<string>();
    for (const slot of FORMATION) {
      const id = entry.starters.find((r) => !taken.has(r) && getPositionInfo(r)?.primary === slot.position)
        ?? entry.starters.find((r) => !taken.has(r) && getPositionInfo(r)?.secondary === slot.position);
      if (id) { s[slot.id] = id; taken.add(id); }
    }
    const rest = entry.starters.filter((r) => !taken.has(r));
    for (const slot of FORMATION) { if (!s[slot.id] && rest.length) { const id = rest.shift()!; s[slot.id] = id; taken.add(id); } }
    return s;
  }, [entry.starters]);

  const shownPoints = fecha === "total" ? entry.totalPoints : entry.roundPoints[fecha] ?? 0;
  const superSub = entry.superSubId ? rosterById.get(entry.superSubId) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="min-w-0">
            <h3 className="font-bold truncate">{entry.teamName}</h3>
            <p className="text-xs text-muted-foreground">{entry.userName} · {fecha === "total" ? "Total" : `Fecha ${fecha}`}: <b className="text-amber-400">{shownPoints} pts</b></p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <div className="overflow-y-auto p-3">
          <div className="relative rounded-2xl overflow-hidden border border-emerald-900/50"
            style={{ aspectRatio: "3 / 3.5", background: "linear-gradient(180deg,#0d5c2f 0%,#0a4d28 50%,#083d20 100%)" }}>
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <div className="absolute inset-x-[5%] top-[2.5%] bottom-[2.5%] border border-white/30 rounded" />
              <div className="absolute left-[5%] right-[5%] top-1/2 border-t border-dashed border-white/30" />
            </div>
            {FORMATION.map((slot) => {
              const id = seated[slot.id];
              const p = id ? rosterById.get(id) : null;
              const isCap = entry.captainId === id;
              return (
                <div key={slot.id} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center w-[54px]" style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
                  {p ? (
                    canSee(p.clubSlug) ? (
                      <>
                        {isCap && <span className="absolute -top-1 -right-0 bg-yellow-400 text-black rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black z-10">C</span>}
                        <MiniLogo slug={p.clubSlug} />
                        <span className="text-[9px] font-bold text-white text-center leading-none mt-0.5 truncate w-[54px]">{surname(p.playerName)}</span>
                      </>
                    ) : (
                      // oculto: el club aún no jugó
                      <>
                        <div className="w-8 h-8 rounded-full bg-black/30 ring-2 ring-white/20 flex items-center justify-center"><Lock className="h-3.5 w-3.5 text-white/60" /></div>
                        <span className="text-[9px] font-bold text-white/50 text-center leading-none mt-0.5">{POSITION_SHORT[slot.position as Position]}</span>
                      </>
                    )
                  ) : (
                    <div className="w-7 h-7 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center text-[8px] text-white/70">{POSITION_SHORT[slot.position as Position]}</div>
                  )}
                </div>
              );
            })}
          </div>

          {superSub && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-orange-500/40 bg-orange-500/5 p-3">
              {canSee(superSub.clubSlug) ? (
                <>
                  <MiniLogo slug={superSub.clubSlug} />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-orange-400 font-bold">Super Sub</p>
                    <p className="text-sm font-semibold truncate">{superSub.playerName}</p>
                  </div>
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
