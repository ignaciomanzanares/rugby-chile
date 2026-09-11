import Link from "next/link";
import { Gamepad2, Target, Trophy, Users, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Juega",
  description: "Fantasy y predicciones del Top 10 ARUSA: arma tu equipo, adivina los resultados y compite en la tabla.",
};

// Los dos juegos viven en la misma pestaña: es lo mismo que hace el hincha
// (competir contra otros), y separados se perdían en el menú.
const JUEGOS = [
  {
    href: "/fantasy/team",
    icon: Gamepad2,
    nombre: "Fantasy",
    bajada: "Arma tu XV con presupuesto, elige capitán y super sub, y suma los puntos que hagan tus jugadores fecha a fecha.",
    principal: "Mi equipo",
    acento: "amber",
    links: [
      { href: "/fantasy/leaderboard", label: "Ranking", icon: Trophy },
      { href: "/fantasy", label: "Cómo funciona", icon: Users },
    ],
  },
  {
    href: "/predict",
    icon: Target,
    nombre: "Predicciones",
    bajada: "Marca quién gana cada partido de la fecha antes del pitazo inicial. Acertar el ganador suma; acertar el marcador suma más.",
    principal: "Predecir la fecha",
    acento: "emerald",
    links: [
      { href: "/leaderboard", label: "Ranking", icon: Trophy },
    ],
  },
] as const;

const ACENTOS = {
  amber: { borde: "border-amber-600/40", fondo: "from-amber-900/25 to-amber-950/10", texto: "text-amber-400", boton: "bg-amber-500 text-zinc-950 hover:bg-amber-400" },
  emerald: { borde: "border-emerald-600/40", fondo: "from-emerald-900/25 to-emerald-950/10", texto: "text-emerald-400", boton: "bg-emerald-600 text-white hover:bg-emerald-500" },
} as const;

export default function JuegaPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-gradient-to-br from-[#7f1d1d] via-[#b45309] to-[#f59e0b] text-white">
        <div className="container mx-auto px-4 pt-8 pb-6">
          <h1 className="text-3xl font-black tracking-tight">Juega</h1>
          <p className="text-white/80 text-sm font-semibold mt-0.5">Fantasy y predicciones · Temporada 2026</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 pb-24 grid gap-4 sm:grid-cols-2">
        {JUEGOS.map((j) => {
          const a = ACENTOS[j.acento];
          const Icon = j.icon;
          return (
            <section key={j.nombre} className={`rounded-2xl border ${a.borde} bg-gradient-to-br ${a.fondo} p-5 flex flex-col`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-5 w-5 ${a.texto}`} />
                <h2 className="text-lg font-black">{j.nombre}</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-snug mb-4">{j.bajada}</p>

              <Link href={j.href}
                className={`mt-auto w-full py-2.5 rounded-xl text-sm font-bold text-center transition-colors ${a.boton}`}>
                {j.principal}
              </Link>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {j.links.map((l) => (
                  <Link key={l.href} href={l.href}
                    className="inline-flex items-center gap-1.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                    <l.icon className="h-3.5 w-3.5" />
                    {l.label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
