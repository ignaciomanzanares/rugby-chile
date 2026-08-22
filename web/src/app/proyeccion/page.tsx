"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Trophy, ShieldAlert, ArrowDownCircle, Info, Wand2, RotateCcw, ArrowUp, ArrowDown } from "lucide-react";
import { ClubLogo } from "@/components/club-logo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type TeamProjection = {
  team: string;
  currentPos: number;
  currentPts: number;
  currentDiff: number;
  currentPf: number;
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

type MatchPrediction = {
  round: number;
  home: string;
  away: string;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  expHome: number;
  expAway: number;
};

type SeasonProjection = {
  division: string;
  simulations: number;
  playedRounds: number;
  remainingMatches: number;
  generatedAt: string;
  teams: TeamProjection[];
  matches: MatchPrediction[];
};

type ValidationGame = {
  date: string; home: string; away: string; hs: number; as: number;
  pHome: number; pDraw: number; pAway: number; expHome: number; expAway: number;
  outcome: "H" | "D" | "A"; predicted: "H" | "D" | "A"; hit: boolean; pWinner: number;
};
type ModelAccuracy = {
  sinceYear: number;
  summary: { n: number; hits: number; accuracy: number; logloss: number; brier: number; drawShare: number };
  calibration: { label: string; predicted: number; actual: number; count: number }[];
  games: ValidationGame[];
};

const IMPOSSIBLE_SCORES = new Set([1, 2, 4]);

function ClubBadge({ team, size = 28 }: { team: string; size?: number }) {
  // stopPropagation: some projection rows sit inside interactive controls; a
  // role=link span navigates to the club without interfering with them.
  return <ClubLogo team={team} stopPropagation size={size} className="rounded-full object-cover flex-shrink-0 ring-1 ring-border" />;
}

function pct(n: number) {
  if (n <= 0) return "0%";
  if (n < 1) return "<1%";
  if (n > 99 && n < 100) return ">99%";
  return `${Math.round(n)}%`;
}

function zoneClasses(pos: number) {
  if (pos <= 4) return "bg-emerald-600 text-white";
  if (pos === 9) return "bg-amber-500 text-zinc-950";
  if (pos === 10) return "bg-red-700 text-white";
  return "bg-secondary text-foreground";
}

export default function ProyeccionPage() {
  const [data, setData] = useState<SeasonProjection | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/api/v1/predict/season`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-emerald-500 text-xs font-semibold uppercase tracking-wide mb-2">
            <TrendingUp className="h-4 w-4" /> Proyección del torneo
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">¿Cómo termina el Top 10?</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Simulación Monte Carlo de las fechas que faltan, y una tabla que puedes armar con los
            resultados que creas. Combina la tabla actual, la forma de esta temporada, el historial de
            torneos pasados y el head-to-head de cada cruce.
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

      <div className="container mx-auto px-4 py-8">
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
          <Tabs defaultValue="proyeccion">
            <TabsList className="bg-card border border-border p-1 h-auto gap-1 mb-6 flex-wrap">
              <TabsTrigger value="proyeccion" className="data-active:bg-emerald-600 data-active:text-white px-4 py-2">
                Proyección
              </TabsTrigger>
              <TabsTrigger value="pronosticos" className="data-active:bg-emerald-600 data-active:text-white px-4 py-2">
                Partido a partido
              </TabsTrigger>
              <TabsTrigger value="simular" className="data-active:bg-emerald-600 data-active:text-white px-4 py-2">
                Simula la tabla
              </TabsTrigger>
              <TabsTrigger value="aciertos" className="data-active:bg-emerald-600 data-active:text-white px-4 py-2">
                Aciertos del modelo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="proyeccion">
              <ProjectionView data={data} />
            </TabsContent>
            <TabsContent value="pronosticos">
              <MatchOddsView data={data} />
            </TabsContent>
            <TabsContent value="simular">
              <WhatIfView data={data} />
            </TabsContent>
            <TabsContent value="aciertos">
              <MatchAccuracyView />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

// ── Proyección (Monte Carlo) ─────────────────────────────────────────────────
function ProjectionView({ data }: { data: SeasonProjection }) {
  const teams = data.teams;
  const titleRace = useMemo(() => [...teams].sort((a, b) => b.championPct - a.championPct).slice(0, 3), [teams]);
  // Sólo equipos con riesgo real de descenso o repechaje (≥1%). Antes se tomaban
  // los 3 con mayor relegationPct sin filtrar, así que si sólo 1-2 equipos tenían
  // riesgo, el 3er puesto lo llenaba cualquiera con 0% — incluso el líder (COBS),
  // que salía en "zona de descenso" con 0% y confundía.
  const dropRace = useMemo(
    () => [...teams]
      .filter((t) => Math.max(t.relegationPct, t.repechajePct) >= 1)
      .sort((a, b) => (b.relegationPct - a.relegationPct) || (b.repechajePct - a.repechajePct))
      .slice(0, 3),
    [teams],
  );
  const bubble = useMemo(
    () => [...teams].filter((t) => t.playoffPct > 5 && t.playoffPct < 95).sort((a, b) => b.playoffPct - a.playoffPct),
    [teams],
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <HighlightCard icon={<Trophy className="h-4 w-4" />} title="Favoritos al título" accent="text-emerald-500">
          {titleRace.map((t) => <StatRow key={t.team} team={t.team} value={pct(t.championPct)} />)}
        </HighlightCard>
        <HighlightCard icon={<ShieldAlert className="h-4 w-4" />} title="En pelea por playoffs" accent="text-blue-400">
          {bubble.length === 0 && <p className="text-xs text-muted-foreground">Top 4 prácticamente definido.</p>}
          {bubble.map((t) => <StatRow key={t.team} team={t.team} value={pct(t.playoffPct)} />)}
        </HighlightCard>
        <HighlightCard icon={<ArrowDownCircle className="h-4 w-4" />} title="Zona de descenso" accent="text-red-400">
          {dropRace.length === 0 && <p className="text-xs text-muted-foreground">Sin riesgo de descenso todavía.</p>}
          {dropRace.map((t) => <StatRow key={t.team} team={t.team} value={pct(t.relegationPct)} sub={`rep. ${pct(t.repechajePct)}`} />)}
        </HighlightCard>
      </div>

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
                    <span className={`inline-flex w-7 h-7 items-center justify-center rounded text-xs font-bold ${zoneClasses(t.projectedPos)}`}>{t.projectedPos}</span>
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2.5"><ClubBadge team={t.team} /><span className="font-medium">{t.team}</span></div>
                  </td>
                  <td className="py-2.5 px-2 text-center text-muted-foreground tabular-nums">{t.currentPos}º<span className="text-xs"> · {t.currentPts}pt</span></td>
                  <td className="py-2.5 px-2 text-right font-semibold tabular-nums">{t.avgPts.toFixed(1)}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums"><ProbBar p={t.playoffPct} /></td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">{pct(t.finalPct)}</td>
                  <td className="py-2.5 pr-4 pl-2 text-right font-semibold tabular-nums text-emerald-500">{pct(t.championPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-1">Probabilidad de terminar en cada puesto</h2>
        <p className="text-xs text-muted-foreground mb-3">% de las simulaciones en que cada club cierra la fase regular en esa posición.</p>
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="bg-card/80 text-muted-foreground text-xs">
                <th className="text-left font-semibold py-2.5 pl-4 pr-2 uppercase tracking-wide">Equipo</th>
                {Array.from({ length: 10 }, (_, i) => <th key={i} className="font-semibold py-2.5 px-1 text-center w-9">{i + 1}º</th>)}
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.team} className="border-t border-border">
                  <td className="py-1 pl-4 pr-2">
                    <div className="flex items-center gap-2"><ClubBadge team={t.team} size={22} /><span className="font-medium text-xs whitespace-nowrap">{t.team}</span></div>
                  </td>
                  {t.posDist.map((p, col) => <HeatCell key={col} p={p} col={col} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ZoneLegend />
      </div>

      <MethodNote />
    </div>
  );
}

// ── Partido a partido (1/X/2 del modelo) ─────────────────────────────────────
function MatchOddsView({ data }: { data: SeasonProjection }) {
  const rounds = useMemo(() => {
    const by = new Map<number, MatchPrediction[]>();
    for (const m of data.matches) { if (!by.has(m.round)) by.set(m.round, []); by.get(m.round)!.push(m); }
    return [...by.entries()].sort((a, b) => a[0] - b[0]);
  }, [data.matches]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground max-w-2xl">
        Probabilidad de cada resultado en los {data.remainingMatches} partidos que faltan, según el
        modelo. <b className="text-foreground">1</b> = gana el local, <b className="text-foreground">X</b> =
        empate, <b className="text-foreground">2</b> = gana la visita. El marcador es el esperado (promedio).
      </p>

      {rounds.map(([round, matches]) => (
        <div key={round}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Fecha {round}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {matches.map((m) => <OddsCard key={`${m.home}-${m.away}`} m={m} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function OddsCard({ m }: { m: MatchPrediction }) {
  const homeFav = m.homeWinPct >= m.awayWinPct;
  const seg = (p: number) => `${Math.max(0, p)}%`;
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3.5">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
          <span className={`text-sm truncate ${homeFav ? "font-bold" : "font-medium"}`}>{m.home}</span>
          <ClubBadge team={m.home} size={26} />
        </div>
        <span className="text-xs font-mono tabular-nums text-muted-foreground px-1.5">{Math.round(m.expHome)}–{Math.round(m.expAway)}</span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ClubBadge team={m.away} size={26} />
          <span className={`text-sm truncate ${!homeFav ? "font-bold" : "font-medium"}`}>{m.away}</span>
        </div>
      </div>

      {/* Barra apilada 1/X/2 */}
      <div className="mt-3 flex h-2.5 rounded-full overflow-hidden bg-secondary" role="img"
        aria-label={`Local ${Math.round(m.homeWinPct)}%, empate ${Math.round(m.drawPct)}%, visita ${Math.round(m.awayWinPct)}%`}>
        <div className="bg-emerald-500" style={{ width: seg(m.homeWinPct) }} />
        <div className="bg-amber-400/70" style={{ width: seg(m.drawPct) }} />
        <div className="bg-sky-500" style={{ width: seg(m.awayWinPct) }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs tabular-nums">
        <span className={`flex items-center gap-1.5 ${homeFav ? "font-bold text-foreground" : "text-muted-foreground"}`}>
          <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />1 {Math.round(m.homeWinPct)}%
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-2 h-2 rounded-sm bg-amber-400/70 inline-block" />X {Math.round(m.drawPct)}%
        </span>
        <span className={`flex items-center gap-1.5 ${!homeFav ? "font-bold text-foreground" : "text-muted-foreground"}`}>
          <span className="w-2 h-2 rounded-sm bg-sky-500 inline-block" />2 {Math.round(m.awayWinPct)}%
        </span>
      </div>
    </div>
  );
}

// ── Simula la tabla (what-if manual) ─────────────────────────────────────────
type Entry = { h: string; a: string };
const matchKey = (m: { round: number; home: string; away: string }) => `${m.round}|${m.home}|${m.away}`;
const validScore = (n: number) => Number.isInteger(n) && n >= 0 && !IMPOSSIBLE_SCORES.has(n);
const nearestValid = (x: number) => { let n = Math.max(0, Math.round(x)); while (IMPOSSIBLE_SCORES.has(n)) n += 1; return n; };

function WhatIfView({ data }: { data: SeasonProjection }) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [autoBonus, setAutoBonus] = useState(true);

  const rounds = useMemo(() => {
    const by = new Map<number, MatchPrediction[]>();
    for (const m of data.matches) { if (!by.has(m.round)) by.set(m.round, []); by.get(m.round)!.push(m); }
    return [...by.entries()].sort((a, b) => a[0] - b[0]);
  }, [data.matches]);

  const setScore = (k: string, side: "h" | "a", v: string) =>
    setEntries((e) => ({ ...e, [k]: { ...(e[k] ?? { h: "", a: "" }), [side]: v.replace(/[^0-9]/g, "").slice(0, 3) } }));

  const fillWithModel = () => {
    const next: Record<string, Entry> = {};
    for (const m of data.matches) next[matchKey(m)] = { h: String(nearestValid(m.expHome)), a: String(nearestValid(m.expAway)) };
    setEntries(next);
  };
  const clearAll = () => setEntries({});

  // Live standings: start from the current real table, apply every completed
  // manual result (both scores valid). Rugby points, exact losing bonus, and an
  // optional estimated attacking bonus (4+ tries ≈ 25+ points scored).
  const { table, playedCount } = useMemo(() => {
    type Row = { team: string; pj: number; pts: number; diff: number; pf: number };
    const rows = new Map<string, Row>();
    for (const t of data.teams) rows.set(t.team, { team: t.team, pj: data.playedRounds, pts: t.currentPts, diff: t.currentDiff, pf: t.currentPf });

    let played = 0;
    for (const m of data.matches) {
      const e = entries[matchKey(m)];
      if (!e) continue;
      const hs = Number(e.h), as = Number(e.a);
      if (e.h === "" || e.a === "" || !validScore(hs) || !validScore(as)) continue;
      const home = rows.get(m.home), away = rows.get(m.away);
      if (!home || !away) continue;
      played++;
      home.pj++; away.pj++;
      home.pf += hs; away.pf += as;
      home.diff += hs - as; away.diff += as - hs;
      const draw = hs === as, homeWin = hs > as;
      let hp = draw ? 2 : homeWin ? 4 : 0;
      let ap = draw ? 2 : homeWin ? 0 : 4;
      if (autoBonus && hs >= 25) hp += 1;
      if (autoBonus && as >= 25) ap += 1;
      if (!draw && !homeWin && as - hs <= 7) hp += 1;
      if (!draw && homeWin && hs - as <= 7) ap += 1;
      home.pts += hp; away.pts += ap;
    }
    const table = [...rows.values()].sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.pf - a.pf).map((r, i) => ({ ...r, pos: i + 1 }));
    return { table, playedCount: played };
  }, [entries, autoBonus, data]);

  const currentPos = useMemo(() => new Map(data.teams.map((t) => [t.team, t.currentPos])), [data.teams]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,380px)]">
      {/* Fixtures with inputs */}
      <div className="space-y-5 order-2 lg:order-1">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={fillWithModel} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 transition-colors">
            <Wand2 className="h-3.5 w-3.5" /> Rellenar con el pronóstico
          </button>
          <button onClick={clearAll} className="inline-flex items-center gap-1.5 rounded-lg border border-border hover:border-foreground/30 text-muted-foreground hover:text-foreground text-xs font-semibold px-3 py-2 transition-colors">
            <RotateCcw className="h-3.5 w-3.5" /> Limpiar
          </button>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer ml-auto">
            <input type="checkbox" checked={autoBonus} onChange={(e) => setAutoBonus(e.target.checked)} className="accent-emerald-600" />
            Estimar bonus ofensivo (25+ pts)
          </label>
        </div>

        {rounds.map(([round, matches]) => (
          <div key={round}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Fecha {round}</h3>
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {matches.map((m) => {
                const k = matchKey(m);
                const e = entries[k] ?? { h: "", a: "" };
                return (
                  <div key={k} className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
                        <span className="font-medium text-sm truncate">{m.home}</span>
                        <ClubBadge team={m.home} size={24} />
                      </div>
                      <input inputMode="numeric" value={e.h} onChange={(ev) => setScore(k, "h", ev.target.value)} placeholder="–"
                        className="w-11 text-center rounded-md border border-border bg-background py-1.5 text-sm font-semibold tabular-nums focus:border-emerald-500 focus:outline-none" />
                      <span className="text-muted-foreground text-xs">-</span>
                      <input inputMode="numeric" value={e.a} onChange={(ev) => setScore(k, "a", ev.target.value)} placeholder="–"
                        className="w-11 text-center rounded-md border border-border bg-background py-1.5 text-sm font-semibold tabular-nums focus:border-emerald-500 focus:outline-none" />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <ClubBadge team={m.away} size={24} />
                        <span className="font-medium text-sm truncate">{m.away}</span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                      <span title="Pronóstico del modelo">Modelo: {Math.round(m.expHome)}–{Math.round(m.expAway)}</span>
                      <span className="opacity-70">·</span>
                      <span className="text-emerald-500/90">{Math.round(m.homeWinPct)}%</span>
                      <span>X {Math.round(m.drawPct)}%</span>
                      <span className="text-emerald-500/90">{Math.round(m.awayWinPct)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Live table (sticky) */}
      <div className="order-1 lg:order-2">
        <div className="lg:sticky lg:top-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-lg font-bold">Tabla en vivo</h2>
            <span className="text-xs text-muted-foreground">{playedCount}/{data.matches.length} cargados</span>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-card/80 text-muted-foreground text-[11px] uppercase tracking-wide">
                  <th className="text-left font-semibold py-2.5 pl-3 pr-1">#</th>
                  <th className="text-left font-semibold py-2.5 px-1">Equipo</th>
                  <th className="text-center font-semibold py-2.5 px-1">PJ</th>
                  <th className="text-right font-semibold py-2.5 px-1">Dif</th>
                  <th className="text-right font-semibold py-2.5 pr-3 pl-1">Pts</th>
                </tr>
              </thead>
              <tbody>
                {table.map((r) => {
                  const prev = currentPos.get(r.team) ?? r.pos;
                  const move = prev - r.pos;
                  return (
                    <tr key={r.team} className="border-t border-border">
                      <td className="py-2 pl-3 pr-1">
                        <span className={`inline-flex w-6 h-6 items-center justify-center rounded text-[11px] font-bold ${zoneClasses(r.pos)}`}>{r.pos}</span>
                      </td>
                      <td className="py-2 px-1">
                        <div className="flex items-center gap-2">
                          <ClubBadge team={r.team} size={22} />
                          <span className="font-medium text-xs truncate">{r.team}</span>
                          {move !== 0 && (
                            <span className={`inline-flex items-center text-[10px] font-semibold ${move > 0 ? "text-emerald-500" : "text-red-400"}`}>
                              {move > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(move)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-1 text-center tabular-nums text-muted-foreground">{r.pj}</td>
                      <td className={`py-2 px-1 text-right tabular-nums ${r.diff > 0 ? "text-emerald-500" : r.diff < 0 ? "text-red-400" : "text-muted-foreground"}`}>{r.diff > 0 ? "+" : ""}{r.diff}</td>
                      <td className="py-2 pr-3 pl-1 text-right font-bold tabular-nums">{r.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ZoneLegend />
          <p className="text-[11px] text-muted-foreground mt-2">
            Carga los marcadores que creas y la tabla se reordena sola. Las flechas comparan con la posición de hoy.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Aciertos del modelo (validación en vivo) ─────────────────────────────────
function MatchAccuracyView() {
  const [data, setData] = useState<ModelAccuracy | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/api/v1/predict/accuracy?since=2025`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, []);

  if (failed) return <div className="rounded-xl border border-border p-6 text-center text-muted-foreground">No se pudo cargar la validación.</div>;
  if (!data) return <div className="rounded-xl border border-border p-10 text-center text-muted-foreground animate-pulse">Reconstruyendo pronósticos…</div>;

  const s = data.summary;
  const outLabel = (g: ValidationGame) => (g.predicted === "H" ? g.home : g.predicted === "A" ? g.away : "empate");

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground max-w-2xl">
        Para cada partido ya jugado desde {data.sinceYear}, reconstruyo el 1/X/2 que el modelo habría dado
        <b className="text-foreground"> usando solo datos previos</b> a ese partido (sin trampa) y lo comparo con
        lo que pasó. Se actualiza solo cada fecha.
      </p>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Acierto" value={`${Math.round(s.accuracy * 100)}%`} sub={`${s.hits}/${s.n} partidos`} tone="good" />
        <StatTile label="Brier" value={s.brier.toFixed(3)} sub="error · menos es mejor" />
        <StatTile label="Log-loss" value={s.logloss.toFixed(3)} sub="calidad de las probabilidades" />
        <StatTile label="Empates reales" value={`${Math.round(s.drawShare * 100)}%`} sub="del total jugado" />
      </div>

      {/* Reliability curve */}
      <div>
        <h2 className="text-lg font-bold mb-1">Calibración</h2>
        <p className="text-xs text-muted-foreground mb-3">Cuando el modelo dice “X%”, ¿pasa el X% de las veces? Cuanto más cerca “dice” de “real”, mejor calibrado.</p>
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {data.calibration.map((c) => {
            const off = Math.abs(c.predicted - c.actual);
            const tone = off <= 0.08 ? "text-emerald-500" : off <= 0.15 ? "text-amber-500" : "text-red-400";
            return (
              <div key={c.label} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-20 flex-shrink-0 text-muted-foreground tabular-nums">{c.label}</span>
                <div className="flex-1 relative h-6">
                  <div className="absolute inset-y-0 left-0 right-0 my-auto h-1.5 rounded-full bg-secondary" />
                  <div className="absolute inset-y-0 left-0 my-auto h-1.5 rounded-full bg-emerald-500/40" style={{ width: `${c.actual * 100}%` }} />
                  {/* predicted marker */}
                  <div className="absolute inset-y-0 my-auto w-0.5 h-4 bg-foreground rounded" style={{ left: `${c.predicted * 100}%` }} title={`dice ${Math.round(c.predicted * 100)}%`} />
                </div>
                <span className={`w-28 flex-shrink-0 text-right tabular-nums text-xs ${tone}`}>
                  dice {Math.round(c.predicted * 100)}% → real {Math.round(c.actual * 100)}%
                </span>
                <span className="w-10 text-right text-[11px] text-muted-foreground tabular-nums">n={c.count}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-foreground inline-block" /> lo que dice el modelo</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-emerald-500/40 inline-block" /> lo que pasó de verdad</span>
        </div>
      </div>

      {/* Games list */}
      <div>
        <h2 className="text-lg font-bold mb-3">Partido a partido</h2>
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {data.games.map((g, i) => (
            <div key={`${g.date}-${g.home}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
              <span className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-[11px] font-bold flex-shrink-0 ${g.hit ? "bg-emerald-600/20 text-emerald-400" : "bg-red-600/20 text-red-400"}`}>
                {g.hit ? "✓" : "✗"}
              </span>
              <span className="text-[11px] text-muted-foreground w-16 flex-shrink-0 tabular-nums">{g.date.slice(5)}</span>
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <ClubBadge team={g.home} size={20} />
                <span className={`text-xs truncate ${g.outcome === "H" ? "font-bold" : ""}`}>{g.home}</span>
                <span className="font-mono text-xs tabular-nums px-1">{g.hs}-{g.as}</span>
                <span className={`text-xs truncate ${g.outcome === "A" ? "font-bold" : ""}`}>{g.away}</span>
                <ClubBadge team={g.away} size={20} />
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums flex-shrink-0 hidden sm:block text-right">
                proyectaba <span className="font-mono text-foreground/70">{Math.round(g.expHome)}–{Math.round(g.expAway)}</span>
                <span className="mx-1">·</span>daba {outLabel(g)} {Math.round(g.pWinner * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
      <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-black ${tone === "good" ? "text-emerald-400" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── shared bits ──────────────────────────────────────────────────────────────
function HeatCell({ p, col }: { p: number; col: number }) {
  const alpha = p <= 0 ? 0 : Math.max(0.06, Math.min(1, p / 45));
  const hue = col < 4 ? "16 185 129" : col === 9 ? "180 83 9" : col === 8 ? "217 119 6" : "100 116 139";
  return (
    <td className="text-center p-0">
      <div className="mx-auto flex items-center justify-center text-[10px] tabular-nums h-9 w-full"
        style={{ background: p > 0 ? `rgb(${hue} / ${alpha})` : "transparent", color: alpha > 0.6 ? "white" : undefined }}
        title={`${pct(p)} de terminar ${col + 1}º`}>
        {p >= 1 ? Math.round(p) : ""}
      </div>
    </td>
  );
}

function ZoneLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-600 inline-block" /> Playoffs (1º–4º)</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Repechaje (9º)</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-700 inline-block" /> Descenso directo (10º)</span>
    </div>
  );
}

function MethodNote() {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4 flex gap-3 text-xs text-muted-foreground">
      <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <p>
        Cada partido restante se simula con un modelo de ataque/defensa <strong>ajustado por rival</strong>
        (fuerza de calendario) y por los <strong>resultados reales</strong>, no solo por el marcador, para
        no sobrevalorar a un equipo que golea pero pierde. La fuerza de cada club la manda sobre todo
        <strong>lo que va del campeonato actual</strong> (≈3/4 del peso), apoyada por su historial de
        <strong>torneos pasados</strong> (2021–2026, con más peso a lo reciente y menos si el club tiene
        pocos antecedentes), y cada cruce se ajusta por el <strong>head-to-head</strong> histórico entre
        esos dos equipos. Se suma la ventaja de localía y se reparten los puntos del rugby (4 por
        ganar, 2 por empate, +1 bonus ofensivo y +1 defensivo por perder por ≤7). Los cuatro primeros
        juegan playoffs (SF: 1º-4º y 2º-3º, luego la final). El bonus ofensivo de los partidos simulados
        es una estimación, ya que el feed no publica los tries por adelantado.
      </p>
    </div>
  );
}

function HighlightCard({ icon, title, accent, children }: { icon: React.ReactNode; title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-3 ${accent}`}>{icon} {title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function StatRow({ team, value, sub }: { team: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0"><ClubBadge team={team} size={22} /><span className="text-sm font-medium truncate">{team}</span></div>
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
      <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, p))}%` }} /></div>
      <span className="w-9 text-right">{pct(p)}</span>
    </div>
  );
}
