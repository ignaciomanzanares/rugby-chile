"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Trophy, Medal, Gamepad2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { LeagueBar } from "@/components/league-bar";
import { FANTASY_LIVE, FantasyComingSoon } from "@/lib/fantasy-flags";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const DIVISIONS = [
  { key: "primera",        label: "Primera",        short: "Primera" },
  { key: "intermedia",     label: "Intermedia",     short: "Inter" },
  { key: "pre-intermedia", label: "Pre-Intermedia", short: "Pre" },
];

type LeaderboardEntry = {
  rank: number;
  userId: string;
  teamName: string;
  userName: string;
  totalPoints: number;
  playerCount: number;
};

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

  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [league, setLeague] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = `${API_URL}/api/v1/fantasy/leaderboard?division=${division}${league ? `&league=${league}` : ""}`;
    fetch(url, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [division, league]);

  const divLabel = DIVISIONS.find((d) => d.key === division)?.label ?? division;

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
          <Link
            href={`/fantasy/team?division=${division}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-600/40 bg-amber-600/10 hover:bg-amber-600/20 transition-colors text-sm font-semibold text-amber-400"
          >
            <Gamepad2 className="h-4 w-4" />
            Mi equipo
          </Link>
        </div>

        {/* Division tabs */}
        <div className="flex gap-1 p-1 bg-card border border-border rounded-lg mb-6">
          {DIVISIONS.map((div) => (
            <button
              key={div.key}
              onClick={() => router.push(`/fantasy/leaderboard?division=${div.key}`)}
              className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${
                division === div.key
                  ? "bg-amber-500 text-zinc-950"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="sm:hidden">{div.short}</span>
              <span className="hidden sm:inline">{div.label}</span>
            </button>
          ))}
        </div>

        {/* Selector de liga (General o una privada) */}
        <div className="mb-6">
          <LeagueBar value={league} onChange={setLeague} />
        </div>

        <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-2.5 border-b border-border text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest">
            <span>#</span>
            <span>Equipo</span>
            <span className="text-right">Puntos</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-muted-foreground/70 text-sm">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground mb-3">Aún no hay equipos en {divLabel}</p>
              <Link href={`/fantasy/team?division=${division}`} className="text-amber-500 hover:text-amber-400 text-sm font-semibold">
                Sé el primero en armar tu equipo →
              </Link>
            </div>
          ) : (
            rows.map((row) => {
              const isMe = user?.id === row.userId;
              return (
                <div
                  key={row.userId}
                  className={`grid grid-cols-[auto_1fr_auto] gap-3 items-center px-4 py-3 border-b border-border/60 last:border-0 transition-colors ${
                    isMe ? "bg-amber-600/10" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-center w-5">
                    <RankBadge rank={row.rank} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${isMe ? "text-amber-300" : "text-foreground"}`}>
                      {row.teamName} {isMe && <span className="text-xs font-normal text-amber-600">(tú)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.userName} · {row.playerCount} jugadores</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-black ${row.rank <= 3 ? "text-amber-400" : "text-foreground"}`}>
                      {row.totalPoints}
                    </span>
                    <span className="text-xs text-muted-foreground/70 ml-0.5">pts</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!user && (
          <div className="mt-6 rounded-xl border border-border bg-card/40 p-6 text-center">
            <p className="text-muted-foreground mb-3">Crea una cuenta para participar</p>
            <Link href="/login" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 transition-colors text-sm font-bold text-white">
              Crear cuenta gratis
            </Link>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/fantasy" className="text-muted-foreground/70 hover:text-muted-foreground text-sm transition-colors">
            ← Volver a Fantasy
          </Link>
        </div>

      </div>
    </div>
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
