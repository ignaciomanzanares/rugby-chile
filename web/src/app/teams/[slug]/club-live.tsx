"use client";

import { useMemo, type ReactNode } from "react";
import { Zap, Target, Trophy } from "lucide-react";
import { useArusaPlayerStats } from "@/lib/use-arusa-player-stats";
import { useLeveradeStandings } from "@/lib/use-leverade-standings";
import type { Player, ClubStanding } from "@/data/clubs";
import type { StandingRow } from "@/lib/tournament";

const GRADE_LABELS = ["Primera", "Intermedia", "Pre-Intermedia"] as const;

function CardShell({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

function CardSkeleton() {
  return (
    <>
      <div className="h-7 w-16 rounded bg-muted/50 animate-pulse" />
      <div className="h-4 w-32 rounded bg-muted/40 animate-pulse mt-2" />
      <div className="h-3 w-24 rounded bg-muted/30 animate-pulse mt-1.5" />
    </>
  );
}

type SummaryRow = { division: string; pos: number; pts: number; pg: number; pe: number; pp: number; pf: number; pc: number };

/** Hero position cards for all 3 grades — live arusa standings.
 * Mientras carga la fuente real mostramos skeleton (no el baseline estático:
 * ese era el flash #10·6pts → #4·36pts). El estático queda solo como último
 * recurso si el fetch ya resolvió y no hay fila real para el equipo. */
export type ClubStandingsSeed = {
  PRIMERA: StandingRow[] | null;
  INTERMEDIA: StandingRow[] | null;
  PRE_INTERMEDIA: StandingRow[] | null;
};

export function ClubStandingsSummary({
  teamName,
  fallback,
  initial,
}: {
  teamName: string;
  fallback: ClubStanding[];
  // Filas sembradas en el server (las 3 divisiones juntas) → salen al día en el
  // primer paint, sin el skeleton escalonado que se veía al cargar de a una.
  initial?: ClubStandingsSeed;
}) {
  const byLabel: Record<string, { rows: StandingRow[] | null; loading: boolean }> = {
    Primera: useLeveradeStandings("PRIMERA", initial?.PRIMERA),
    Intermedia: useLeveradeStandings("INTERMEDIA", initial?.INTERMEDIA),
    "Pre-Intermedia": useLeveradeStandings("PRE_INTERMEDIA", initial?.PRE_INTERMEDIA),
  };

  return (
    <div className="flex flex-wrap gap-3 mt-8">
      {GRADE_LABELS.map((label) => {
        const src = byLabel[label];
        const live = src.rows?.find((r) => r.team === teamName);
        const fb = fallback.find((s) => s.division === label);
        const s: SummaryRow | null = live
          ? { division: label, pos: live.pos, pts: live.pts, pg: live.pg, pe: live.pe, pp: live.pp, pf: live.pf, pc: live.pc }
          : src.loading
            ? null
            : fb
              ? { division: label, pos: fb.pos, pts: fb.pts, pg: fb.pg, pe: fb.pe, pp: fb.pp, pf: fb.pf, pc: fb.pc }
              : null;

        // Cargando (sin dato real todavía): skeleton.
        if (!s && src.loading) {
          return (
            <div key={label} className="rounded-xl border border-border bg-card/60 px-4 py-3 min-w-36">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">{label}</p>
              <div className="h-7 rounded bg-muted/50 animate-pulse mb-2" />
              <div className="h-3 w-24 rounded bg-muted/40 animate-pulse" />
            </div>
          );
        }
        if (!s) return null; // ya cargó y no hay fila ni fallback

        const isPrimera = label === "Primera";
        const posColor =
          s.pos <= 4 ? "text-emerald-400" :
          isPrimera && s.pos === 9 ? "text-amber-400" :
          isPrimera && s.pos === 10 ? "text-red-400" :
          "text-foreground";
        return (
          <div key={s.division} className="rounded-xl border border-border bg-card/60 px-4 py-3 min-w-36">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">{s.division}</p>
            <div className="flex items-end gap-3">
              <span className={`text-2xl font-black ${posColor}`}>#{s.pos}</span>
              <div className="text-right ml-auto">
                <p className="text-xl font-black text-foreground">{s.pts}</p>
                <p className="text-muted-foreground/70 text-xs">pts</p>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {s.pg}G{s.pe > 0 ? ` · ${s.pe}E` : ""} · {s.pp}P · {s.pf}-{s.pc}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The three highlight cards — live arusa player stats + Primera standing, static fallback. */
export function ClubHighlights({
  teamName, teamSlug, fallbackTopScorer, fallbackTopTry, fallbackPrimera, initialPrimera,
}: {
  teamName: string;
  teamSlug: string;
  fallbackTopScorer?: Player;
  fallbackTopTry?: Player;
  fallbackPrimera?: ClubStanding;
  initialPrimera?: StandingRow[] | null; // tabla de Primera sembrada en el server
}) {
  // Pull all 3 grades and accumulate a player's stats across them (arusa id is
  // stable), so the club's try-leader / top-scorer reflect SEASON TOTALS — a
  // player who scores in Intermedia + Pre outranks a Primera-only scorer.
  const { players: primeraStats, loading: pL } = useArusaPlayerStats("PRIMERA");
  const { players: interStats, loading: iL } = useArusaPlayerStats("INTERMEDIA");
  const { players: preStats, loading: preL } = useArusaPlayerStats("PRE_INTERMEDIA");
  const statsLoading = pL || iL || preL;

  const clubPlayers = useMemo(() => {
    const all = [primeraStats, interStats, preStats].flatMap((g) => g ?? []);
    const inClub = all.filter((p) => (p as { teamSlug?: string }).teamSlug === teamSlug);
    if (inClub.length === 0) return null;
    const byId = new Map<string, Player>();
    for (const p of inClub as unknown as Player[]) {
      const cur = byId.get(p.id);
      if (cur) {
        cur.matches += p.matches; cur.points += p.points; cur.tries += p.tries;
        cur.penaltyTries += p.penaltyTries; cur.conversions += p.conversions;
        cur.penalties += p.penalties; cur.drops += p.drops;
        cur.yellowCards += p.yellowCards; cur.redCards += p.redCards; cur.mvp += p.mvp;
      } else {
        byId.set(p.id, { ...p });
      }
    }
    return [...byId.values()];
  }, [primeraStats, interStats, preStats, teamSlug]);

  // Mientras cargan las stats reales NO usamos el fallback estático (Fecha 4):
  // ese era el flash de "líder/goleador antiguo". Skeleton hasta tener datos.
  const topScorer = clubPlayers && clubPlayers.length
    ? [...clubPlayers].sort((a, b) => b.points - a.points)[0]
    : statsLoading ? undefined : fallbackTopScorer;
  const topTry = clubPlayers && clubPlayers.length
    ? [...clubPlayers].filter((p) => p.tries > 0).sort((a, b) => b.tries - a.tries)[0]
    : statsLoading ? undefined : fallbackTopTry;

  const primeraStd = useLeveradeStandings("PRIMERA", initialPrimera);
  const live = primeraStd.rows?.find((r) => r.team === teamName);
  const primera = live ?? (primeraStd.loading ? undefined : fallbackPrimera);

  return (
    <section className="grid sm:grid-cols-3 gap-4">
      <CardShell icon={<Zap className="h-4 w-4 text-emerald-400" />} label="Líder en tries">
        {statsLoading && !topTry ? <CardSkeleton /> : topTry ? (
          <>
            <p className="text-2xl font-black text-foreground">{topTry.tries}</p>
            <p className="text-foreground/80 font-semibold text-sm mt-1">{topTry.name}</p>
            <p className="text-muted-foreground text-xs mt-0.5">{topTry.matches} partidos jugados</p>
          </>
        ) : <p className="text-muted-foreground text-sm">Sin datos</p>}
      </CardShell>

      <CardShell icon={<Target className="h-4 w-4 text-blue-400" />} label="Máximo goleador">
        {statsLoading && !topScorer ? <CardSkeleton /> : topScorer ? (
          <>
            <p className="text-2xl font-black text-foreground">{topScorer.points} pts</p>
            <p className="text-foreground/80 font-semibold text-sm mt-1">{topScorer.name}</p>
            <p className="text-muted-foreground text-xs mt-0.5">{topScorer.tries}T · {topScorer.conversions}C · {topScorer.penalties}P</p>
          </>
        ) : <p className="text-muted-foreground text-sm">Sin datos</p>}
      </CardShell>

      <CardShell icon={<Trophy className="h-4 w-4 text-red-400" />} label="Primera">
        {primeraStd.loading && !primera ? <CardSkeleton /> : primera ? (
          <>
            <p className={`text-2xl font-black ${primera.pos <= 4 ? "text-emerald-400" : primera.pos >= 9 ? "text-red-400" : "text-foreground"}`}>
              #{primera.pos} · {primera.pts} pts
            </p>
            <p className="text-foreground/80 font-semibold text-sm mt-1">{primera.pg}G{primera.pe > 0 ? ` · ${primera.pe}E` : ""} · {primera.pp}P</p>
            <p className="text-muted-foreground text-xs mt-0.5">{primera.pf} pts a favor · {primera.pc} en contra</p>
          </>
        ) : <p className="text-muted-foreground text-sm">Sin datos</p>}
      </CardShell>
    </section>
  );
}
