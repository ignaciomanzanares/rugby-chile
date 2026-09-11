"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Gamepad2, Trophy, TrendingUp, MoreHorizontal } from "lucide-react";

// Barra de abajo, estilo app: cuatro destinos fijos + "Más" para el resto.
// Solo en teléfono; en escritorio manda el menú de arriba, que tiene espacio.
//
// El orden es el del sábado: lo que pasa ahora, lo que juego, la temporada, y
// al final lo que se mira de vez en cuando.
const TABS = [
  { href: "/", label: "Inicio", icon: Home, match: (p: string) => p === "/" },
  { href: "/juega", label: "Juega", icon: Gamepad2, match: (p: string) => p.startsWith("/juega") || p.startsWith("/fantasy") || p.startsWith("/predict") || p.startsWith("/leaderboard") },
  { href: "/temporada", label: "Temporada", icon: Trophy, match: (p: string) => p.startsWith("/temporada") || p.startsWith("/schedule") || p.startsWith("/standings") || p.startsWith("/estadisticas") },
  { href: "/proyeccion", label: "Proyección", icon: TrendingUp, match: (p: string) => p.startsWith("/proyeccion") },
  { href: "/mas", label: "Más", icon: MoreHorizontal, match: (p: string) => p.startsWith("/mas") || p.startsWith("/live") || p.startsWith("/news") || p.startsWith("/teams") || p.startsWith("/reglamento") || p.startsWith("/perfil") || p.startsWith("/jugador") },
];

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  // El área de admin y el login tienen su propia navegación: la barra estorba.
  if (pathname.startsWith("/admin") || pathname.startsWith("/login")) return null;

  // El iPhone dibuja su barra de gestos ENCIMA de la página, así que el
  // contenido se sube: el inset del sistema más un respiro, y si no existe un
  // piso de 26px, para que la barra de gestos no toque las etiquetas.
  return (
    <nav aria-label="Navegación principal"
      style={{ paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 8px), 26px)" }}
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur">
      <ul className="grid grid-cols-5">
        {TABS.map((t) => {
          const activa = t.match(pathname);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={activa ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 pt-2.5 pb-1 transition-colors ${
                  activa ? "text-red-600" : "text-muted-foreground"
                }`}>
                <Icon className={`h-6 w-6 ${activa ? "stroke-[2.5]" : ""}`} />
                <span className="text-[11px] font-bold leading-none">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
