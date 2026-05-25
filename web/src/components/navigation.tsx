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
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const sections = [
  { name: "Fixture y Resultados", href: "/schedule",    icon: Calendar,  desc: "Próximas fechas y marcadores" },
  { name: "Tabla",                href: "/standings",   icon: Trophy,    desc: "Clasificación general" },
  { name: "Clubes y Jugadores",   href: "/teams",       icon: Users,     desc: "Los 10 equipos y sus planteles" },
  { name: "Estadísticas",         href: "/estadisticas",icon: BarChart3, desc: "Tries, puntos y líderes" },
  { name: "Reglamento",           href: "/reglamento",  icon: BookOpen,  desc: "Acuerdos ARUSA 2026" },
  { name: "Noticias",             href: "/news",         icon: Newspaper, desc: "Últimas notas del torneo" },
  { name: "En Vivo",              href: "/live",        icon: Radio,     desc: "Marcador en tiempo real" },
  { name: "Predicciones",         href: "/predict",     icon: Target,    desc: "Adivina los resultados y gana puntos" },
  { name: "Fantasy",              href: "/fantasy",     icon: Gamepad2,  desc: "Arma tu equipo ideal y compite" },
];

function Top10Logo() {
  return (
    <Link href="/" aria-label="Top 10 ARUSA · Rugby Chile" className="flex-shrink-0">
      <Image
        src="/top10-arusa-logo.png"
        alt="Top 10 ARUSA"
        width={72}
        height={72}
        className="w-14 h-14 md:w-[72px] md:h-[72px] object-contain drop-shadow-lg"
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
    <header className="sticky top-0 z-50 w-full bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
      <div className="container mx-auto px-4">
        <div className="flex h-20 md:h-24 items-center justify-between gap-3">

          <div className="flex items-center gap-3">
            <Top10Logo />
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-bold tracking-[0.22em] text-amber-400 uppercase">Primera División</span>
              <span className="text-[11px] text-zinc-500 tracking-wider uppercase">Asoc. Rugby de Santiago</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">

            {user ? (
              <Link
                href="/predict"
                className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-md border border-amber-600/50 bg-amber-600/10 hover:bg-amber-600/20 transition-colors text-sm font-semibold text-amber-400"
              >
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">Predecir</span>
              </Link>
            ) : null}

            {user ? (
              <div className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-sm font-semibold text-white">
                <User className="h-4 w-4 text-zinc-400" />
                <span className="hidden sm:inline max-w-[100px] truncate">{user.name.split(" ")[0]}</span>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-md border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-600 transition-colors text-sm font-semibold text-white"
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
              <SheetContent side="right" className="w-80 sm:w-96 bg-zinc-950 border-zinc-800 p-0 flex flex-col">

                <div className="px-6 pt-6 pb-5 border-b border-zinc-800 flex items-center gap-3">
                  <Top10Logo />
                  <div>
                    <div className="text-xs font-bold tracking-[0.22em] text-amber-400 uppercase">Top 10</div>
                    <div className="text-[11px] text-zinc-500 tracking-wider uppercase">Rugby Chile · 2026</div>
                  </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-3">
                  {sections.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className="group flex items-center gap-3 px-6 py-3 border-l-2 border-transparent hover:border-red-500 hover:bg-zinc-900 transition-colors"
                    >
                      <span className="w-9 h-9 rounded-md bg-zinc-900 group-hover:bg-zinc-800 inline-flex items-center justify-center text-zinc-400 group-hover:text-red-500 transition-colors">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-white">{item.name}</span>
                        <span className="block text-xs text-zinc-500 truncate">{item.desc}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                    </Link>
                  ))}
                </nav>

                <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/40">
                  {user ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-800 text-sm text-white">
                        <User className="h-4 w-4 text-zinc-400" />
                        <span className="flex-1 truncate">{user.name}</span>
                      </div>
                      <Link
                        href="/leaderboard"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/40 transition-colors text-sm font-semibold text-amber-400"
                      >
                        <Trophy className="h-4 w-4" /> Tabla de predicciones
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm font-semibold text-zinc-400"
                      >
                        <LogOut className="h-4 w-4" /> Cerrar sesión
                      </button>
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm font-semibold text-white"
                    >
                      <User className="h-4 w-4" /> Iniciar sesión
                    </Link>
                  )}
                  <p className="mt-3 text-[11px] text-zinc-600 text-center tracking-wider uppercase">© 2026 Top 10 · Rugby Chile</p>
                </div>

              </SheetContent>
            </Sheet>

          </div>

        </div>
      </div>
    </header>
  );
}
