/**
 * Derive real fantasy positions from Instagram lineup posts.
 *
 * Clubs post their XV as a numbered list ("1. Nombre", "2. Nombre", …). Jersey
 * number maps to position by rugby convention, so a parsed lineup gives accurate
 * positions for every starter. This script crawls each club's latest lineup,
 * matches the names to fantasy player IDs (within that club), and merges the
 * result into web/src/data/player-positions.ts — overriding the auto-seeded
 * guesses, but only for players it actually found in a lineup. Re-running only
 * improves coverage; it never clobbers an existing real/derived value.
 *
 * Requires a fresh INSTAGRAM_SESSION_ID in api/.env (the saved one expires every
 * few months and then Instagram serves an HTML wall instead of JSON).
 *
 *   npm run positions:derive          (from api/)
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { findLineupPost } from "../services/instagramScraper";

const ROOT = resolve(__dirname, "../../..");
const STATS_FILE = resolve(ROOT, "web/src/data/player-stats.ts");
const POSITIONS_FILE = resolve(ROOT, "web/src/data/player-positions.ts");

// Instagram handle per club (mirrors lineupCrawler.ts).
const CLUB_INSTAGRAM: Record<string, string> = {
  COBS: "cobsrugby", "Old Boys": "oldboyschile", PWCC: "pwccrugby",
  "Old Macks": "oldmacksrugby", "Stade Francais": "stadefrancaischile",
  "Sporting RC": "sportingrc_rugby", DOBS: "dobsrugby", UC: "rugbyuc",
  "Old Johns": "oldjohnsrugby", "Old Reds": "oldredsrugby",
};

type Position =
  | "PROP" | "HOOKER" | "LOCK" | "FLANKER" | "NUMBER_8"
  | "SCRUM_HALF" | "FLY_HALF" | "CENTER" | "WING" | "FULLBACK";

// Jersey number → position. Starters 1-15 are authoritative; bench 16-22 use the
// conventional cover map (looser, applied only when a player wasn't a starter).
export const STARTERS: Position[] = [
  "PROP", "HOOKER", "PROP", "LOCK", "LOCK", "FLANKER", "FLANKER", "NUMBER_8",
  "SCRUM_HALF", "FLY_HALF", "WING", "CENTER", "CENTER", "WING", "FULLBACK",
];
export const SUBS: Position[] = ["HOOKER", "PROP", "PROP", "LOCK", "FLANKER", "SCRUM_HALF", "FLY_HALF"];

export interface Player { id: string; name: string; team: string; division: string; }

const norm = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[.\-']/g, " ").replace(/\s+/g, " ").trim();

const tokens = (s: string): string[] => norm(s).split(" ").filter((t) => t.length > 1);

// Parse every player out of player-stats.ts (id, name, team, division).
export function loadPlayers(): Player[] {
  const src = readFileSync(STATS_FILE, "utf8");
  const out: Player[] = [];
  for (const div of ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"]) {
    const m = new RegExp(`"${div}":\\s*\\[([\\s\\S]*?)\\n  \\]`).exec(src);
    if (!m) continue;
    for (const line of m[1].split("\n")) {
      const id = /id:\s*"([^"]+)"/.exec(line)?.[1];
      const name = /name:\s*"([^"]+)"/.exec(line)?.[1];
      const team = /team:\s*"([^"]+)"/.exec(line)?.[1];
      if (id && name && team) out.push({ id, name, team, division: div });
    }
  }
  return out;
}

// Best matching player id for a caption name within one club's pool. Requires
// every caption token to appear in the candidate's name tokens (so "Ignacio
// Manzanares" picks Ignacio, not his clubmate Joaquin Manzanares). Prefers
// Primera when a name resolves in multiple divisions.
export function matchPlayer(captionName: string, pool: Player[]): Player | null {
  const ct = tokens(captionName);
  if (ct.length === 0) return null;
  const scored = pool
    .map((p) => {
      const pt = new Set(tokens(p.name));
      const all = ct.every((t) => pt.has(t));
      const shared = ct.filter((t) => pt.has(t)).length;
      return { p, all, shared };
    })
    .filter((s) => s.all || s.shared >= 2)
    .sort((a, b) =>
      Number(b.all) - Number(a.all) ||
      b.shared - a.shared ||
      Number(a.p.division === "PRIMERA") - Number(b.p.division === "PRIMERA"),
    );
  return scored[0]?.p ?? null;
}

// Read the current id→position map (and keep line comments out — we rebuild them).
function loadExisting(): Record<string, Position> {
  const src = readFileSync(POSITIONS_FILE, "utf8");
  const map: Record<string, Position> = {};
  for (const m of src.matchAll(/"(\d+)":\s*"([A-Z_]+)"/g)) map[m[1]] = m[2] as Position;
  return map;
}

async function main() {
  const players = loadPlayers();
  const existing = loadExisting();
  const sinceTs = Math.floor(Date.now() / 1000) - 60 * 24 * 3600; // 60-day lookback

  const derived: Record<string, { pos: Position; jersey: number; club: string }> = {};
  const summary: string[] = [];

  for (const [club, handle] of Object.entries(CLUB_INSTAGRAM)) {
    const pool = players.filter((p) => p.team === club);
    try {
      const res = await findLineupPost(handle, sinceTs);
      if (!res || !res.parsed) { summary.push(`${club.padEnd(15)} no lineup post`); continue; }
      const date = new Date(res.post.timestamp * 1000).toISOString().slice(0, 10);
      let matched = 0;
      const unmatched: string[] = [];
      res.parsed.forEach((name, idx) => {
        if (!name) return;
        const jersey = idx + 1;
        const pos = jersey <= 15 ? STARTERS[idx] : SUBS[idx - 15];
        if (!pos) return;
        const player = matchPlayer(name, pool);
        if (!player) { unmatched.push(`#${jersey} ${name}`); return; }
        // Starters win over subs; first writer (starter) keeps the slot.
        if (!derived[player.id] || (derived[player.id].jersey > 15 && jersey <= 15)) {
          derived[player.id] = { pos, jersey, club };
          matched++;
        }
      });
      summary.push(`${club.padEnd(15)} ${date}  matched ${matched}/${res.parsed.filter(Boolean).length}` +
        (unmatched.length ? `  · unmatched: ${unmatched.join(", ")}` : ""));
    } catch (e) {
      summary.push(`${club.padEnd(15)} ERROR ${(e as Error).message}`);
    }
  }

  // Merge: derived overrides existing; everything else keeps its current value.
  const final: Record<string, { pos: Position; src: "lineup" | "seeded"; note: string }> = {};
  for (const p of players) {
    const d = derived[p.id];
    if (d) final[p.id] = { pos: d.pos, src: "lineup", note: `#${d.jersey} lineup` };
    else if (existing[p.id]) final[p.id] = { pos: existing[p.id], src: "seeded", note: "seeded" };
  }

  writePositions(players, final);

  const derivedCount = Object.values(final).filter((f) => f.src === "lineup").length;
  console.log("\n── Lineup crawl ──");
  for (const s of summary) console.log("  " + s);
  console.log(`\n✓ wrote ${POSITIONS_FILE}`);
  console.log(`  ${derivedCount} positions from real lineups · ${Object.keys(final).length - derivedCount} still seeded`);
}

function writePositions(
  players: Player[],
  final: Record<string, { pos: Position; src: "lineup" | "seeded"; note: string }>,
) {
  const lines = [
    "// Fantasy player positions — arusaId -> rugby position.",
    "//",
    "// Entries marked `lineup` were derived from a club's Instagram XV post",
    "// (jersey number -> position); `seeded` are stat-based guesses still awaiting",
    "// a lineup. Regenerate with `npm run positions:derive` (from api/).",
    "",
    'import type { Position } from "@/lib/fantasy";',
    "",
    "export const PLAYER_POSITIONS: Record<string, Position> = {",
  ];
  for (const div of ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"]) {
    const inDiv = players.filter((p) => p.division === div && final[p.id]);
    if (!inDiv.length) continue;
    lines.push(`  // ── ${div} ──`);
    inDiv.sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));
    let team: string | null = null;
    const seen = new Set<string>();
    for (const p of inDiv) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      if (p.team !== team) { team = p.team; lines.push(`  // ${team}`); }
      const f = final[p.id];
      lines.push(`  "${p.id}": "${f.pos}", // ${p.name} (${f.note})`);
    }
  }
  lines.push("};", "");
  writeFileSync(POSITIONS_FILE, lines.join("\n"));
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
