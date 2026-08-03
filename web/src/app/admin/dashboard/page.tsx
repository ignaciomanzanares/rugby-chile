"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Trophy, Users, Calendar, Radio, Users2, Target, Gamepad2, ArrowUpRight, UserCheck } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Overview = {
  counts: { users: number; predictions: number; predictors: number; fantasySquads: number; currentRound: number | null; live: number };
  predictionsByRound: { round: number; predictions: number; users: number }[];
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/admin/overview`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => {});
  }, []);

  const n = (v: number | null | undefined) => (v == null ? "—" : String(v));

  const stats = [
    { name: "Clubes", value: "10", icon: Trophy, color: "text-amber-400", bg: "bg-amber-400/10" },
    { name: "Divisiones", value: "3", icon: Users, color: "text-blue-400", bg: "bg-blue-400/10" },
    { name: "Fecha", value: n(data?.counts.currentRound), icon: Calendar, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { name: "En vivo", value: n(data?.counts.live), icon: Radio, color: "text-red-400", bg: "bg-red-400/10" },
  ];

  const activity = [
    { name: "Usuarios", value: n(data?.counts.users), icon: Users2, color: "text-blue-400", bg: "bg-blue-400/10" },
    { name: "Con predicción", value: n(data?.counts.predictors), icon: Target, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { name: "Predicciones", value: n(data?.counts.predictions), icon: UserCheck, color: "text-amber-400", bg: "bg-amber-400/10" },
    { name: "Equipos fantasy", value: n(data?.counts.fantasySquads), icon: Gamepad2, color: "text-purple-400", bg: "bg-purple-400/10" },
  ];

  const recentRounds = data ? [...data.predictionsByRound].reverse().slice(0, 6) : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wide">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Primera División{data?.counts.currentRound ? ` · Fecha ${data.counts.currentRound}` : ""}
          </p>
        </div>
        <Link
          href="/admin/scoring"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
        >
          <Radio className="h-4 w-4" /> Marcar partido
        </Link>
      </div>

      {/* Estado del torneo */}
      <div>
        <h2 className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-3">Torneo</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.name} className="rounded-xl border border-border bg-card/50 p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actividad (real, desde la DB) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold uppercase tracking-widest text-xs text-muted-foreground">Actividad</h2>
          <Link href="/admin/users" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            Ver usuarios <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {activity.map((s) => (
            <Link key={s.name} href="/admin/users" className="rounded-xl border border-border bg-card/50 p-5 flex items-center gap-4 hover:border-foreground/30 transition-colors">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.name}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Predicciones por fecha */}
      {recentRounds.length > 0 && (
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-sm uppercase tracking-widest">Predicciones por fecha</h2>
          </div>
          <div className="divide-y divide-border">
            {recentRounds.map((r) => (
              <div key={r.round} className="px-5 py-3 flex items-center justify-between gap-3">
                <span className="text-sm text-foreground/80">Fecha {r.round}</span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-black text-foreground tabular-nums">{r.predictions}</span> pred · {r.users} {r.users === 1 ? "hincha" : "hinchas"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="rounded-xl border border-border bg-card/50 p-5">
        <h2 className="font-bold text-sm uppercase tracking-widest mb-4 text-muted-foreground">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/users"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-muted hover:bg-secondary text-sm font-semibold text-foreground transition-colors">
            <Users2 className="h-4 w-4 text-blue-400" /> Usuarios
          </Link>
          <Link href="/admin/lineups"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-muted hover:bg-secondary text-sm font-semibold text-foreground transition-colors">
            <UserCheck className="h-4 w-4 text-emerald-400" /> Formaciones
          </Link>
          <Link href="/admin/scoring"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-bold text-white transition-colors">
            <Radio className="h-4 w-4" /> Puntuación en vivo
          </Link>
        </div>
      </div>
    </div>
  );
}
