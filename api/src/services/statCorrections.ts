/**
 * Aggregate-stat deltas derived from the manual event corrections.
 *
 * The event-correction table (lib/eventCorrections) is the single source of
 * truth: it reassigns a scorer on the minute-by-minute feed. arusa's *aggregate*
 * stats table (fetchPlayerStats) still reflects the wrong scorer, so here we
 * recompute the difference — for every event whose scorer changed, we move the
 * count + points from the original player to the corrected one — and expose it
 * as a per-division, per-player delta that the /stats/players route folds in.
 *
 * Built once (lazily) and cached: the corrections are static in code, so a
 * process restart is the natural cache-buster.
 */
import { fetchAllMatchesMeta, scrapeArusaEvents, type ArusaEvent } from "../lib/leverade";
import { readCache } from "../lib/arusaCache";
import { EVENT_CORRECTIONS, applyEventCorrections } from "../lib/eventCorrections";

const POINTS: Record<string, number> = { TRY: 5, CONVERSION: 2, PENALTY: 3, DROP_GOAL: 3 };
const FIELD: Record<string, "tries" | "conversions" | "penalties" | "drops"> = {
  TRY: "tries", CONVERSION: "conversions", PENALTY: "penalties", DROP_GOAL: "drops",
};

export interface StatDelta { name: string; tries: number; conversions: number; penalties: number; drops: number; points: number; }

export function normName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Orient raw arusa events the same way the /match/events route does: 2nd-half
// minutes get +40 and home/away flips when arusa labels the pairing reversed.
function orient(events: ArusaEvent[], reversed: boolean) {
  let offset = 0;
  let prev = -1;
  return events.map((e) => {
    if (prev >= 0 && e.minute + 1 < prev) offset = 40;
    prev = e.minute;
    return {
      minute: e.minute + offset,
      type: e.type,
      playerName: e.playerName,
      team: reversed ? (e.team === "home" ? "away" : "home") : e.team as "home" | "away",
      half: offset === 0 ? 1 : 2,
    };
  });
}

let cache: Map<string, Map<string, StatDelta>> | null = null;

async function build(): Promise<Map<string, Map<string, StatDelta>>> {
  const out = new Map<string, Map<string, StatDelta>>();
  let meta;
  try { meta = await fetchAllMatchesMeta(); } catch { return out; }

  for (const key of Object.keys(EVENT_CORRECTIONS)) {
    const [division, roundStr, home, away] = key.split(":");
    const round = Number(roundStr);
    const m = meta.find(
      (x) => x.division === division && x.round === round &&
        ((x.homeTeam === home && x.awayTeam === away) || (x.homeTeam === away && x.awayTeam === home)),
    );
    if (!m) continue;

    // Prefer persisted events (finished matches are immutable) so this doesn't
    // depend on a fresh arusa scrape; fall back to scraping if never captured.
    let raw = await readCache<ArusaEvent[]>(`events:${m.matchId}`);
    if (!raw || raw.length === 0) { try { raw = await scrapeArusaEvents(m.matchId); } catch { raw = []; } }
    if (!raw || raw.length === 0) continue;

    const reversed = m.homeTeam !== home;
    const original = orient(raw, reversed);
    const corrected = applyEventCorrections(division, round, home, away, original);

    const byName = out.get(division) ?? new Map<string, StatDelta>();
    const bump = (name: string, field: "tries" | "conversions" | "penalties" | "drops", cnt: number, pts: number) => {
      const k = normName(name);
      const d = byName.get(k) ?? { name, tries: 0, conversions: 0, penalties: 0, drops: 0, points: 0 };
      d[field] += cnt;
      d.points += pts;
      byName.set(k, d);
    };
    for (let i = 0; i < corrected.length; i++) {
      const o = original[i];
      const c = corrected[i];
      if (!o || !c || o.playerName === c.playerName) continue;
      const field = FIELD[c.type];
      const pts = POINTS[c.type] ?? 0;
      if (!field) continue;
      if (o.playerName) bump(o.playerName, field, -1, -pts); // take from the wrong scorer
      if (c.playerName) bump(c.playerName, field, +1, +pts); // give to the real one
    }
    out.set(division, byName);
  }
  return out;
}

/** Per-player stat deltas for a division (normalised-name keyed). Cached. */
export async function getStatDeltas(division: string): Promise<Map<string, StatDelta>> {
  if (!cache) cache = await build();
  return cache.get(division) ?? new Map();
}

type StatRow = { name: string; tries: number; conversions: number; penalties: number; drops: number; points: number };

/** Fold the correction deltas into a division's player rows (matched by name). */
export async function applyStatDeltas<T extends StatRow>(division: string, players: T[]): Promise<T[]> {
  const deltas = await getStatDeltas(division);
  if (deltas.size === 0) return players;
  const clamp = (n: number) => Math.max(0, n);
  return players.map((p) => {
    const d = deltas.get(normName(p.name));
    if (!d) return p;
    return {
      ...p,
      tries: clamp(p.tries + d.tries),
      conversions: clamp(p.conversions + d.conversions),
      penalties: clamp(p.penalties + d.penalties),
      drops: clamp(p.drops + d.drops),
      points: clamp(p.points + d.points),
    };
  });
}
