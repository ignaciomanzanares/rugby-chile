"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Mail, Shield, Calendar, LogOut, Target, Trophy, Users, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";

const ROLE_LABEL: Record<string, string> = { USER: "Hincha", ADMIN: "Administrador" };

export default function PerfilPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  // Guard: not logged in → send to login.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Cargando…</div>
      </div>
    );
  }

  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const activity = [
    { href: "/predict", icon: Target, title: "Predicciones", desc: "Pronostica los partidos de cada fecha", color: "text-emerald-400" },
    { href: "/leaderboard", icon: Trophy, title: "Tabla de predicciones", desc: "Cómo vas contra el resto", color: "text-amber-400" },
    { href: "/fantasy/team", icon: Users, title: "Mi equipo fantasy", desc: "Arma y gestiona tu equipo", color: "text-blue-400" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-10 max-w-3xl space-y-8">

        {/* Identity card */}
        <div className="rounded-2xl border border-border bg-card/50 p-6 md:p-8">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-2xl font-black text-white flex-shrink-0 ring-2 ring-border">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight truncate">{user.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-600/30">
                  <Shield className="h-3 w-3" /> {ROLE_LABEL[user.role] ?? user.role}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-muted/40 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground/90 truncate">{user.email}</span>
            </div>
            {memberSince && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-muted/40 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground/90">Miembro desde {memberSince}</span>
              </div>
            )}
          </div>
        </div>

        {/* Activity */}
        <section>
          <h2 className="font-bold uppercase tracking-widest text-sm mb-4">Tu actividad</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {activity.map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.href} href={a.href}
                  className="group rounded-xl border border-border bg-card/50 p-5 hover:border-foreground/30 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <Icon className={`h-5 w-5 ${a.color}`} />
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                  </div>
                  <p className="font-bold text-sm text-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Logout */}
        <div className="pt-2">
          <button
            onClick={() => logout()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border hover:border-red-700 text-muted-foreground hover:text-red-400 font-semibold text-sm transition-colors"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>

      </div>
    </div>
  );
}
