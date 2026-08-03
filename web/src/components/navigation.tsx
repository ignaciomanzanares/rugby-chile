"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Menu,
  Trophy,
  Calendar,
  BarChart3,
  Radio,
  Newspaper,
  User,
  Users,
  BookOpen,
  ChevronRight,
  Target,
  LogOut,
  Gamepad2,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";

const sections = [
  { name: "Fixture y Resultados", href: "/schedule",    icon: Calendar,  desc: "Próximas fechas y marcadores" },
  { name: "Tabla",                href: "/standings",   icon: Trophy,    desc: "Clasificación general" },
  { name: "Clubes y Jugadores",   href: "/teams",       icon: Users,     desc: "Los 10 equipos y sus planteles" },
  { name: "Estadísticas",         href: "/estadisticas",icon: BarChart3, desc: "Tries, puntos y líderes" },
  { name: "Reglamento",           href: "/reglamento",  icon: BookOpen,  desc: "Acuerdos ARUSA 2026" },
  { name: "Noticias",             href: "/news",         icon: Newspaper, desc: "Últimas notas del torneo" },
  { name: "En Vivo",              href: "/live",        icon: Radio,     desc: "Marcador en tiempo real" },
  { name: "Predicciones",         href: "/predict",     icon: Target,    desc: "Adivina los resultados y gana puntos" },
  { name: "Proyección",           href: "/proyeccion",  icon: TrendingUp, desc: "Cómo termina el torneo · simulación" },
  { name: "Fantasy",              href: "/fantasy",     icon: Gamepad2,  desc: "Arma tu equipo ideal y compite" },
];

function Top10Logo() {
  return (
    <Link href="/" aria-label="itaú Top 10 by Entel · Rugby Chile" className="flex-shrink-0">
      <Image
        src="/top10-itau-logo.png"
        alt="itaú Top 10 by Entel"
        width={72}
        height={72}
        className="h-14 w-auto md:h-[72px] object-contain drop-shadow-md"
        priority
      />
    </Link>
  );
}

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex h-20 md:h-24 items-center justify-between gap-3">

          <div className="flex items-center gap-3">
            <Top10Logo />
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-bold tracking-[0.22em] text-primary uppercase">Primera División</span>
              <span className="text-[11px] text-muted-foreground tracking-wider uppercase">Asoc. Rugby de Santiago</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">

            {user ? (
              <Link
                href="/predict"
                className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-md border border-primary/50 bg-primary/10 hover:bg-primary/20 transition-colors text-sm font-semibold text-primary"
              >
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">Predecir</span>
              </Link>
            ) : null}

            <ThemeToggle />

            {user ? (
              <Link
                href="/perfil"
                title="Mi perfil"
                className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-md border border-border bg-card hover:bg-muted hover:border-foreground/30 transition-colors text-sm font-semibold text-foreground"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline max-w-[100px] truncate">{user.name.split(" ")[0]}</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-md border border-border bg-card hover:bg-muted hover:border-foreground/30 transition-colors text-sm font-semibold text-foreground"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Iniciar sesión</span>
                <span className="sm:hidden">Entrar</span>
              </Link>
            )}

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 transition-colors text-sm font-bold text-white">
                <Menu className="h-5 w-5" />
                <span className="hidden sm:inline uppercase tracking-wider">Menú</span>
                <span className="sr-only">Abrir menú</span>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 sm:w-96 bg-background border-border p-0 flex flex-col">

                <div className="px-6 pt-6 pb-5 border-b border-border flex items-center gap-3">
                  <Top10Logo />
                  <div>
                    <div className="text-xs font-bold tracking-[0.22em] text-amber-400 uppercase">Top 10</div>
                    <div className="text-[11px] text-muted-foreground tracking-wider uppercase">Rugby Chile · 2026</div>
                  </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-3">
                  {sections.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className="group flex items-center gap-3 px-6 py-3 border-l-2 border-transparent hover:border-red-500 hover:bg-card transition-colors"
                    >
                      <span className="w-9 h-9 rounded-md bg-card group-hover:bg-muted inline-flex items-center justify-center text-muted-foreground group-hover:text-red-500 transition-colors">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{item.name}</span>
                        <span className="block text-xs text-muted-foreground truncate">{item.desc}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                    </Link>
                  ))}
                </nav>

                <div className="px-6 py-4 border-t border-border bg-card/40">
                  {user ? (
                    <div className="space-y-2">
                      <Link
                        href="/perfil"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted hover:bg-secondary transition-colors text-sm text-foreground"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{user.name}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                      </Link>
                      <Link
                        href="/leaderboard"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/40 transition-colors text-sm font-semibold text-amber-400"
                      >
                        <Trophy className="h-4 w-4" /> Tabla de predicciones
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-muted hover:bg-secondary transition-colors text-sm font-semibold text-muted-foreground"
                      >
                        <LogOut className="h-4 w-4" /> Cerrar sesión
                      </button>
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-muted hover:bg-secondary transition-colors text-sm font-semibold text-foreground"
                    >
                      <User className="h-4 w-4" /> Iniciar sesión
                    </Link>
                  )}
                  <p className="mt-3 text-[11px] text-muted-foreground/70 text-center tracking-wider uppercase">© 2026 Top 10 · Rugby Chile</p>
                </div>

              </SheetContent>
            </Sheet>

          </div>

        </div>
      </div>
    </header>
  );
}
