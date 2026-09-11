// Scorer del fantasy POR FECHA, basado en DELTAS del acumulado de temporada.
//
// arusa publica stats acumuladas de temporada por jugador (no minuto-a-minuto).
// Guardamos un "baseline" (snapshot del acumulado al cierre de la última fecha
// puntuada) + el TIEMPO de ese corte. Cuando una fecha nueva termina (su último
// partido cierra DESPUÉS del corte), los puntos de esa jornada = acumulado
// actual − baseline. Sólo puntúa de acá en adelante (no reconstruye fechas ya
// jugadas antes de sembrar el baseline).
//
// El corte es por TIEMPO, no por número de ronda, para respetar aplazamientos:
// la fecha 12 aplazada "termina" después que la 13-16 aunque tenga número menor.
//
// Limitación: del acumulado no se puede saber si un jugador entró de suplente,
// así que was_sub queda en false (el super sub no aplica ×2/÷2 por ahora).

import { db } from "../db";
import { fantasyStatBaseline, fantasyGameweekScores } from "../db/schema";
import { and, eq, sql } from "drizzle-orm";
import { fetchPlayerStats, fetchAllMatchesMeta, getMatchSubIns, getMatchMinutes, normPlayerName, type DivisionKey, type PlayerStatRow, type MatchMeta } from "../lib/leverade";
import { readCache, writeCache } from "../lib/arusaCache";
import { freezeScoredRounds } from "./fantasyFreeze";

const DIVS: { fantasy: string; key: DivisionKey }[] = [
  { fantasy: "primera", key: "PRIMERA" },
  { fantasy: "intermedia", key: "INTERMEDIA" },
  { fantasy: "pre-intermedia", key: "PRE_INTERMEDIA" },
];

// Línea de stats de un jugador en un corte. Guardarla en el baseline es lo que
// permite explicar después de dónde salió cada punto de la fecha.
type StatLine = {
  matches: number; tries: number; penaltyTries: number; conversions: number;
  penalties: number; drops: number; mvp: number; yellowCards: number; redCards: number;
};
function statLine(p: PlayerStatRow): StatLine {
  return {
    matches: p.matches, tries: p.tries, penaltyTries: p.penaltyTries, conversions: p.conversions,
    penalties: p.penalties, drops: p.drops, mvp: p.mvp, yellowCards: p.yellowCards, redCards: p.redCards,
  };
}

let columnasListas = false;
async function asegurarColumnas() {
  if (columnasListas) return;
  await db.execute(sql`ALTER TABLE fantasy_stat_baseline ADD COLUMN IF NOT EXISTS stats json`);
  await db.execute(sql`ALTER TABLE fantasy_gameweek_scores ADD COLUMN IF NOT EXISTS detail json`);
  columnasListas = true;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * De los deltas de la fecha al "por qué": las líneas que suman los puntos.
 *
 * El bonus por minutos no es una estadística (sale del minuto a minuto), así que
 * entra como línea aparte. Si la suma no da igual que el delta de puntos —arusa
 * a veces corrige el acumulado— se agrega un ajuste, para que lo que se muestra
 * siempre cuadre con lo que se sumó.
 */
function desglose(d: StatLine, bonusMinutos: number, dPoints: number): Array<{ label: string; pts: number }> {
  const out: Array<{ label: string; pts: number }> = [];
  if (d.matches > 0) out.push({ label: d.matches === 1 ? "Jugó" : `Jugó ${d.matches} partidos`, pts: 2 * d.matches });
  if (bonusMinutos > 0) out.push({ label: "60' o más", pts: bonusMinutos });
  const tries = d.tries + d.penaltyTries;
  if (tries) out.push({ label: plural(tries, "try", "tries"), pts: 10 * tries });
  if (d.conversions) out.push({ label: plural(d.conversions, "conversión", "conversiones"), pts: 2 * d.conversions });
  if (d.penalties) out.push({ label: plural(d.penalties, "penal", "penales"), pts: 3 * d.penalties });
  if (d.drops) out.push({ label: plural(d.drops, "drop", "drops"), pts: 4 * d.drops });
  if (d.mvp) out.push({ label: d.mvp === 1 ? "MVP" : `${d.mvp} MVP`, pts: 8 * d.mvp });
  if (d.yellowCards) out.push({ label: plural(d.yellowCards, "amarilla", "amarillas"), pts: -1 * d.yellowCards });
  if (d.redCards) out.push({ label: plural(d.redCards, "roja", "rojas"), pts: -4 * d.redCards });
  const suma = out.reduce((a, x) => a + x.pts, 0);
  if (suma !== dPoints) out.push({ label: "Ajuste de estadísticas", pts: dPoints - suma });
  return out;
}

function seasonPoints(p: PlayerStatRow): number {
  return (
    p.matches * 2 +
    (p.tries + p.penaltyTries) * 10 +
    p.conversions * 2 +
    p.penalties * 3 +
    p.drops * 4 +
    p.mvp * 8 -
    p.yellowCards * 1 -
    p.redCards * 4
  );
}

function parseTime(m: MatchMeta): number {
  return m.datetime ? Date.parse(m.datetime.replace(" ", "T") + "Z") : NaN;
}

// Fechas totalmente terminadas de una división, con CUÁNDO terminó cada una
// (última datetime del partido), ordenadas cronológicamente.
function finishedRounds(meta: MatchMeta[], key: DivisionKey): Array<{ round: number; end: number }> {
  const byRound = new Map<number, MatchMeta[]>();
  for (const m of meta) {
    if (m.division !== key || m.postponed) continue;
    (byRound.get(m.round) ?? byRound.set(m.round, []).get(m.round)!).push(m);
  }
  const done: Array<{ round: number; end: number }> = [];
  for (const [round, ms] of byRound) {
    if (ms.length === 0 || !ms.every((m) => m.finished)) continue;
    const end = Math.max(...ms.map(parseTime).filter(Number.isFinite));
    done.push({ round, end: Number.isFinite(end) ? end : round });
  }
  return done.sort((a, b) => a.end - b.end);
}

export async function scoreFantasyDeltas(): Promise<{ scored: Array<{ division: string; round: number; players: number }> }> {
  await asegurarColumnas();
  const meta = await fetchAllMatchesMeta().catch(() => [] as MatchMeta[]);
  const scored: Array<{ division: string; round: number; players: number }> = [];

  for (const { fantasy, key } of DIVS) {
    const stats = await fetchPlayerStats(key);
    if (!stats || stats.length === 0) continue;

    const cur = new Map(stats.map((p) => [p.id, { points: seasonPoints(p), matches: p.matches, clubSlug: p.teamSlug, name: p.name, stats: statLine(p) }]));
    const finished = finishedRounds(meta, key);
    const lastEnd = finished.length ? finished[finished.length - 1].end : 0;

    const baselineRows = await db.select().from(fantasyStatBaseline).where(eq(fantasyStatBaseline.division, fantasy));
    const baseline = new Map(baselineRows.map((b) => [b.arusaId, { points: b.points, matches: b.matches, stats: b.stats }]));

    // Primera corrida: sembrar baseline con el acumulado actual y fijar el corte
    // en la última fecha ya terminada (no se reconstruyen fechas pasadas).
    if (baseline.size === 0) {
      const seed = [...cur.entries()].map(([arusaId, v]) => ({ division: fantasy, arusaId, points: v.points, matches: v.matches, stats: v.stats }));
      if (seed.length) await db.insert(fantasyStatBaseline).values(seed).onConflictDoNothing();
      await writeCache(`fantasy:baselineTime:${fantasy}`, lastEnd);
      continue;
    }

    const baselineTime = (await readCache<number>(`fantasy:baselineTime:${fantasy}`)) ?? 0;
    // Fechas que terminaron DESPUÉS del corte (una nueva jornada cerró).
    const nuevas = finished.filter((f) => f.end > baselineTime);
    if (nuevas.length === 0) continue;

    // Si cerró más de una desde el último corte (raro), el delta acumulado va a
    // la más reciente. El corte avanza al cierre de esa fecha.
    const target = nuevas[nuevas.length - 1];

    // De los partidos de esa fecha: quién entró de suplente (super sub) y quién
    // jugó 60+ (bonus por minutos). Salen del minuto-a-minuto (sustituciones).
    const subIns = new Set<string>();
    const played60 = new Map<string, boolean>();
    const roundMatches = meta.filter((m) => m.division === key && m.round === target.round && m.finished);
    for (const m of roundMatches) {
      try {
        for (const n of await getMatchSubIns(m.matchId)) subIns.add(n);
        for (const [name, p60] of await getMatchMinutes(m.matchId)) played60.set(name, p60);
      } catch { /* sin datos de cambios → se asume titular 60+ */ }
    }

    const toWrite: Array<typeof fantasyGameweekScores.$inferInsert> = [];
    for (const [arusaId, v] of cur) {
      const base = baseline.get(arusaId) ?? { points: 0, matches: 0, stats: null };
      let dPoints = v.points - base.points;
      const dMatches = v.matches - base.matches;
      if (dMatches <= 0 && dPoints === 0) continue; // no jugó / no cambió
      const norm = normPlayerName(v.name);
      // Bonus por minutos: la base ya dio +2 por aparición (=<60'); si jugó 60+
      // se suma +1 más (→ +3). Sin dato de cambio = titular no sustituido = 60+.
      let bonusMinutos = 0;
      if (dMatches > 0) {
        const p60 = played60.get(norm);
        if (p60 === undefined ? true : p60) { bonusMinutos = dMatches; dPoints += dMatches; }
      }
      // El desglose necesita la línea de stats del corte anterior. Si el baseline
      // es viejo (sin stats) se guardan los puntos igual, pero sin el "por qué":
      // inventar un desglose contra cero sería contarle la temporada entera.
      const b = base.stats;
      const d: StatLine | null = b ? {
        matches: dMatches,
        tries: v.stats.tries - b.tries,
        penaltyTries: v.stats.penaltyTries - b.penaltyTries,
        conversions: v.stats.conversions - b.conversions,
        penalties: v.stats.penalties - b.penalties,
        drops: v.stats.drops - b.drops,
        mvp: v.stats.mvp - b.mvp,
        yellowCards: v.stats.yellowCards - b.yellowCards,
        redCards: v.stats.redCards - b.redCards,
      } : null;
      toWrite.push({
        division: fantasy, round: target.round, arusaId, clubSlug: v.clubSlug, playerName: v.name,
        played: dMatches > 0, wasSub: subIns.has(norm), pointsEarned: dPoints,
        ...(d ? {
          tries: d.tries + d.penaltyTries, conversions: d.conversions, penalties: d.penalties,
          drops: d.drops, yellowCards: d.yellowCards, redCards: d.redCards, isMvp: d.mvp > 0,
          detail: desglose(d, bonusMinutos, dPoints),
        } : {}),
      });
    }

    if (toWrite.length) {
      await db.delete(fantasyGameweekScores).where(and(eq(fantasyGameweekScores.division, fantasy), eq(fantasyGameweekScores.round, target.round)));
      await db.insert(fantasyGameweekScores).values(toWrite);
      scored.push({ division: fantasy, round: target.round, players: toWrite.length });
      // Recién puntuada: se guarda con qué equipo jugó cada uno, para que un
      // cambio de plantel posterior no le mueva los puntos de esta fecha.
      await freezeScoredRounds(fantasy);
    }

    // Avanzar baseline al acumulado actual y el corte al cierre de la fecha.
    for (const [arusaId, v] of cur) {
      await db.insert(fantasyStatBaseline)
        .values({ division: fantasy, arusaId, points: v.points, matches: v.matches, stats: v.stats })
        .onConflictDoUpdate({ target: [fantasyStatBaseline.division, fantasyStatBaseline.arusaId], set: { points: v.points, matches: v.matches, stats: v.stats, updatedAt: new Date() } });
    }
    await writeCache(`fantasy:baselineTime:${fantasy}`, target.end);
  }

  return { scored };
}
