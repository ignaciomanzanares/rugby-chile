"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Trophy, ShieldAlert, ArrowDownCircle, Info } from "lucide-react";
import { clubLogo } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type TeamProjection = {
  team: string;
  currentPos: number;
  currentPts: number;
  playoffPct: number;
  championPct: number;
  finalPct: number;
  homeSemiPct: number;
  repechajePct: number;
  relegationPct: number;
  avgPts: number;
  avgPos: number;
  posDist: number[];
  projectedPos: number;
};

type SeasonProjection = {
  division: string;
  simulations: number;
  playedRounds: number;
  remainingMatches: number;
  generatedAt: string;
  teams: TeamProjection[];
};

const CLUB_COLOR: Record<string, string> = {
  COBS: "#1a3a6b", "Old Boys": "#cc0000", PWCC: "#003087", "Old Macks": "#b91c1c",
  "Stade Francais": "#1a237e", "Sporting RC": "#15803d", DOBS: "#0369a1",
  UC: "#1e3a8a", "Old Johns": "#1d4ed8", "Old Reds": "#9f1239",
};

function initials(team: string) {
  return team.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function ClubBadge({ team, size = 28 }: { team: string; size?: number }) {
  const logo = clubLogo(team);
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt={team} width={size} height={size} className="rounded-full object-cover flex-shrink-0 ring-1 ring-border" style={{ width: size, height: size }} />;
  }
  return (
    <span className="rounded-full inline-flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white"
      style={{ width: size, height: size, background: CLUB_COLOR[team] ?? "#334155" }}>
      {initials(team)}
    </span>
  );
}

// A percentage → readable label. Sub-0.5% reads as "<1%", never a bare "0%"
// unless it's truly impossible.
function pct(n: number) {
  if (n <= 0) return "0%";
  if (n < 1) return "<1%";
  if (n > 99 && n < 100) return ">99%";
  return `${Math.round(n)}%`;
}

// Zone colour for a finishing position: top-4 playoffs (emerald), 9º repechaje
// (amber), 10º descenso (red) — mirrors the standings page legend.
function zoneClasses(pos: number) {
  if (pos <= 4) return "bg-emerald-600 text-white";
  if (pos === 9) return "bg-amber-500 text-zinc-950";
  if (pos === 10) return "bg-red-700 text-white";
  return "bg-secondary text-foreground";
}

// Heat cell: shade a single accent by probability. Emerald in the playoff
// columns, red in the descenso column, neutral elsewhere, so the table reads as
// "where does each club land".
function HeatCell({ p, col }: { p: number; col: number }) {
  const alpha = p <= 0 ? 0 : Math.max(0.06, Math.min(1, p / 45)); // 45%+ saturates
  const hue = col < 4 ? "16 185 129" : col === 9 ? "180 83 9" : col === 8 ? "217 119 6" : "100 116 139";
  return (
    <td className="text-center p-0">
      <div className="mx-auto flex items-center justify-center text-[10px] tabular-nums h-9 w-full"
        style={{
          background: p > 0 ? `rgb(${hue} / ${alpha})` : "transparent",
          color: alpha > 0.6 ? "white" : undefined,
        }}
        title={`${pct(p)} de terminar ${col + 1}º`}>
        {p >= 1 ? Math.round(p) : ""}
      </div>
    </td>
  );
}

export default function ProyeccionPage() {
  const [data, setData] = useState<SeasonProjection | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/api/v1/predict/season`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, []);

  const teams = useMemo(() => data?.teams ?? [], [data]);
  const titleRace = useMemo(() => [...teams].sort((a, b) => b.championPct - a.championPct).slice(0, 3), [teams]);
  const dropRace = useMemo(() => [...teams].sort((a, b) => b.relegationPct - a.relegationPct).slice(0, 3), [teams]);
  const bubble = useMemo(
    () => [...teams].filter((t) => t.playoffPct > 5 && t.playoffPct < 95).sort((a, b) => b.playoffPct - a.playoffPct),
    [teams],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-emerald-500 text-xs font-semibold uppercase tracking-wide mb-2">
            <TrendingUp className="h-4 w-4" /> Proyección del torneo
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">¿Cómo termina el Top 10?</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Simulación Monte Carlo de las fechas que faltan. A partir de la tabla actual y la fuerza de
            cada equipo esta temporada, jugamos el resto del torneo miles de veces para estimar las
            chances de cada club.
          </p>
          {data && (
            <p className="text-xs text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>{data.simulations.toLocaleString("es-CL")} simulaciones</span>
              <span>Fecha {data.playedRounds} jugada · {data.remainingMatches} partidos por jugar</span>
              <span>Actualizado {new Date(data.generatedAt).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </p>
          )}
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {error && (
          <div className="rounded-xl border border-border p-6 text-center text-muted-foreground">
            No se pudo cargar la proyección. Intenta de nuevo en un momento.
          </div>
        )}
        {!data && !error && (
          <div className="rounded-xl border border-border p-10 text-center text-muted-foreground animate-pulse">
            Corriendo simulaciones…
          </div>
        )}

        {data && (
          <>
            {/* Highlight cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <HighlightCard icon={<Trophy className="h-4 w-4" />} title="Favoritos al título" accent="text-emerald-500">
                {titleRace.map((t) => (
                  <StatRow key={t.team} team={t.team} value={pct(t.championPct)} />
                ))}
              </HighlightCard>
              <HighlightCard icon={<ShieldAlert className="h-4 w-4" />} title="En pelea por playoffs" accent="text-blue-400">
                {bubble.length === 0 && <p className="text-xs text-muted-foreground">Top 4 prácticamente definido.</p>}
                {bubble.map((t) => (
                  <StatRow key={t.team} team={t.team} value={pct(t.playoffPct)} />
                ))}
              </HighlightCard>
              <HighlightCard icon={<ArrowDownCircle className="h-4 w-4" />} title="Zona de descenso" accent="text-red-400">
                {dropRace.map((t) => (
                  <StatRow key={t.team} team={t.team} value={pct(t.relegationPct)} sub={`rep. ${pct(t.repechajePct)}`} />
                ))}
              </HighlightCard>
            </div>

            {/* Projected table */}
            <div>
              <h2 className="text-lg font-bold mb-3">Tabla proyectada al final de la fase regular</h2>
              <div className="rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="bg-card/80 text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="text-left font-semibold py-3 pl-4 pr-2">#</th>
                      <th className="text-left font-semibold py-3 px-2">Equipo</th>
                      <th className="text-center font-semibold py-3 px-2">Hoy</th>
                      <th className="text-right font-semibold py-3 px-2">Pts esp.</th>
                      <th className="text-right font-semibold py-3 px-2">Playoffs</th>
                      <th className="text-right font-semibold py-3 px-2">Final</th>
                      <th className="text-right font-semibold py-3 pr-4 pl-2">Campeón</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((t) => (
                      <tr key={t.team} className="border-t border-border hover:bg-card/60 transition-colors">
                        <td className="py-2.5 pl-4 pr-2">
                          <span className={`inline-flex w-7 h-7 items-center justify-center rounded text-xs font-bold ${zoneClasses(t.projectedPos)}`}>
                            {t.projectedPos}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2.5">
                            <ClubBadge team={t.team} />
                            <span className="font-medium">{t.team}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center text-muted-foreground tabular-nums">
                          {t.currentPos}º<span className="text-xs"> · {t.currentPts}pt</span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-semibold tabular-nums">{t.avgPts.toFixed(1)}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          <ProbBar p={t.playoffPct} />
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">{pct(t.finalPct)}</td>
                        <td className="py-2.5 pr-4 pl-2 text-right font-semibold tabular-nums text-emerald-500">{pct(t.championPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Position heatmap */}
            <div>
              <h2 className="text-lg font-bold mb-1">Probabilidad de terminar en cada puesto</h2>
              <p className="text-xs text-muted-foreground mb-3">% de las simulaciones en que cada club cierra la fase regular en esa posición.</p>
              <div className="rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-sm min-w-[680px]">
                  <thead>
                    <tr className="bg-card/80 text-muted-foreground text-xs">
                      <th className="text-left font-semibold py-2.5 pl-4 pr-2 uppercase tracking-wide">Equipo</th>
                      {Array.from({ length: 10 }, (_, i) => (
                        <th key={i} className="font-semibold py-2.5 px-1 text-center w-9">{i + 1}º</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((t) => (
                      <tr key={t.team} className="border-t border-border">
                        <td className="py-1 pl-4 pr-2">
                          <div className="flex items-center gap-2">
                            <ClubBadge team={t.team} size={22} />
                            <span className="font-medium text-xs whitespace-nowrap">{t.team}</span>
                          </div>
                        </td>
                        {t.posDist.map((p, col) => (
                          <HeatCell key={col} p={p} col={col} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-600 inline-block" /> Playoffs (1º–4º)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Repechaje (9º)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-700 inline-block" /> Descenso directo (10º)</span>
              </div>
            </div>

            {/* Method note */}
            <div className="rounded-xl border border-border bg-card/40 p-4 flex gap-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>
                Cada partido restante se simula con un modelo de ataque/defensa ajustado a los resultados
                de esta temporada, con ventaja de localía. Se reparten los puntos del rugby (4 por ganar,
                2 por empate, +1 bonus ofensivo y +1 defensivo por perder por ≤7). Los cuatro primeros
                juegan playoffs (SF: 1º-4º y 2º-3º, luego la final). El bonus ofensivo de los partidos
                simulados es una estimación, ya que el feed no publica los tries por adelantado.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HighlightCard({ icon, title, accent, children }: { icon: React.ReactNode; title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-3 ${accent}`}>
        {icon} {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function StatRow({ team, value, sub }: { team: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <ClubBadge team={team} size={22} />
        <span className="text-sm font-medium truncate">{team}</span>
      </div>
      <div className="text-right">
        <span className="text-sm font-bold tabular-nums">{value}</span>
        {sub && <span className="block text-[10px] text-muted-foreground tabular-nums">{sub}</span>}
      </div>
    </div>
  );
}

function ProbBar({ p }: { p: number }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, p))}%` }} />
      </div>
      <span className="w-9 text-right">{pct(p)}</span>
    </div>
  );
}
