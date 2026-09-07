/**
 * Desempate de la tabla de posiciones.
 *
 * Ante igualdad de puntos manda el ENFRENTAMIENTO DIRECTO, no la diferencia
 * general: primero quién ganó los partidos entre los equipos empatados y, si
 * quedaron 1-1 (o el mini-torneo quedó igualado), la diferencia de puntos
 * acumulada EN ESOS partidos. Recién ahí se cae a la diferencia general.
 *
 * Generaliza a empates de 3 o más equipos como un mini-torneo entre ellos: se
 * miran solo los partidos que jugaron entre sí, exactamente el mismo criterio.
 *
 * OJO: hay una copia gemela de esta lógica en web/src/lib/standings-sort.ts,
 * porque el cliente reordena la tabla al superponer los partidos en vivo. Si
 * tocas una, toca la otra o las tablas se contradicen.
 */
import { canonicalTeam } from "./leverade";

export interface TiebreakRow {
  team: string;
  pts: number;
  diff: number;
  pf: number;
  /** Lo asigna sortStandings; no hace falta traerlo. */
  pos?: number;
}

/** Un partido terminado, para leer el historial entre dos equipos. */
export interface HeadToHeadMatch {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

interface MiniStat { w: number; d: number; pf: number; pc: number }

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
  for (const r of tied) stat.set(canonicalTeam(r.team), { w: 0, d: 0, pf: 0, pc: 0 });

  for (const m of matches) {
    const h = canonicalTeam(m.homeTeam);
    const a = canonicalTeam(m.awayTeam);
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
    const sx = stat.get(canonicalTeam(x.team))!;
    const sy = stat.get(canonicalTeam(y.team))!;
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
