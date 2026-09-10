import type { DivisionKey } from "@/lib/tournament";

// `liveMatches.division` es un string libre ("Primera XV", "Intermedia"…). Lo
// mapeamos a nuestro DivisionKey de forma laxa. PRE va primero porque
// "Pre-Intermedia" contiene "Intermedia".
export function liveDivisionKey(raw: string): DivisionKey | null {
  const s = raw.toLowerCase();
  if (s.includes("pre")) return "PRE_INTERMEDIA";
  if (s.includes("intermedia")) return "INTERMEDIA";
  if (s.includes("primera")) return "PRIMERA";
  return null;
}

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
  const stat = miniLeague(tied, matches);
  const key = (r: T) => {
    const st = stat.get(canonicalize(r.team))!;
    return { w: st.w * 2 + st.d, d: st.pf - st.pc };
  };

  const sorted = [...tied].sort((x, y) => {
    const kx = key(x), ky = key(y);
    // 1) Enfrentamiento directo: victorias (el empate vale medio, por eso x2 +1).
    if (kx.w !== ky.w) return ky.w - kx.w;
    // 2) Quedaron 1-1 -> diferencia de puntos en esos mismos partidos.
    if (kx.d !== ky.d) return ky.d - kx.d;
    // 3) Nunca se enfrentaron o siguen identicos -> diferencia general.
    return y.diff - x.diff || y.pf - x.pf;
  });

  // Si el mini-torneo separo al grupo pero dejo un SUBGRUPO todavia igualado, se
  // vuelven a aplicar los mismos criterios solo entre esos, en vez de saltar a
  // la diferencia general: el directo entre ellos puede ser concluyente aunque
  // el mini-torneo ampliado los haya dejado empatados. Es la practica estandar
  // (FIFA/UEFA y la mayoria de las uniones de rugby).
  if (sorted.length > 2) {
    const out: T[] = [];
    for (let i = 0; i < sorted.length; ) {
      let j = i;
      while (j + 1 < sorted.length) {
        const a = key(sorted[i]), b = key(sorted[j + 1]);
        if (a.w !== b.w || a.d !== b.d) break;
        j++;
      }
      const sub = sorted.slice(i, j + 1);
      // Solo recursar si el subgrupo es MENOR que el grupo: si no, es el mismo
      // conjunto y entrariamos en bucle infinito.
      out.push(...(sub.length > 1 && sub.length < sorted.length ? orderTiedGroup(sub, matches) : sub));
      i = j + 1;
    }
    return out;
  }
  return sorted;
}

/** Victorias/empates y puntos a favor/contra SOLO entre los equipos del grupo. */
function miniLeague<T extends TiebreakRow>(group: T[], matches: HeadToHeadMatch[]): Map<string, MiniStat> {
  const stat = new Map<string, MiniStat>();
  for (const r of group) stat.set(canonicalize(r.team), { w: 0, d: 0, pf: 0, pc: 0 });
  for (const m of matches) {
    const h = canonicalize(m.homeTeam);
    const a = canonicalize(m.awayTeam);
    if (h === a) continue;
    const sh = stat.get(h);
    const sa = stat.get(a);
    if (!sh || !sa) continue; // alguno no esta en el grupo -> el partido no cuenta
    sh.pf += m.homeScore; sh.pc += m.awayScore;
    sa.pf += m.awayScore; sa.pc += m.homeScore;
    if (m.homeScore > m.awayScore) sh.w += 1;
    else if (m.homeScore < m.awayScore) sa.w += 1;
    else { sh.d += 1; sa.d += 1; }
  }
  return stat;
}
