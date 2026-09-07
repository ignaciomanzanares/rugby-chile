import type { DivisionKey } from "@/lib/tournament";
import { canonicalize } from "@/lib/leverade";
import type { LeveradeResult } from "@/lib/use-leverade-results";

/**
 * Desempate de la tabla de posiciones.
 *
 * Ante igualdad de puntos manda el ENFRENTAMIENTO DIRECTO, no la diferencia
 * general: primero quién ganó los partidos entre los equipos empatados y, si
 * quedaron 1-1 (o el mini-torneo quedó igualado), la diferencia de puntos
 * acumulada EN ESOS partidos. Recién ahí se cae a la diferencia general.
 *
 * OJO: hay una copia gemela en api/src/lib/standingsTiebreak.ts. La API ordena
 * la tabla que sirve, y acá se reordena al superponer los partidos en vivo. Si
 * tocas una, toca la otra o las dos tablas se contradicen.
 */
export interface HeadToHeadMatch {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

/** Lo mínimo que una fila necesita para poder ordenarse. */
export interface TiebreakRow {
  team: string;
  pts: number;
  diff: number;
  pf: number;
  /** Lo asigna sortStandings; no hace falta traerlo. */
  pos?: number;
}

interface MiniStat { w: number; d: number; pf: number; pc: number }

/** Saca los partidos ya jugados de una división desde el mapa de resultados. */
export function headToHeadFrom(
  results: Map<string, LeveradeResult>,
  division: DivisionKey,
): HeadToHeadMatch[] {
  const out: HeadToHeadMatch[] = [];
  for (const [key, r] of results) {
    if (!r.finished || r.homeScore == null || r.awayScore == null) continue;
    const [div, homeTeam, awayTeam] = key.split("|");
    if (div !== division || !homeTeam || !awayTeam) continue;
    out.push({ homeTeam, awayTeam, homeScore: r.homeScore, awayScore: r.awayScore });
  }
  return out;
}

/** Ordena y renumera la tabla completa aplicando el desempate por directo. */
export function sortStandings<T extends TiebreakRow>(rows: T[], matches: HeadToHeadMatch[]): T[] {
  const byPts = [...rows].sort((a, b) => b.pts - a.pts);
  const out: T[] = [];
  for (let i = 0; i < byPts.length; ) {
    let j = i;
    while (j + 1 < byPts.length && byPts[j + 1].pts === byPts[i].pts) j++;
    const tied = byPts.slice(i, j + 1);
    out.push(...(tied.length === 1 ? tied : orderTiedGroup(tied, matches)));
    i = j + 1;
  }
  return out.map((r, i) => ({ ...r, pos: i + 1 }));
}

/** Mini-torneo entre los equipos empatados en puntos. */
function orderTiedGroup<T extends TiebreakRow>(tied: T[], matches: HeadToHeadMatch[]): T[] {
  const stat = new Map<string, MiniStat>();
  for (const r of tied) stat.set(canonicalize(r.team), { w: 0, d: 0, pf: 0, pc: 0 });

  for (const m of matches) {
    const h = canonicalize(m.homeTeam);
    const a = canonicalize(m.awayTeam);
    if (h === a) continue;
    const sh = stat.get(h);
    const sa = stat.get(a);
    if (!sh || !sa) continue; // alguno no está empatado → el partido no cuenta
    sh.pf += m.homeScore; sh.pc += m.awayScore;
    sa.pf += m.awayScore; sa.pc += m.homeScore;
    if (m.homeScore > m.awayScore) sh.w += 1;
    else if (m.homeScore < m.awayScore) sa.w += 1;
    else { sh.d += 1; sa.d += 1; }
  }

  return [...tied].sort((x, y) => {
    const sx = stat.get(canonicalize(x.team))!;
    const sy = stat.get(canonicalize(y.team))!;
    // 1) Enfrentamiento directo: victorias (el empate vale medio, por eso ×2 +1).
    const wx = sx.w * 2 + sx.d;
    const wy = sy.w * 2 + sy.d;
    if (wx !== wy) return wy - wx;
    // 2) Quedaron 1-1 → diferencia de puntos en esos mismos partidos.
    const dx = sx.pf - sx.pc;
    const dy = sy.pf - sy.pc;
    if (dx !== dy) return dy - dx;
    // 3) Nunca se enfrentaron o siguen idénticos → diferencia general.
    return y.diff - x.diff || y.pf - x.pf;
  });
}
