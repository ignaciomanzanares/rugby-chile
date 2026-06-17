/**
 * Regenerate web/src/data/player-stats.ts from the live ARUSA per-division
 * stats scrape. The committed file was a stale snapshot (missing ~80 current
 * players, e.g. squad members who hadn't scored when it was first captured).
 *
 *   npx tsx src/scripts/refreshPlayerStats.ts
 */
import "dotenv/config";
import dns from "node:dns"; dns.setDefaultResultOrder("ipv4first");
import { writeFileSync } from "fs";
import { resolve } from "path";
import { fetchPlayerStats, type PlayerStatRow } from "../lib/leverade";
import type { DivisionKey } from "../lib/leverade";

const OUT = resolve(__dirname, "../../../web/src/data/player-stats.ts");
const DIVS: DivisionKey[] = ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"];

function row(p: PlayerStatRow): string {
  const j = JSON.stringify;
  return `    { id: ${j(p.id)}, name: ${j(p.name)}, team: ${j(p.team)}, teamSlug: ${j(p.teamSlug)}, ` +
    `matches: ${p.matches}, points: ${p.points}, tries: ${p.tries}, penaltyTries: ${p.penaltyTries}, ` +
    `conversions: ${p.conversions}, penalties: ${p.penalties}, drops: ${p.drops}, ` +
    `yellowCards: ${p.yellowCards}, redCards: ${p.redCards}, mvp: ${p.mvp} },`;
}

async function main() {
  const blocks: string[] = [];
  for (const div of DIVS) {
    const players = await fetchPlayerStats(div);
    if (!players || players.length === 0) throw new Error(`no live stats for ${div}`);
    console.log(`${div}: ${players.length} players`);
    blocks.push(`  ${JSON.stringify(div)}: [\n${players.map(row).join("\n")}\n  ],`);
  }

  const out = `// Generated from arusa.cl per-division stats (live scrape via
// api/src/scripts/refreshPlayerStats.ts).
// PRIMERA = 3667033 · INTERMEDIA = 3667034 · PRE_INTERMEDIA = 3667035

import type { DivisionKey } from "@/lib/tournament";

export type { DivisionKey };

export interface DivisionPlayerStat {
  id: string;
  name: string;
  team: string;
  teamSlug: string;
  matches: number;
  points: number;
  tries: number;
  penaltyTries: number;
  conversions: number;
  penalties: number;
  drops: number;
  yellowCards: number;
  redCards: number;
  mvp: number;
}

export const PLAYER_STATS_BY_DIVISION: Record<DivisionKey, DivisionPlayerStat[]> = {
${blocks.join("\n")}
};
`;
  writeFileSync(OUT, out);
  console.log(`✓ wrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
