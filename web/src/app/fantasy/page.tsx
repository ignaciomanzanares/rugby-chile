import Link from "next/link";
import { FANTASY_LIVE, FantasyComingSoon } from "@/lib/fantasy-flags";

const DIVISIONS = [
  { key: "primera",        label: "Primera",        color: "from-amber-900/40 to-amber-950/20", border: "border-amber-600/40", badge: "text-amber-400", desc: "La élite del rugby chileno" },
  { key: "intermedia",     label: "Intermedia",     color: "from-blue-900/30 to-blue-950/20",   border: "border-blue-600/40",  badge: "text-blue-400",  desc: "Segunda división del Top 10" },
  { key: "pre-intermedia", label: "Pre-Intermedia", color: "from-emerald-900/30 to-emerald-950/20", border: "border-emerald-600/40", badge: "text-emerald-400", desc: "Tercera división del Top 10" },
];

const scoringRules = [
  { label: "Jugó",            pts: "+1" },
  { label: "Try",             pts: "+4" },
  { label: "Asistencia",      pts: "+3" },
  { label: "Conversión",      pts: "+1" },
  { label: "Penal",           pts: "+2" },
  { label: "Drop",            pts: "+3" },
  { label: "MVP",             pts: "+3" },
  { label: "Amarilla",        pts: "-1" },
  { label: "Roja",            pts: "-3" },
];

export default function FantasyPage() {
  if (!FANTASY_LIVE) return <FantasyComingSoon />;
  return (
    <main className="min-h-screen bg-background text-foreground">

      {/* Hero */}
      <section className="relative py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-background to-red-950/20 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold tracking-widest uppercase mb-6">
            Temporada 2026
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-4">
            <span className="text-amber-400">Fantasy</span>{" "}
            <span className="text-foreground">Top 10</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-4">
            Elige tu categoría, arma tu equipo y compite contra otros hinchas.
          </p>
        </div>
      </section>

      {/* Division picker */}
      <section className="max-w-4xl mx-auto px-4 pb-10">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 text-center">Elige tu categoría</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {DIVISIONS.map((div) => (
            <div key={div.key} className={`rounded-2xl border ${div.border} bg-gradient-to-br ${div.color} p-6 flex flex-col gap-4`}>
              <div>
                <span className={`text-xs font-bold uppercase tracking-widest ${div.badge}`}>{div.label}</span>
                <p className="text-sm text-muted-foreground mt-1">{div.desc}</p>
              </div>
              <div className="flex flex-col gap-2 mt-auto">
                <Link
                  href={`/fantasy/team?division=${div.key}`}
                  className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-foreground font-bold text-sm text-center transition-colors"
                >
                  Armar equipo
                </Link>
                <Link
                  href={`/fantasy/leaderboard?division=${div.key}`}
                  className="w-full py-2 rounded-lg text-muted-foreground hover:text-foreground/80 text-sm text-center transition-colors"
                >
                  Ver tabla →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rules */}
      <section className="max-w-4xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-2 gap-6">

          <div className="rounded-xl border border-border bg-card/50 p-6">
            <h2 className="text-sm font-bold text-amber-400 mb-4 tracking-widest uppercase">Puntuación</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {scoringRules.map((r) => (
                <div key={r.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className={`font-bold tabular-nums ${r.pts.startsWith("-") ? "text-red-400" : "text-emerald-400"}`}>
                    {r.pts}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Capitán</span>
              <span className="font-black text-amber-400">×2</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-muted-foreground">Super Sub · entra de suplente</span>
              <span className="font-black text-orange-400">×2</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-muted-foreground">Super Sub · fue titular</span>
              <span className="font-black text-orange-400">÷2</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/50 p-6">
            <h2 className="text-sm font-bold text-amber-400 mb-4 tracking-widest uppercase">Cómo jugar</h2>
            <ul className="space-y-3 text-sm">
              {[
                "Elige una categoría (Primera, Intermedia o Pre-Intermedia).",
                "Arma tu XV en la cancha: completa las 15 posiciones (forwards y backs) con presupuesto de $100M.",
                "Suma un Super Sub opcional (16° jugador): si entra de suplente en la cancha real, sus puntos van ×2; si fue titular, ÷2.",
                "Máximo 3 jugadores del mismo club.",
                "Asigna tu Capitán (×2) entre los 15 titulares.",
                "Los puntos se actualizan después de cada fecha.",
                "Editas tu equipo libremente entre fechas, como en el Seis Naciones.",
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-foreground/80">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
          </div>

        </div>
      </section>

    </main>
  );
}
