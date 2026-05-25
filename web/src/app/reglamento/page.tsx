import {
  BookOpen,
  Trophy,
  Users,
  Clock,
  Shield,
  AlertTriangle,
  Calendar,
  ArrowDown,
  ArrowUp,
  CheckCircle,
} from "lucide-react";
import { clubLogo } from "@/lib/tournament";

const TEAMS = [
  { name: "COBS",           kind: "Socio" },
  { name: "Old Boys",       kind: "Socio" },
  { name: "PWCC",           kind: "Socio" },
  { name: "Old Macks",      kind: "Invitado" },
  { name: "Stade Francais", kind: "Socio" },
  { name: "Sporting RC",    kind: "Invitado" },
  { name: "DOBS",           kind: "Socio" },
  { name: "UC",             kind: "Socio" },
  { name: "Old Johns",      kind: "Invitado" },
  { name: "Old Reds",       kind: "Socio" },
];

const CLUB_COLORS: Record<string, { primary: string; secondary: string; initials: string }> = {
  COBS:             { primary: "#1a3a6b", secondary: "#c9a227", initials: "CO" },
  "Old Boys":       { primary: "#cc0000", secondary: "#ffffff", initials: "OB" },
  PWCC:             { primary: "#003087", secondary: "#FFB81C", initials: "PW" },
  "Old Macks":      { primary: "#b91c1c", secondary: "#ffffff", initials: "OM" },
  "Stade Francais": { primary: "#1a237e", secondary: "#e8102a", initials: "SF" },
  "Sporting RC":    { primary: "#15803d", secondary: "#ffffff", initials: "SP" },
  DOBS:             { primary: "#0369a1", secondary: "#fbbf24", initials: "DO" },
  UC:               { primary: "#1e3a8a", secondary: "#fbbf24", initials: "UC" },
  "Old Johns":      { primary: "#1d4ed8", secondary: "#fef08a", initials: "OJ" },
  "Old Reds":       { primary: "#9f1239", secondary: "#fca5a5", initials: "OR" },
};

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-red-500" />
        <h2 className="font-bold uppercase tracking-widest text-sm">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function ReglamentoPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <section className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-1">
            <BookOpen className="h-5 w-5 text-red-500" />
            <h1 className="text-2xl font-black uppercase tracking-widest">Reglamento</h1>
          </div>
          <p className="text-zinc-500 text-sm">Primera División · Acuerdos de Participación ARUSA 2026</p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">

        {/* Equipos */}
        <Section icon={Users} title="Equipos participantes (10)">
          <p className="text-zinc-400 text-sm mb-4">
            Diez clubes compiten en la Primera División de ARUSA. Tres de ellos son <span className="text-amber-400 font-semibold">invitados de otras regiones</span>; los siete restantes son socios de la Asociación.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {TEAMS.map((t) => {
              const c = CLUB_COLORS[t.name];
              const logo = clubLogo(t.name);
              return (
                <div key={t.name} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt={t.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-zinc-800" />
                  ) : (
                    <span
                      className="w-8 h-8 rounded-full inline-flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: c.primary, color: c.secondary }}
                    >
                      {c.initials}
                    </span>
                  )}
                  <span className="flex-1 text-sm font-semibold">{t.name}</span>
                  <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ${t.kind === "Invitado" ? "bg-amber-500/15 text-amber-400" : "bg-zinc-800 text-zinc-400"}`}>
                    {t.kind}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Las 3 divisiones */}
        <Section icon={Shield} title="Tres equipos por club">
          <p className="text-zinc-400 text-sm mb-4">
            Cada club presenta tres equipos por fecha. Las tres divisiones se juegan como torneos independientes pero el mismo día, en la misma cancha.
          </p>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-red-600/30 bg-red-600/10 p-4">
              <div className="text-[10px] font-bold tracking-widest text-red-400 uppercase mb-1">3er turno</div>
              <div className="text-base font-black">Primera</div>
              <p className="text-xs text-zinc-400 mt-2">Primer equipo · titulares · 80 min (2×40&apos;)</p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="text-[10px] font-bold tracking-widest text-amber-400 uppercase mb-1">2do turno</div>
              <div className="text-base font-black">Intermedia</div>
              <p className="text-xs text-zinc-400 mt-2">Segundo equipo · 2 hs antes de Primera</p>
            </div>
            <div className="rounded-lg border border-emerald-600/30 bg-emerald-600/10 p-4">
              <div className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase mb-1">1er turno</div>
              <div className="text-base font-black">Pre-Intermedia</div>
              <p className="text-xs text-zinc-400 mt-2">Tercer equipo · 2 hs antes de Intermedia</p>
            </div>
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-3 text-xs text-zinc-400">
            <div className="rounded-lg border border-zinc-800 px-3 py-2.5">
              <span className="text-zinc-500">Plantel mínimo Primera:</span> <span className="text-white font-semibold">80 jugadores licenciados</span>
            </div>
            <div className="rounded-lg border border-zinc-800 px-3 py-2.5">
              <span className="text-zinc-500">Repetición entre equipos:</span> <span className="text-white font-semibold">máx. 8 jugadores por fecha</span>
            </div>
          </div>
        </Section>

        {/* Formato y calendario */}
        <Section icon={Calendar} title="Formato del torneo">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-3xl font-black text-white">18</div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Fechas de fase regular</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-3xl font-black text-white">10</div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Equipos · todos contra todos</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-3xl font-black text-white">4</div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Clasifican a playoffs</p>
            </div>
          </div>
          <p className="text-zinc-400 text-sm mt-4">
            Tras la fase regular se disputan las semifinales, la final y el repechaje contra el campeón de Segunda División.
            Los partidos podrán autorizarse los viernes si las condiciones lo permiten.
          </p>
        </Section>

        {/* Sistema de puntos */}
        <Section icon={Trophy} title="Sistema de puntos">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { pts: "+4", label: "Partido ganado", tone: "emerald" },
              { pts: "+2", label: "Partido empatado", tone: "amber" },
              { pts: "0",  label: "Partido perdido", tone: "zinc" },
              { pts: "+1", label: "Bonus por 4 o más tries", tone: "blue" },
              { pts: "+1", label: "Bonus por perder por 7 o menos", tone: "blue" },
              { pts: "+1", label: "Pre-Intermedia · 23 jugadores (6 primeras líneas)", tone: "red" },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
                <span className={`text-lg font-black tabular-nums w-10 text-center ${
                  row.tone === "emerald" ? "text-emerald-400" :
                  row.tone === "amber"   ? "text-amber-400" :
                  row.tone === "blue"    ? "text-blue-400" :
                  row.tone === "red"     ? "text-red-400" :
                  "text-zinc-500"
                }`}>{row.pts}</span>
                <span className="text-sm text-zinc-300">{row.label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Playoffs */}
        <Section icon={Trophy} title="Playoffs">
          <div className="space-y-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex items-center gap-3">
              <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase w-24">Semifinal 1</span>
              <span className="text-sm font-semibold">1° lugar</span>
              <span className="text-zinc-600 text-xs">vs</span>
              <span className="text-sm font-semibold">4° lugar</span>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex items-center gap-3">
              <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase w-24">Semifinal 2</span>
              <span className="text-sm font-semibold">2° lugar</span>
              <span className="text-zinc-600 text-xs">vs</span>
              <span className="text-sm font-semibold">3° lugar</span>
            </div>
            <div className="rounded-lg border border-red-600/40 bg-red-600/10 px-4 py-3 flex items-center gap-3">
              <span className="text-[10px] font-bold tracking-widest text-red-400 uppercase w-24">Final</span>
              <span className="text-sm font-semibold">Ganador SF1</span>
              <span className="text-zinc-600 text-xs">vs</span>
              <span className="text-sm font-semibold">Ganador SF2</span>
            </div>
          </div>
        </Section>

        {/* Ascenso / Descenso */}
        <Section icon={ArrowUp} title="Ascenso, descenso y repechaje">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-emerald-600/30 bg-emerald-600/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">Clasifican</span>
              </div>
              <p className="text-sm text-zinc-300">Los <span className="font-bold text-white">4 primeros</span> de la fase regular juegan playoffs.</p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDown className="h-4 w-4 text-amber-400" />
                <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase">Repechaje</span>
              </div>
              <p className="text-sm text-zinc-300">El <span className="font-bold text-white">9°</span> de Primera enfrenta al campeón de Segunda.</p>
            </div>
            <div className="rounded-lg border border-red-700/40 bg-red-700/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDown className="h-4 w-4 text-red-400" />
                <span className="text-[10px] font-bold tracking-widest text-red-400 uppercase">Descenso directo</span>
              </div>
              <p className="text-sm text-zinc-300">El <span className="font-bold text-white">10°</span> baja a Segunda División en 2027.</p>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-4">
            Acumular 3 W.O. (deportivos o administrativos) en fase regular elimina automáticamente al equipo de los playoffs, sin importar su puntaje.
          </p>
        </Section>

        {/* Reglas de juego destacadas */}
        <Section icon={Clock} title="Reglas de partido">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Tiempo de juego</p>
              <p className="font-semibold mt-1">80 min · 2 × 40 + 10 min descanso</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Match Team Sheet</p>
              <p className="font-semibold mt-1">33 personas · 23 jugadores (15 + 8) + staff</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Sustituciones · Primera</p>
              <p className="font-semibold mt-1">Máximo 8 (según Regulación 3 World Rugby)</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Sustituciones · Intermedia y Pre-Intermedia</p>
              <p className="font-semibold mt-1">Rotativas ilimitadas</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Balón oficial</p>
              <p className="font-semibold mt-1">Simoon Ball N° 5 Macron</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wider">W.O.</p>
              <p className="font-semibold mt-1">28-0 + 5 puntos al rival</p>
            </div>
          </div>
        </Section>

        {/* Disciplina */}
        <Section icon={AlertTriangle} title="Disciplina">
          <ul className="space-y-2 text-sm text-zinc-300">
            <li className="flex gap-3"><span className="text-red-500 font-bold w-5">·</span><span><span className="font-semibold text-white">Doble amarilla:</span> equivale a roja y suspensión automática para la siguiente fecha.</span></li>
            <li className="flex gap-3"><span className="text-red-500 font-bold w-5">·</span><span><span className="font-semibold text-white">3 amarillas acumuladas:</span> suspensión 1 fecha. El contador se reinicia. Las amarillas también se resetean al iniciar los playoffs.</span></li>
            <li className="flex gap-3"><span className="text-red-500 font-bold w-5">·</span><span><span className="font-semibold text-white">Tarjeta roja:</span> el jugador queda suspendido hasta la resolución del Tribunal de Disciplina.</span></li>
            <li className="flex gap-3"><span className="text-red-500 font-bold w-5">·</span><span><span className="font-semibold text-white">Protocolo &ldquo;Identifique y Retire&rdquo;:</span> sospecha de conmoción cerebral retira al jugador del partido. Reintegro gradual mínimo de 21 días (salvo apto neurológico).</span></li>
            <li className="flex gap-3"><span className="text-red-500 font-bold w-5">·</span><span><span className="font-semibold text-white">Alineación indebida:</span> denuncia hasta 6 días corridos posteriores al encuentro. Sanción: W.O. administrativo 28-0.</span></li>
          </ul>
        </Section>

        <p className="text-xs text-zinc-600 text-center pt-2">
          Documento oficial: <span className="text-zinc-400">Acuerdos de Participación ARUSA 2026</span> · Datos del torneo en{" "}
          <a href="https://arusa.cl/en/tournament/1328550/summary" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 underline underline-offset-2 transition-colors">arusa.cl</a>
        </p>
      </div>
    </div>
  );
}
