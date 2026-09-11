import type { StandingRow } from "@/lib/tournament";
import type { LiveMatch } from "@/lib/socket";
import { sortStandings, type HeadToHeadMatch } from "@/lib/standings-sort";

/**
 * Superpone los partidos EN VIVO (LIVE/HT) sobre una tabla base y reordena, para
 * que la tabla se mueva en tiempo real mientras se juega. Puntos de rugby con
 * bonus REALES: victoria 4 / empate 2, +1 por 4+ tries, +1 por perder por ≤7.
 * Los `lives` ya deben venir filtrados por división (el llamador lo hace). No
 * muta `base` (clona cada fila). Fuente única — antes estaba duplicada en la
 * tabla completa y en el widget del home, con riesgo de divergir.
 */
export function applyLiveOverlay(
  base: StandingRow[],
  lives: LiveMatch[],
  // Partidos ya jugados de la división: los necesita el desempate por
  // enfrentamiento directo al reordenar. Sin ellos cae a diferencia general.
  played: HeadToHeadMatch[] = [],
  // Partidos que TERMINARON pero que Leverade todavía no puntuó, así que la
  // tabla base no los cuenta (ver partidosSinPuntuar en la API). Sin esto, al
  // pitazo final el partido desaparece de la tabla hasta que Leverade publique
  // los puntos: pasó después de la fecha 17 y hubo que parchar a mano.
  pendientes: Array<{ homeTeam: string; awayTeam: string }> = [],
): StandingRow[] {
  if (lives.length === 0) return base;

  const sinPuntuar = new Set(pendientes.map((p) => `${p.homeTeam}|${p.awayTeam}`));
  const byTeam = new Map(base.map((r) => [r.team, { ...r }]));
  for (const lm of lives) {
    const enJuego = lm.status === "LIVE" || lm.status === "HT";
    const reciénTerminado = lm.status === "FINISHED" && sinPuntuar.has(`${lm.homeTeam}|${lm.awayTeam}`);
    if (!enJuego && !reciénTerminado) continue;
    const home = byTeam.get(lm.homeTeam);
    const away = byTeam.get(lm.awayTeam);
    if (!home || !away) continue;

    const hs = lm.homeScore, as = lm.awayScore, ht = lm.homeTries, at = lm.awayTries;

    home.pj += 1; away.pj += 1;
    home.pf += hs; home.pc += as;
    away.pf += as; away.pc += hs;

    const homeWin = hs > as;
    const draw = hs === as;
    if (draw) { home.pe += 1; away.pe += 1; }
    else if (homeWin) { home.pg += 1; away.pp += 1; }
    else { away.pg += 1; home.pp += 1; }

    let homePts = draw ? 2 : homeWin ? 4 : 0;
    let awayPts = draw ? 2 : homeWin ? 0 : 4;
    if (ht >= 4) homePts += 1;
    if (at >= 4) awayPts += 1;
    if (!draw && !homeWin && as - hs <= 7) homePts += 1;
    if (!draw && homeWin && hs - as <= 7) awayPts += 1;

    home.pts += homePts;
    away.pts += awayPts;
    home.diff = home.pf - home.pc;
    away.diff = away.pf - away.pc;
  }

  return sortStandings([...byTeam.values()], played);
}
