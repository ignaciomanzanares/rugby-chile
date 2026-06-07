"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy, Target, Medal, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  email: string;
  totalPoints: number;
  predictions: number;
  exact: number;
  correct: number;
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Medal className="h-5 w-5 text-amber-400" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-foreground/80" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="w-5 text-center text-sm font-bold text-muted-foreground">{rank}</span>;
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myStats, setMyStats] = useState<{ totalPoints: number; predictions: number } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/predict/leaderboard`)
      .then((r) => r.json())
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch(`${API_URL}/api/v1/predict/my`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setMyStats({ totalPoints: data.totalPoints, predictions: data.predictions?.length ?? 0 }))
      .catch(console.error);
  }, [user]);

  const myEntry = user ? rows.find((r) => r.userId === user.id) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-5 w-5 text-amber-400" />
              <h1 className="text-2xl font-black text-foreground">Tabla de predicciones</h1>
            </div>
            <p className="text-muted-foreground text-sm">Temporada 2026 · Top 10 ARUSA</p>
          </div>
          <Link
            href="/predict"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-600/40 bg-amber-600/10 hover:bg-amber-600/20 transition-colors text-sm font-semibold text-amber-400"
          >
            <Target className="h-4 w-4" />
            Predecir
            <ChevronRight className="h-3.5 w-3.5 text-amber-600/60" />
          </Link>
        </div>

        {/* My card (if logged in and not in top) */}
        {user && myStats && !myEntry && (
          <div className="rounded-xl border border-border bg-card/60 p-4 mb-4">
            <p className="text-xs text-muted-foreground mb-2">Tu posición</p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-foreground/80">
                {user.name[0]}
              </div>
              <div className="flex-1">
                <span className="text-sm font-bold text-foreground">{user.name}</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-amber-400">{myStats.totalPoints}</span>
                <span className="text-xs text-muted-foreground ml-1">pts</span>
              </div>
            </div>
            {myStats.predictions === 0 && (
              <p className="text-xs text-muted-foreground/70 mt-2">
                Aún no has predicho.{" "}
                <Link href="/predict" className="text-amber-500 hover:text-amber-400">Hacer predicciones →</Link>
              </p>
            )}
          </div>
        )}

        {/* Leaderboard table */}
        <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-2.5 border-b border-border text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest">
            <span>#</span>
            <span>Jugador</span>
            <span className="text-center">Exactos</span>
            <span className="text-center">Correctos</span>
            <span className="text-right">Puntos</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-muted-foreground/70">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground mb-3">Aún no hay predicciones</p>
              <Link href="/predict" className="text-amber-500 hover:text-amber-400 text-sm font-semibold">
                Sé el primero en predecir →
              </Link>
            </div>
          ) : (
            rows.map((row) => {
              const isMe = user?.id === row.userId;
              return (
                <div
                  key={row.userId}
                  className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center px-4 py-3 border-b border-border/60 last:border-0 transition-colors ${
                    isMe ? "bg-amber-600/10" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-center w-5">
                    <RankBadge rank={row.rank} />
                  </div>

                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      row.rank === 1 ? "bg-amber-500/20 text-amber-400" :
                      row.rank === 2 ? "bg-secondary/20 text-foreground/80" :
                      row.rank === 3 ? "bg-amber-700/20 text-amber-600" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {row.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold truncate ${isMe ? "text-amber-300" : "text-foreground"}`}>
                        {row.name} {isMe && <span className="text-xs font-normal text-amber-600">(tú)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground/70">{row.predictions} predicciones</p>
                    </div>
                  </div>

                  <div className="text-center">
                    <span className="text-sm font-bold text-emerald-400">{row.exact}</span>
                  </div>

                  <div className="text-center">
                    <span className="text-sm font-bold text-blue-400">{row.correct}</span>
                  </div>

                  <div className="text-right">
                    <span className={`text-lg font-black ${
                      row.rank <= 3 ? "text-amber-400" : "text-foreground"
                    }`}>
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
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 transition-colors text-sm font-bold text-white"
            >
              Crear cuenta gratis
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
