import type { DivisionPlayerStat } from "@/data/player-stats";
import type { LivePlayerStat } from "@/lib/use-live-player-stats";

export type MergedStat = DivisionPlayerStat & { live?: boolean };

// live_events carry free-text names; normalise (lowercase, strip accents,
// collapse spaces) so a live scorer matches their static baseline row when the
// names line up. Unmatched scorers are kept as new live-only rows.
export const normName = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[^\x00-\x7f]/g, "").replace(/\s+/g, " ").trim();

/**
 * Superpone los stats en vivo (agregados de live_events, incluye finalizados)
 * sobre el baseline de temporada de arusa. Empareja por nombre normalizado +
 * club; a un anotador en vivo se le suman sus puntos/tries a la línea de
 * temporada, y si no matchea ninguna línea base aparece como fila live-only.
 * Es lo que hace que goleadores/tries se muevan en tiempo real durante un
 * partido. Compartido entre la página de estadísticas y los líderes del home.
 */
export function mergeLiveStats(base: DivisionPlayerStat[], live: LivePlayerStat[]): MergedStat[] {
  const byKey = new Map<string, MergedStat>();
  for (const p of base) byKey.set(`${normName(p.name)}|${p.teamSlug}`, { ...p });
  for (const lp of live) {
    const key = `${normName(lp.name)}|${lp.teamSlug}`;
    const cur = byKey.get(key);
    if (cur) {
      cur.tries += lp.tries; cur.conversions += lp.conversions;
      cur.penalties += lp.penalties; cur.drops += lp.drops;
      cur.yellowCards += lp.yellowCards; cur.redCards += lp.redCards;
      cur.points += lp.points; cur.matches += lp.matches;
      cur.live = true;
    } else {
      byKey.set(key, {
        id: `live-${key}`, name: lp.name, team: lp.team, teamSlug: lp.teamSlug,
        matches: lp.matches, points: lp.points, tries: lp.tries, penaltyTries: 0,
        conversions: lp.conversions, penalties: lp.penalties, drops: lp.drops,
        yellowCards: lp.yellowCards, redCards: lp.redCards, mvp: 0, live: true,
      });
    }
  }
  return [...byKey.values()];
}
