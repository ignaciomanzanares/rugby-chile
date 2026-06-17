/**
 * Build web/src/data/player-positions.ts from transcribed Instagram nómina XVs.
 *
 * Clubs post lineups as images (one carousel per matchday with a sheet per
 * division), so they're read by hand and recorded below as OBSERVATIONS:
 * { club, round, division, xv[15] }. For every player we then aggregate across
 * all their observations:
 *   - primary   = most-played position (jersey → position)
 *   - secondary = next most-played distinct position (if any)
 *   - division  = division they appear in most (NOT where ARUSA files their stats)
 * Players with no observation fall back to a stat-based seed + their stats division.
 *
 * Add observations as you read more matchdays, then re-run:
 *   npx tsx src/scripts/buildPlayerPositions.ts
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { loadPlayers, STARTERS, type Player, type Position } from "./deriveLineupPositions";

const POSITIONS_FILE = resolve(__dirname, "../../../web/src/data/player-positions.ts");

type Division = "primera" | "intermedia" | "pre-intermedia";
const STATS_DIV: Record<string, Division> = {
  PRIMERA: "primera", INTERMEDIA: "intermedia", PRE_INTERMEDIA: "pre-intermedia",
};

interface Observation { club: string; round: number; division: Division; xv: string[]; }

// jersey 1→index 0 … 15→index 14. Names as read off the sheet (any of
// "Firstname Lastname", "I. Lastname", "Lastname, Firstname").
const OBSERVATIONS: Observation[] = [
  { club: "Old Reds", round: 8, division: "primera", xv: [
    "F. Bastías", "M. Harttig", "R. Barrena", "L. Gutiérrez", "N. Antonucci",
    "V. San Martin", "K. Mosa", "J. M. Sánchez", "J. Harttig", "D. Espinoza",
    "T. Alonso", "T. Yañez", "A. Cherniavsky", "T. Zehnder", "S. Prat" ] },
  { club: "COBS", round: 8, division: "primera", xv: [
    "Vicente Codorniu", "Franco Costantino", "Enzo Neglia", "Juan Pablo Beheran", "Diego Lagos",
    "Sebastián González", "Ignacio Soublette", "Vicente Contreras", "Jan Hasenlechner", "Martín De Oto",
    "Tomás Fuentes", "Martín Escobar", "Gonzalo Lara", "Rodrigo Araya", "Lucas Sandoval" ] },
  { club: "UC", round: 8, division: "primera", xv: [
    "Rufino Costa", "Sebastián Parra", "José Tomás Munita", "Nicolás Paredes", "Maximiliano Silva",
    "Tomás Silva", "Tomás Gonzalez", "Juan Duhalde", "Juan Pablo Perrotta", "Diego Perrotta",
    "Jaime Escobar", "Matías Gonzalez", "Felipe Chávez", "Ignacio Perrotta", "Agustín Infante" ] },
  { club: "Old Boys", round: 8, division: "primera", xv: [
    "Sebastian Valech", "Antonio Bozzolo", "Baltazar Gurruchaga", "Mauro Saez", "Lucas Haddad",
    "Vicente Huete", "Ian Otersen", "Gabriel Ljubetic", "Clemente Barrios", "Tomas Alvarado",
    "Federico Kennedy", "Santiago Ostornol", "Pastor Melo", "Max Robles", "Mateo Carvajal" ] },
  { club: "Old Macks", round: 8, division: "primera", xv: [
    "Gonzalo Valenzuela", "Luis Sottovia", "Marco Díaz", "Sebastián Mayral", "Juan Rivera",
    "Joaquín Troncoso", "Augusto Villanueva", "Ignacio Berríos", "Sebastian Novoa", "Arturo Iriarte",
    "Mauro Mazzino", "Caleb Morán", "Julian Troncoso", "Giorgio Moltedo", "Franco Scassi Buffa" ] },
  { club: "PWCC", round: 8, division: "primera", xv: [
    "Carlos Delgado", "Polo Jérez", "Ángelo Alvarado", "Sebastián Benard", "Agustín Fernández",
    "Bruno Vargas", "Manuel González", "Juan Ignacio Piña", "Lukas Carvallo", "Renan Salas",
    "Rae Arce", "Cristóbal Ramírez", "Damián Fliegel", "Felipe Brangier", "Iñaki Tuset" ] },
  { club: "DOBS", round: 7, division: "primera", xv: [
    "Fernando Sahady", "Cristobal Lagos", "Diego Zamora", "Diego Pinochet", "Domingo Montan",
    "Joaquín Texido", "Vicente Prieto", "Santiago Montan", "Germán Oelckers", "Tomás Serrano",
    "Ignacio Giacaman", "Nicolás Alvarez", "Renato Arias", "Franco Rossi", "Ignacio Arias" ] },
  { club: "Stade Francais", round: 8, division: "primera", xv: [
    "Javier Cifuentes", "Gabriel Acuña", "Alvaro Tejos", "Rodrigo Cabrera", "Gael Gomez",
    "Ignacio Silva", "Maximiliano Leiva", "Inti Ubeda", "Francisco Vera", "Felipe Rouret",
    "Pedro Pablo Ubeda", "Felipe Flores", "Joaquin Huici", "Pedro Sepúlveda", "Germán Herrera" ] },
  { club: "Old Johns", round: 7, division: "primera", xv: [
    "Gonzalo Sepúlveda", "Daivis Guzmán", "Fabián Lagos", "Lucca Marchini", "Cristóbal Rivas",
    "Juan Pablo Castro", "Lucas Rubilar", "Renzo Marchini", "Hermes Didier", "Diego Pierart",
    "Cristóbal Martínez", "Felipe Neira", "Francisco Neira", "Agustín Game", "Joaquín Dibán" ] },
  { club: "Sporting RC", round: 7, division: "primera", xv: [
    "Juan Pablo Gómez", "Agustín Porro", "Sebastián Ibarra", "Lucas Zavala", "Matías Zavala",
    "Tomás Ayala", "Fernando Meyer", "Lorenzo Cicarelli", "Vicente Pérez", "Vicente Laborde",
    "Emmanuel Brane", "Gaspar Sandoval", "Martín Jackson", "Javier Lavanderos", "Álvaro Latorre" ] },
];

// ── name matching ───────────────────────────────────────────────────────────
const norm = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[.\-',]/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string): string[] => norm(s).split(" ").filter((t) => t.length > 1);

function matchLineup(name: string, pool: Player[]): Player | null {
  const nt = tokens(name);
  if (!nt.length) return null;
  // Observations are written "Firstname Lastname" / "I. Lastname", so the last
  // token is the surname. Require it to match — otherwise a player absent from
  // the stats pool would false-match a clubmate who merely shares a first name.
  const surname = nt[nt.length - 1];
  const initials = name.split(/\s+/).filter((w) => /^[A-Za-zÁÉÍÓÚÑ]\.?$/.test(w)).map((w) => norm(w[0]));
  let best: Player | null = null;
  let bestScore = 0;
  for (const p of pool) {
    const pt = new Set(tokens(p.name));
    if (!pt.has(surname)) continue;
    const shared = nt.filter((t) => pt.has(t)).length;
    const cfirst = norm(p.name).split(" ")[0];
    const initBonus = initials.some((ini) => cfirst.startsWith(ini)) ? 0.5 : 0;
    const score = shared + initBonus;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

// ── stat-based seed (fallback for unobserved players) ───────────────────────
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

const mode = <T extends string>(counts: Record<T, number>): T[] =>
  (Object.entries(counts) as [T, number][]).sort((a, b) => b[1] - a[1]).map(([k]) => k);

// ── aggregate ───────────────────────────────────────────────────────────────
const players = loadPlayers();
const posCount = new Map<string, Record<string, number>>();
const divCount = new Map<string, Record<string, number>>();
let obsMatched = 0, obsTotal = 0;

for (const obs of OBSERVATIONS) {
  const pool = players.filter((p) => p.team === obs.club);
  const unmatched: string[] = [];
  obs.xv.forEach((name, i) => {
    obsTotal++;
    const p = matchLineup(name, pool);
    if (!p) { unmatched.push(`#${i + 1} ${name}`); return; }
    obsMatched++;
    const pc = posCount.get(p.id) ?? {}; pc[STARTERS[i]] = (pc[STARTERS[i]] ?? 0) + 1; posCount.set(p.id, pc);
    const dc = divCount.get(p.id) ?? {}; dc[obs.division] = (dc[obs.division] ?? 0) + 1; divCount.set(p.id, dc);
  });
  if (unmatched.length) console.log(`${obs.club} F${obs.round} ${obs.division}: unmatched ${unmatched.join(", ")}`);
}

interface Resolved { primary: Position; secondary?: Position; division: Division; observed: boolean; }
const resolved = new Map<string, Resolved>();
for (const p of players) {
  const pc = posCount.get(p.id);
  if (pc) {
    const order = mode(pc) as Position[];
    resolved.set(p.id, {
      primary: order[0],
      secondary: order[1],
      division: (mode(divCount.get(p.id) ?? {})[0] as Division) ?? STATS_DIV[p.division],
      observed: true,
    });
  } else if (!resolved.has(p.id)) {
    resolved.set(p.id, { primary: seedPosition(p), division: STATS_DIV[p.division], observed: false });
  }
}

// ── write ───────────────────────────────────────────────────────────────────
const lines = [
  "// Fantasy player positions — arusaId -> { primary, secondary?, division }.",
  "//",
  "// `lineup`-tagged entries are aggregated from real Instagram nómina XVs across",
  "// matchdays (primary = most-played position, secondary = next, division = where",
  "// the player appears most). `seeded` entries are stat-based guesses with the",
  "// player's stats division, awaiting a lineup. Rebuild with",
  "// `npx tsx src/scripts/buildPlayerPositions.ts` (api package).",
  "",
  'import type { Division, Position } from "@/lib/fantasy";',
  "",
  "export interface PlayerPosition { primary: Position; secondary?: Position; division: Division; }",
  "",
  "export const PLAYER_POSITIONS: Record<string, PlayerPosition> = {",
];
const seen = new Set<string>();
for (const sd of ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"]) {
  const inDiv = players.filter((p) => p.division === sd && resolved.has(p.id) && !seen.has(p.id));
  if (!inDiv.length) continue;
  lines.push(`  // ── stats: ${sd} ──`);
  inDiv.sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));
  let team: string | null = null;
  for (const p of inDiv) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    if (p.team !== team) { team = p.team; lines.push(`  // ${team}`); }
    const r = resolved.get(p.id)!;
    const sec = r.secondary ? `, secondary: "${r.secondary}"` : "";
    lines.push(`  "${p.id}": { primary: "${r.primary}"${sec}, division: "${r.division}" }, // ${p.name} (${r.observed ? "lineup" : "seeded"})`);
  }
}
lines.push("};", "");
writeFileSync(POSITIONS_FILE, lines.join("\n"));

const obsPlayers = [...resolved.values()].filter((r) => r.observed).length;
const withSec = [...resolved.values()].filter((r) => r.secondary).length;
console.log(`\n✓ ${obsMatched}/${obsTotal} lineup slots matched`);
console.log(`  ${obsPlayers} players from real lineups (${withSec} with a secondary) · ${resolved.size - obsPlayers} seeded`);
