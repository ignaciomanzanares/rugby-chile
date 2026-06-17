/**
 * Apply real fantasy positions transcribed from clubs' Instagram "nómina" XV
 * graphics (the lineups are images, not parseable captions, so they're read by
 * hand and recorded here). Jersey number → position by rugby convention; names
 * are matched to fantasy player IDs within each club. Starters 1–15 only — the
 * bench (16–23) doesn't follow the position convention reliably in this league,
 * so those players keep their seeded guess.
 *
 * Merges into web/src/data/player-positions.ts, overriding seeds with real data
 * and leaving everything else untouched. Add more clubs/rounds as you read them.
 *
 *   npx tsx src/scripts/applyLineupPositions.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { loadPlayers, STARTERS, type Player, type Position } from "./deriveLineupPositions";

const POSITIONS_FILE = resolve(__dirname, "../../../web/src/data/player-positions.ts");

// jersey 1→index 0 … jersey 15→index 14, club name matches player-stats `team`.
// Source: each club's most recent IG nómina (Fecha 8, Jun 2026).
const LINEUPS: Record<string, string[]> = {
  "Old Reds": [
    "F. Bastías", "M. Harttig", "R. Barrena", "L. Gutiérrez", "N. Antonucci",
    "V. San Martin", "K. Mosa", "J. M. Sánchez", "J. Harttig", "D. Espinoza",
    "T. Alonso", "T. Yañez", "A. Cherniavsky", "T. Zehnder", "S. Prat",
  ],
  "COBS": [
    "Vicente Codorniu", "Franco Costantino", "Enzo Neglia", "Juan Pablo Beheran", "Diego Lagos",
    "Sebastián González", "Ignacio Soublette", "Vicente Contreras", "Jan Hasenlechner", "Martín De Oto",
    "Tomás Fuentes", "Martín Escobar", "Gonzalo Lara", "Rodrigo Araya", "Lucas Sandoval",
  ],
  "UC": [
    "Rufino Costa", "Sebastián Parra", "José Tomás Munita", "Nicolás Paredes", "Maximiliano Silva",
    "Tomás Silva", "Tomás Gonzalez", "Juan Duhalde", "Juan Pablo Perrotta", "Diego Perrotta",
    "Jaime Escobar", "Matías Gonzalez", "Felipe Chávez", "Ignacio Perrotta", "Agustín Infante",
  ],
  "Old Boys": [
    "Sebastian Valech", "Antonio Bozzolo", "Baltazar Gurruchaga", "Mauro Saez", "Lucas Haddad",
    "Vicente Huete", "Ian Otersen", "Gabriel Ljubetic", "Clemente Barrios", "Tomas Alvarado",
    "Federico Kennedy", "Santiago Ostornol", "Pastor Melo", "Max Robles", "Mateo Carvajal",
  ],
  "Old Macks": [
    "Gonzalo Valenzuela", "Luis Sottovia", "Marco Díaz", "Sebastián Mayral", "Juan Rivera",
    "Joaquín Troncoso", "Augusto Villanueva", "Ignacio Berríos", "Sebastian Novoa", "Arturo Iriarte",
    "Mauro Mazzino", "Caleb Morán", "Julian Troncoso", "Giorgio Moltedo", "Franco Scassi Buffa",
  ],
  "PWCC": [
    "Carlos Delgado", "Polo Jérez", "Ángelo Alvarado", "Sebastián Benard", "Agustín Fernández",
    "Bruno Vargas", "Manuel González", "Juan Ignacio Piña", "Lukas Carvallo", "Renan Salas",
    "Rae Arce", "Cristóbal Ramírez", "Damián Fliegel", "Felipe Brangier", "Iñaki Tuset",
  ],
  "DOBS": [
    "Fernando Sahady", "Cristobal Lagos", "Diego Zamora", "Diego Pinochet", "Domingo Montan",
    "Joaquín Texido", "Vicente Prieto", "Santiago Montan", "Germán Oelckers", "Tomás Serrano",
    "Ignacio Giacaman", "Nicolás Alvarez", "Renato Arias", "Franco Rossi", "Ignacio Arias",
  ],
  "Stade Francais": [
    "Javier Cifuentes", "Gabriel Acuña", "Alvaro Tejos", "Rodrigo Cabrera", "Gael Gomez",
    "Ignacio Silva", "Maximiliano Leiva", "Inti Ubeda", "Francisco Vera", "Felipe Rouret",
    "Pedro Pablo Ubeda", "Felipe Flores", "Joaquin Huici", "Pedro Sepúlveda", "Germán Herrera",
  ],
  "Old Johns": [
    "Gonzalo Sepúlveda", "Daivis Guzmán", "Fabián Lagos", "Lucca Marchini", "Cristóbal Rivas",
    "Juan Pablo Castro", "Lucas Rubilar", "Renzo Marchini", "Hermes Didier", "Diego Pierart",
    "Cristóbal Martínez", "Felipe Neira", "Francisco Neira", "Agustín Game", "Joaquín Dibán",
  ],
  "Sporting RC": [
    "Juan Pablo Gómez", "Agustín Porro", "Sebastián Ibarra", "Lucas Zavala", "Matías Zavala",
    "Tomás Ayala", "Fernando Meyer", "Lorenzo Cicarelli", "Vicente Pérez", "Vicente Laborde",
    "Emmanuel Brane", "Gaspar Sandoval", "Martín Jackson", "Javier Lavanderos", "Álvaro Latorre",
  ],
};

const norm = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[.\-']/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string): string[] => norm(s).split(" ").filter((t) => t.length > 1);

// Match a lineup name to a club player. Score = shared tokens (surname etc.),
// + a bonus when the candidate's first name starts with the lineup initial — so
// "M. Harttig" and "J. Harttig" resolve to different players.
function matchLineup(name: string, pool: Player[]): Player | null {
  const nt = tokens(name);
  if (!nt.length) return null;
  const initials = name.split(/\s+/).filter((w) => /^[A-Za-zÁÉÍÓÚÑ]\.?$/.test(w)).map((w) => norm(w[0]));
  let best: Player | null = null;
  let bestScore = 0;
  for (const p of pool) {
    const pt = new Set(tokens(p.name));
    const shared = nt.filter((t) => pt.has(t)).length;
    if (shared === 0) continue;
    const cfirst = norm(p.name).split(" ")[0];
    const initBonus = initials.some((ini) => cfirst.startsWith(ini)) ? 0.5 : 0;
    const score = shared + initBonus;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

// Stat-based fallback position for players not found in any lineup. Goal-kickers
// -> FLY_HALF/FULLBACK, try-scorers -> WING/CENTRE, everyone else spread across
// the pack by a stable hash of their id so every position stays represented.
const WEIGHTS: [Position, number][] = [
  ["PROP", 6], ["HOOKER", 4], ["LOCK", 6], ["FLANKER", 5], ["NUMBER_8", 3],
  ["SCRUM_HALF", 4], ["FLY_HALF", 2], ["CENTER", 4], ["WING", 4], ["FULLBACK", 2],
];
const WEIGHTED: Position[] = WEIGHTS.flatMap(([p, n]) => Array<Position>(n).fill(p));

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function seedPosition(p: Player): Position {
  if (p.matches >= 2) {
    const cr = (p.conversions + p.penalties) / p.matches;
    const tr = p.tries / p.matches;
    if (cr >= 0.75) return "FLY_HALF";
    if (cr >= 0.4) return "FULLBACK";
    if (tr >= 0.8) return "WING";
    if (tr >= 0.5) return "CENTER";
  }
  return WEIGHTED[hash(p.id) % WEIGHTED.length];
}

const players = loadPlayers();
const derived: Record<string, Position> = {};
let matched = 0;

for (const [club, xv] of Object.entries(LINEUPS)) {
  const pool = players.filter((p) => p.team === club);
  const unmatched: string[] = [];
  xv.forEach((name, i) => {
    const p = matchLineup(name, pool);
    if (!p) { unmatched.push(`#${i + 1} ${name}`); return; }
    derived[p.id] = STARTERS[i];
    matched++;
  });
  console.log(`${club.padEnd(11)} matched ${xv.length - unmatched.length}/15` +
    (unmatched.length ? `  · UNMATCHED: ${unmatched.join(", ")}` : ""));
}

// Every player gets a position: real lineup-derived where we have it, else a
// stat-based seed.
const final: Record<string, { pos: Position; real: boolean }> = {};
for (const p of players) {
  final[p.id] = derived[p.id]
    ? { pos: derived[p.id], real: true }
    : { pos: seedPosition(p), real: false };
}

const lines = [
  "// Fantasy player positions — arusaId -> rugby position.",
  "//",
  "// `lineup` entries are real, transcribed from a club's Instagram nómina XV",
  "// graphic (jersey -> position). `seeded` are stat-based guesses still awaiting",
  "// a lineup. Update via src/scripts/applyLineupPositions.ts in the api package.",
  "",
  'import type { Position } from "@/lib/fantasy";',
  "",
  "export const PLAYER_POSITIONS: Record<string, Position> = {",
];
const seen = new Set<string>(); // global — an id can appear in two divisions
for (const div of ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"]) {
  const inDiv = players.filter((p) => p.division === div && final[p.id] && !seen.has(p.id));
  if (!inDiv.length) continue;
  lines.push(`  // ── ${div} ──`);
  inDiv.sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));
  let team: string | null = null;
  for (const p of inDiv) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    if (p.team !== team) { team = p.team; lines.push(`  // ${team}`); }
    const f = final[p.id];
    lines.push(`  "${p.id}": "${f.pos}", // ${p.name} (${f.real ? "lineup" : "seeded"})`);
  }
}
lines.push("};", "");
writeFileSync(POSITIONS_FILE, lines.join("\n"));

const realCount = Object.values(final).filter((f) => f.real).length;
console.log(`\n✓ ${matched} positions from real lineups · ${Object.keys(final).length - realCount} still seeded`);
