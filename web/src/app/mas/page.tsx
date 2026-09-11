"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Radio, Newspaper, Users, BookOpen, Trophy, User, ShieldAlert,
  LogOut, LogIn, ChevronRight, Calendar, BarChart3, TrendingUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { PushToggle } from "@/components/push-toggle";

// Todo lo que no entra en las cuatro pestañas de abajo. El orden es el de uso:
// primero lo que se mira un sábado, después lo de consulta.
const SECCIONES: Array<{ titulo: string; items: Array<{ href: string; label: string; desc: string; icon: typeof Radio }> }> = [
  {
    titulo: "El torneo",
    items: [
      { href: "/live", label: "En vivo", desc: "Marcador y minuto a minuto", icon: Radio },
      { href: "/news", label: "Noticias", desc: "Últimas notas del torneo", icon: Newspaper },
      { href: "/teams", label: "Clubes y jugadores", desc: "Los 10 equipos y sus planteles", icon: Users },
      { href: "/reglamento", label: "Reglamento", desc: "Acuerdos ARUSA 2026", icon: BookOpen },
    ],
  },
  {
    titulo: "Temporada",
    items: [
      { href: "/temporada?tab=partidos", label: "Fixture y resultados", desc: "Fecha por fecha", icon: Calendar },
      { href: "/temporada?tab=tabla", label: "Tabla", desc: "Las tres divisiones", icon: Trophy },
      { href: "/temporada?tab=stats", label: "Estadísticas", desc: "Tries, puntos y líderes", icon: BarChart3 },
      { href: "/proyeccion", label: "Proyección", desc: "Cómo termina el torneo", icon: TrendingUp },
    ],
  },
];

export default function MasPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-gradient-to-br from-[#1a365d] to-[#0f172a] text-white">
        <div className="container mx-auto px-4 pt-8 pb-6">
          <h1 className="text-3xl font-black tracking-tight">Más</h1>
          <p className="text-white/70 text-sm font-semibold mt-0.5">Todo lo demás del Top 10</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 pb-24 space-y-6 max-w-2xl">
        {/* Cuenta */}
        <section className="rounded-2xl border border-border bg-card/40 overflow-hidden">
          {user ? (
            <>
              <Fila href="/perfil" icon={User} label={user.name ?? "Mi perfil"} desc="Tu club, tus predicciones y avisos" />
              <Fila href="/leaderboard" icon={Trophy} label="Ranking de predicciones" desc="Cómo vas contra el resto" />
              {user.role === "ADMIN" && (
                <Fila href="/admin/dashboard" icon={ShieldAlert} label="Administración" desc="Usuarios y notificaciones" />
              )}
              <button onClick={async () => { await logout(); router.push("/"); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors border-t border-border/60">
                <LogOut className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold text-red-500">Cerrar sesión</span>
              </button>
            </>
          ) : (
            <Fila href="/login" icon={LogIn} label="Iniciar sesión" desc="Para jugar el fantasy y predecir la fecha" />
          )}
        </section>

        {SECCIONES.map((s) => (
          <section key={s.titulo}>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-2 px-1">{s.titulo}</h2>
            <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
              {s.items.map((i) => <Fila key={i.href} {...i} />)}
            </div>
          </section>
        ))}

        {/* Ajustes del teléfono */}
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-2 px-1">Ajustes</h2>
          <div className="rounded-2xl border border-border bg-card/40 p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Avisos y tema</p>
              <p className="text-xs text-muted-foreground">Notificaciones de partidos y modo claro/oscuro</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <PushToggle />
              <ThemeToggle />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Fila({ href, icon: Icon, label, desc }: { href: string; icon: typeof Radio; label: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/60 last:border-0">
      <Icon className="h-4 w-4 text-red-500 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
    </Link>
  );
}
