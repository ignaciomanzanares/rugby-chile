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

  // ── Fecha 7 (starters 1-15 + bench 16/17/18) ──
  { club: "Old Reds", round: 7, division: "primera", xv: [
    "F. Bastías", "M. Harttig", "E. Faúndez", "L. Gutiérrez", "N. Antonucci",
    "V. San Martin", "K. Mosa", "J. M. Sánchez", "J. Harttig", "D. Espinoza",
    "T. Mateluna", "T. Yañez", "A. Cherniavsky", "T. Zehnder", "S. Prat",
    "M. Cárdenas", "R. Barrena", "V. Goméz" ] },
  { club: "COBS", round: 7, division: "primera", xv: [
    "Felipe Beltrán", "Franco Costantino", "Jorge Araya", "Juan Pablo Beheran", "Diego Lagos",
    "Sebastián González", "Iñaki de Urruticoechea", "Vicente Contreras", "Jan Hasenlechner", "Lucas Sandoval",
    "Tomás Fuentes", "Gonzalo Lara", "José Ignacio Escobedo", "Benjamín Escobedo", "Benjamín Sandoval",
    "Manuel Gurruchaga", "Enzo Neglia", "Vicente Codorniú" ] },
  { club: "UC", round: 7, division: "primera", xv: [
    "Rufino Costa", "Sebastián Parra", "Matías Zapata", "Tomás Gonzalez", "Nicolás Paredes",
    "Tomás Silva", "Juan Lladser", "Juan Duhalde", "Juan Pablo Perrotta", "Diego Perrotta",
    "Ignacio Perrotta", "Felipe Chávez", "Gustavo Benko", "Elías Bruchfeld", "Agustín Infante",
    "Bastián Gonzalez", "Andrés Bisquertt", "José Tomás Munita" ] },
  { club: "Old Boys", round: 7, division: "primera", xv: [
    "Sebastian Valech", "Jose Tomas Silva", "Baltazar Gurruchaga", "Nicolás Yañez", "Mauro Saez",
    "Vicente Huete", "Gabriel Ljubetic", "Vicente Ayarza", "Benjamin Goñi", "Tomas Alvarado",
    "Diego Verdugo", "Ian Otersen", "Pastor Melo", "Max Robles", "Mateo Carvajal",
    "Antonio Bozzolo", "Pablo Huete", "Lucas Haddad" ] },
  { club: "Old Macks", round: 7, division: "primera", xv: [
    "Gonzalo Valenzuela", "Luis Sottovia", "Marco Díaz", "Sebastián Mayral", "Juan Rivera",
    "Joaquín Troncoso", "Augusto Villanueva", "Ignacio Berríos", "Sebastián Novoa", "Arturo Iriarte",
    "Vicente Lopez", "Caleb Morán", "Julian Troncoso", "Vicente Gorichon", "Franco Scassi Buffa",
    "I. Guajardo", "D. Aguila", "J. Rivera" ] },

  // ── Fecha 6 (starters 1-15 + bench 16/17/18) ──
  { club: "Old Reds", round: 6, division: "primera", xv: [
    "F. Bastías", "M. Harttig", "V. Gómez", "L. Gutiérrez", "N. Antonucci",
    "J. Manzanares", "V. San Martin", "J. M. Sánchez", "J. Harttig", "D. Espinoza",
    "T. Mateluna", "T. Yañez", "A. Cherniavsky", "T. Zehnder", "S. Prat",
    "M. Cárdenas", "E. Faúndez", "R. Barrena" ] },
  { club: "UC", round: 6, division: "primera", xv: [
    "Rufino Costa", "Sebastián Parra", "Matías Zapata", "Nicolás Paredes", "Fernando Paz",
    "Tomás Gonzalez", "Juan Lladser", "Juan Duhalde", "Juan Pablo Perrotta", "Diego Perrotta",
    "Elias Bruchfeld", "Ignacio Perrotta", "Felipe Chávez", "Benjamin Pérez", "Agustín Infante",
    "Bastián Gonzalez", "Andrés Bisquertt", "José Tomás Munita" ] },
  { club: "Old Macks", round: 6, division: "primera", xv: [
    "Gonzalo Valenzuela", "Luis Sottovia", "Marco Díaz", "Sebastián Mayral", "Juan Rivera",
    "Joaquín Troncoso", "Sebastián Rojas", "Ignacio Berríos", "Arturo Iriarte", "Raimundo Maurel",
    "Renzo Vercellino", "Caleb Morán", "Vicente Gorichón", "Giorgio Moltedo", "Franco Scassi Buffa",
    "R. Silva", "B. Canales", "J. Rivera" ] },
  { club: "Stade Francais", round: 7, division: "primera", xv: [
    "Javier Cifuentes", "Gabriel Acuña", "Ignacio Flores", "Rodrigo Cabrera", "Gael Gomez",
    "Ignacio Silva", "Benjamin Soto", "Maximiliano Leiva", "Francisco Vera", "Joaquin Huici",
    "Tomás Cabello", "Christian Huerta", "Felipe Flores", "Pedro Pablo Ubeda", "Germán Herrera",
    "José Tomás Santander", "Samuel Cerón", "Juan Ignacio Letelier" ] },
  { club: "DOBS", round: 6, division: "primera", xv: [
    "Fernando Sahady", "Cristobal Lagos", "Diego Zamora", "Diego Pinochet", "Domingo Montan",
    "Joaquín Texido", "Vicente Prieto", "Santiago Montan", "Germán Oelckers", "Cristobal Atenas",
    "Nicolás Papasideris", "Nicolás Alvarez", "Renato Arias", "Franco Rossi", "Ignacio Arias",
    "Manuel Arellano", "Joseph Uauy", "Andro Kovacic" ] },
  { club: "Sporting RC", round: 6, division: "primera", xv: [
    "Juan Pablo Gómez", "Agustín Porro", "Sebastián Ibarra", "Martín Zavala", "Matías Zavala",
    "Lorenzo Cicarelli", "Fernando Meyer", "Matías Vega", "Vicente Laborde", "Álvaro Latorre",
    "Sebastián Alvarado", "Javier Lavanderos", "Gaspar Sandoval", "Vicente Pérez", "Sergio Toro" ] },
  { club: "Stade Francais", round: 6, division: "primera", xv: [
    "Christian Duarte", "Gabriel Acuña", "Ignacio Flores", "Rodrigo Cabrera", "Gael Gomez",
    "Ignacio Silva", "Benjamin Soto", "Maximiliano Leiva", "Francisco Vera", "Joaquin Huici",
    "Tomás Cabello", "Christian Huerta", "Felipe Flores", "Tomás Norambuena", "Germán Herrera",
    "Javier Cifuentes", "Claudio Iturra" ] },

  // ════════ INTERMEDIA ════════
  { club: "COBS", round: 8, division: "intermedia", xv: [
    "Diego Martínez", "Andrés Vial", "Francisco Acevedo", "Clemente Vásquez", "Cristóbal Trucco",
    "Max Whiting", "Diego Sylleros", "Tomás Fyfe", "Juan Pablo Labbe", "Francisco Figueroa",
    "Pedro Pichara", "Lucas Muñoz", "Nicolás Donoso", "Fernando López", "Cristóbal Besoaín",
    "Tomás Rivera", "Julián Manzur", "Manuel Escandón" ] },
  { club: "Old Reds", round: 8, division: "intermedia", xv: [
    "M. Flores", "M. Cárdenas", "D. Sereño", "J. P. Pérez", "F. Díaz",
    "A. López", "S. De La Fuente", "S. Astorga", "M. Escobar", "G. Martin",
    "J. Coria", "J. P. Fernández", "J. T. Barrena", "V. Martínez", "J. M. Marchant",
    "J. P. Alvear", "J. Cortés", "J. M. Pérez" ] },
  { club: "DOBS", round: 7, division: "intermedia", xv: [
    "Manuel Arellano", "Pedro Rothmann", "Pablo Correa", "Jordi Sancho", "Santiago Ramos",
    "Gonzalo Cordova", "Tomás Aparicio", "Christian Gatica", "Borja Cummins", "Martín Lagos",
    "Nicolás Degollada", "Bruno Passalacqua", "Clemente Escudero", "Ignacio Mena", "Clemente Ramírez",
    "Vicente Alcaino", "Vicente Passalacqua", "Sebastián Ghawali" ] },
  { club: "Old Macks", round: 8, division: "intermedia", xv: [
    "Diego Águila", "Ignacio Guajardo", "Gabriel Fonzo", "Carlo Schiappacasse", "Diego Berríos",
    "Gabriel Sottovia", "Nicolas Díaz", "Kurt McNab", "Francisco Muñoz", "Cristóbal Salgado",
    "Santiago Larrain", "Franco Airola", "Tomas Perez", "Lukas Marinovic", "Rafael Zavala",
    "R. Silva", "R. Salazar", "E. Amestica" ] },
  { club: "Old Johns", round: 7, division: "intermedia", xv: [
    "Bruno Cáceres", "Martín Bastidas", "Rolando Rodríguez", "Francisco Montivero", "Claudio Infante",
    "Francisco Martínez", "Sebastián Silva", "Sebastián Molina", "Joaquín Villalón", "Clemente Barría",
    "Diego Martínez", "Cristian Arriagada", "Gabriel Martínez", "Joaquín Enríquez", "Agustín Heredia",
    "Julian Chamorro", "Antonio Espinoza", "Mauricio Ceroni" ] },
  { club: "UC", round: 8, division: "intermedia", xv: [
    "Joaquin Nilo", "Bastián Gonzalez", "Ignacio Fuentealba", "Baltazar Gárate", "Simón Moyano",
    "Raimundo Torres", "Tarek Chahuan", "Daniel Gutierrez", "Gabriel León", "Simón San Martín",
    "Santiago Rojas", "Nicolás Asenjo", "Jaime Canales", "Rodrigo Rojas", "Franco Perrotta",
    "Pascal Blas", "Cristobal Escobar", "Nicolás Astorga" ] },
  { club: "Old Reds", round: 5, division: "intermedia", xv: [
    "J. Doepking", "R. Bozzo", "S. Chávez", "F. Díaz", "F. Borghi",
    "A. Lopez", "T. Fourt", "A. San Martin", "S. Perez", "T. Espinoza",
    "T. Infante", "J. M. Marchant", "J. P. Pizarro", "T. Alonso", "J. P. Coddou",
    "D. Astudillo", "M. Flores" ] },
  { club: "DOBS", round: 5, division: "intermedia", xv: [
    "Vicente Alcaino", "Nicolás Rojas", "Pablo Correa", "Jordi Sancho", "Santiago Ramos",
    "Roberto Melo", "Nicolás Manriquez", "Martín Osorio", "Borja Cummins", "Clemente Ramírez",
    "Ignacio Mena", "Tomás Passalacqua", "Clemente Escudero", "Nicolás Salazar", "Bruno Passalacqua",
    "Vicente Passalacqua", "Sebastián Ghawali", "Diego Yañez" ] },
  { club: "COBS", round: 5, division: "intermedia", xv: [
    "Diego Martínez", "Ignacio Bravo", "Alejandro Gabler", "Pedro Radrigán", "Cristóbal Trucco",
    "Max Whiting", "Tomás Fyfe", "Andrés Vial", "Juan Pablo Labbé", "Francisco Figueroa",
    "Tomás Fuentes", "Lucas Muñoz", "Nicolás Donoso", "Tomás Dallan", "Rodolfo Loyola",
    "Julián Manzur", "Cristóbal Besoain" ] },

  // ════════ PRE-INTERMEDIA ════════
  { club: "COBS", round: 8, division: "pre-intermedia", xv: [
    "Marcelo Arancibia", "Santiago Holmgren", "Lucas Conejero", "Yabra Aguad", "Diego Baudrand",
    "Lucas Radrigán", "Pedro Radrigán", "Nicolás Trucco", "Nicolás Toso", "Cristóbal González",
    "Vicente Whiting", "Joaquín Fuentes", "Diego Beltrán", "Rodolfo Loyola", "Vicente Easton",
    "Florean Schmidt", "Martín James", "Gapar Salgado" ] },
  { club: "Old Reds", round: 8, division: "pre-intermedia", xv: [
    "J. Cortés", "S. Chávez", "M. Valenzuela", "P. Preter", "J. Doepking",
    "R. Martínez", "M. Torres", "M. Urcelay", "J. A. Pérez", "J. M. Henríquez",
    "B. Becerra", "M. Sabaj", "B. Jirón", "E. Santander", "J. Vergara",
    "J. P. Alvear", "P. Chavarría", "J. M. Pérez" ] },
  { club: "DOBS", round: 7, division: "pre-intermedia", xv: [
    "Sebastián Ghawali", "Martín Sahady", "Raimundo Bobillier", "Felipe Saavedra", "Cristian Sarquis",
    "Sebastián Medina", "Cristobal Villena", "Martín Osorio", "Gerardo Flores", "Jose Tomás Collao",
    "Vicente Martinez", "Nicolás Cornejo", "Lucas Lightfoot", "Andrew Yorston", "Sebastian Allel",
    "Enrique Garrido", "Renato Fuenzalida", "Jose Gomez" ] },
  { club: "Old Macks", round: 8, division: "pre-intermedia", xv: [
    "Eduardo Améstica", "Renato Salazar", "Ignacio Gonzalez", "Bernardo Villanueva", "Pascual Ramos",
    "Sebastian Jeria", "Nasir Halasa", "Miguel Angel Sariego", "Nicolás Boye", "Alonso Arriaza",
    "Gianni Aceto", "Vicente Klapp", "Giancarlo Dasati", "Benjamin Reitze", "Dante Caselli",
    "D. Rojas", "C. Lobos", "A. Quiroz" ] },
  { club: "Old Johns", round: 7, division: "pre-intermedia", xv: [
    "Antonio Espinoza", "Julian Chamorro", "Mauricio Ceroni", "Alfredo Piwonka", "Diether Neudorfer",
    "Diego Ravanal", "Hernan Venegas", "Matías Brito", "Ignacio Leal", "Diego Villegas",
    "Lucas Bustos", "Juan Francisco Moroni", "Diego Alvear", "Jorge Avilés", "Lucas León",
    "Matías Miranda", "Máximo Cajales", "Teo Rojas" ] },
  { club: "UC", round: 8, division: "pre-intermedia", xv: [
    "Pascal Blas", "Nicolás Astorga", "Cristobal Escobar", "José Reyes", "Diego Cornejo",
    "Ignacio Román", "Agustín Lara", "Rodrigo Donoso", "José Galdames", "Benjamín Valdés",
    "Joaquín Baraona", "Santiago Izurieta", "Raúl Duhalde", "Hernan Ruiz", "Máximo Speciali",
    "Benjamín Alarcón", "Mauricio Quiroz", "José Moreno" ] },
  { club: "Old Reds", round: 5, division: "pre-intermedia", xv: [
    "J. Cortés", "D. Astudillo", "D. Sereño", "P. Preter", "F. Pérez",
    "V. Ravanal", "S. Henríquez", "S. Astorga", "J. A. Pérez", "J. M. Henriquez",
    "I. Gonzales", "S. Burgos", "J. T. Barrena", "J. Coria", "J. Vergara",
    "J. P. Alvear", "P. Chavarría", "E. Gutiérrez" ] },
  { club: "DOBS", round: 5, division: "pre-intermedia", xv: [
    "Sebastian Allel", "Enrique Garrido", "Raimundo Bobillier", "Nicholas Holmes", "Sebastián Avsolomovich",
    "Clemente Jerez", "Cristobal Villena", "Cristian Sarquis", "Gerardo Flores", "Clemente Aguirre",
    "Clemente Vásquez", "Nicolás Degollada", "Nicolás Cornejo", "Lucas Lightfoot", "Diego Cardenas",
    "Renato Fuenzalida", "Martín Sahady", "Sebastián Medina" ] },
  { club: "COBS", round: 5, division: "pre-intermedia", xv: [
    "Marcelo Arancibia", "Vicente Easton", "Santiago Holmgren", "Clemente Vásquez", "Lucas Conejero",
    "Lucas Radrigán", "Diego Baudrand", "Manuel Escandón", "Nicolás Trucco", "Juan Naranjo",
    "Joaquín Fuentes", "Vicente Whiting", "Nicolás Toso", "Diego Beltrán", "Santiago Cabargas",
    "Gaspar Salgado", "Tomás García", "Clemente Vildósola" ] },
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

// Jersey → position. Starters 1-15 by the standard XV; bench 16/17/18 are the
// front-row cover (hooker, two props). Other bench numbers (19-23) don't follow
// a fixed convention here, so they're ignored. A starting appearance weighs more
// than a bench one, so a player's real position wins ties.
const BENCH: Record<number, Position> = { 16: "HOOKER", 17: "PROP", 18: "PROP" };
function posFor(jersey: number): Position | null {
  if (jersey >= 1 && jersey <= 15) return STARTERS[jersey - 1];
  return BENCH[jersey] ?? null;
}
const weightFor = (jersey: number): number => (jersey <= 15 ? 2 : 1);

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
    const jersey = i + 1;
    const pos = posFor(jersey);
    if (!pos || !name) return;
    obsTotal++;
    const p = matchLineup(name, pool);
    if (!p) { unmatched.push(`#${jersey} ${name}`); return; }
    obsMatched++;
    const w = weightFor(jersey);
    const pc = posCount.get(p.id) ?? {}; pc[pos] = (pc[pos] ?? 0) + w; posCount.set(p.id, pc);
    const dc = divCount.get(p.id) ?? {}; dc[obs.division] = (dc[obs.division] ?? 0) + w; divCount.set(p.id, dc);
  });
  if (unmatched.length) console.log(`${obs.club} F${obs.round} ${obs.division}: unmatched ${unmatched.join(", ")}`);
}

interface Resolved { primary: Position; secondary?: Position; division: Division; }
// Observed players only — no seeded guesses. A player who never appears in a
// lineup we've read gets no entry and is therefore not in the fantasy pool.
const resolved = new Map<string, Resolved>();
for (const p of players) {
  const pc = posCount.get(p.id);
  if (!pc || resolved.has(p.id)) continue;
  const order = mode(pc) as Position[];
  resolved.set(p.id, {
    primary: order[0],
    secondary: order[1],
    division: (mode(divCount.get(p.id) ?? {})[0] as Division) ?? STATS_DIV[p.division],
  });
}

// ── write ───────────────────────────────────────────────────────────────────
const lines = [
  "// Fantasy player positions — arusaId -> { primary, secondary?, division }.",
  "//",
  "// Every entry is real, aggregated from Instagram nómina XVs across matchdays:",
  "// primary = most-played position, secondary = next, division = where the player",
  "// appears most. No seeded guesses — a player with no lineup has no entry and is",
  "// not in the fantasy pool. Rebuild with",
  "// `npx tsx src/scripts/buildPlayerPositions.ts` (api package).",
  "",
  'import type { Division, Position } from "@/lib/fantasy";',
  "",
  "export interface PlayerPosition { primary: Position; secondary?: Position; division: Division; }",
  "",
  "export const PLAYER_POSITIONS: Record<string, PlayerPosition> = {",
];
const nameById = new Map(players.map((p) => [p.id, p]));
const seen = new Set<string>();
for (const div of ["primera", "intermedia", "pre-intermedia"] as Division[]) {
  const ids = [...resolved.entries()].filter(([id, r]) => r.division === div && !seen.has(id))
    .map(([id]) => id)
    .sort((a, b) => (nameById.get(a)!.team).localeCompare(nameById.get(b)!.team) || nameById.get(a)!.name.localeCompare(nameById.get(b)!.name));
  if (!ids.length) continue;
  lines.push(`  // ── ${div.toUpperCase()} ──`);
  let team: string | null = null;
  for (const id of ids) {
    seen.add(id);
    const p = nameById.get(id)!;
    if (p.team !== team) { team = p.team; lines.push(`  // ${team}`); }
    const r = resolved.get(id)!;
    const sec = r.secondary ? `, secondary: "${r.secondary}"` : "";
    lines.push(`  "${id}": { primary: "${r.primary}"${sec}, division: "${r.division}" }, // ${p.name}`);
  }
}
lines.push("};", "");
writeFileSync(POSITIONS_FILE, lines.join("\n"));

const withSec = [...resolved.values()].filter((r) => r.secondary).length;
console.log(`\n✓ ${obsMatched}/${obsTotal} lineup slots matched`);
console.log(`  ${resolved.size} players from real lineups (${withSec} with a secondary)`);
