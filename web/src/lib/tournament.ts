const TEAM_SLUGS: Record<string, string> = {
  "COBS": "cobs",
  "Old Boys": "old-boys",
  "PWCC": "pwcc",
  "Old Macks": "old-macks",
  "Stade Francais": "stade-francais",
  "Sporting RC": "sporting-rc",
  "DOBS": "dobs",
  "UC": "uc",
  "Old Johns": "old-johns",
  "Old Reds": "old-reds",
};

// Instagram handles — verify with each club's official account before publishing
export const CLUB_INSTAGRAM: Record<string, string> = {
  "COBS":           "cobsrugby",
  "Old Boys":       "oldboyschile",
  "PWCC":           "pwccrugby",
  "Old Macks":      "oldmacksrugby",
  "Stade Francais": "stadefrancaischile",
  "Sporting RC":    "sportingrc_rugby",
  "DOBS":           "dobsrugby",
  "UC":             "rugbyuc",
  "Old Johns":      "oldjohnsrugby",
  "Old Reds":       "oldredsrugby",
};

/** Ruta pública al logo oficial del club (descargado de arusa.cl/leverade CDN). */
export function clubLogo(team: string): string | undefined {
  const slug = TEAM_SLUGS[team];
  return slug ? `/clubs/${slug}.jpg` : undefined;
}

/** Slug del club para la ruta /teams/[slug] (undefined si no es un club conocido). */
export function clubSlug(team: string): string | undefined {
  return TEAM_SLUGS[team];
}

export type MatchStatus = "FINISHED" | "UPCOMING";

export interface RoundMatch {
  home: string;
  away: string;
  date: string;
  time: string;
  venue: string;
  /** Suspendido (p. ej. por lluvia): no se jugó en su fecha y espera reprogramación. */
  postponed?: boolean;
  /** Texto de la nueva fecha cuando `postponed` (ej. "A definir · agosto"). */
  reschedule?: string;
}

export interface Round { round: number; dates: string; matches: RoundMatch[]; }

// Spanish month abbreviations used in the fixture date strings
const MONTH_MAP: Record<string, string> = {
  Ene: "01", Feb: "02", Mar: "03", Abr: "04", May: "05", Jun: "06",
  Jul: "07", Ago: "08", Sep: "09", Oct: "10", Nov: "11", Dic: "12",
};

/** Parses "Sáb 16 May" → Date(2026-05-16T00:00:00). Returns null for "Por definir". */
export function parseDateStr(dateStr: string): Date | null {
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const month = MONTH_MAP[parts[2]];
  if (!month) return null;
  return new Date(`2026-${month}-${parts[1].padStart(2, "0")}T00:00:00`);
}

/** True if all matches in a round have known past dates (round is fully played). */
function roundIsFinished(round: Round, today: Date): boolean {
  const realMatches = round.matches.filter(
    (m) => m.date && m.date !== "Por definir",
  );
  if (realMatches.length === 0) return false;
  return realMatches.every((m) => {
    if (m.postponed) return false; // suspendido: la fecha no está completa hasta reprogramar
    const d = parseDateStr(m.date);
    return d !== null && d < today;
  });
}

/** True if the round has at least one match today or in the future. */
function roundHasUpcoming(round: Round, today: Date): boolean {
  return round.matches.some((m) => {
    if (!m.date || m.date === "Por definir") return false;
    const d = parseDateStr(m.date);
    return d !== null && d >= today;
  });
}

/**
 * Número de la próxima fecha — canónico, basado en fechas reales.
 * Avanza automáticamente semana a semana sin cambios en el código.
 */
export function nextFechaNumber(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = ROUNDS.PRIMERA.find((r) => roundHasUpcoming(r, today));
  return next?.round ?? ROUNDS.PRIMERA[ROUNDS.PRIMERA.length - 1].round;
}

/** Última fecha completamente jugada — basado en fechas reales. */
export function lastFechaNumber(): number | undefined {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = ROUNDS.PRIMERA.length - 1; i >= 0; i--) {
    if (roundIsFinished(ROUNDS.PRIMERA[i], today)) return ROUNDS.PRIMERA[i].round;
  }
  return undefined;
}

/** Compute display status for a match based on date. Live overlay is handled in the UI. */
export function matchStatus(match: RoundMatch): MatchStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (match.postponed) return "UPCOMING"; // suspendido: no se jugó aunque la fecha ya pasó
  if (!match.date || match.date === "Por definir") return "UPCOMING";
  const d = parseDateStr(match.date);
  return d !== null && d < today ? "FINISHED" : "UPCOMING";
}

export interface StandingRow {
  pos: number; team: string; pj: number; pg: number; pe: number; pp: number;
  pf: number; pc: number; diff: number; pts: number;
}

export type DivisionKey = "PRIMERA" | "INTERMEDIA" | "PRE_INTERMEDIA";

export const DIVISIONS: { key: DivisionKey; label: string }[] = [
  { key: "PRIMERA",        label: "Primera" },
  { key: "INTERMEDIA",     label: "Intermedia" },
  { key: "PRE_INTERMEDIA", label: "Pre-Intermedia" },
];

export const STANDINGS: Record<DivisionKey, StandingRow[]> = {
  "PRIMERA": [
    { pos: 1, team: "COBS", pj: 4, pg: 4, pe: 0, pp: 0, pf: 126, pc: 74, diff: 52, pts: 18 },
    { pos: 2, team: "Old Boys", pj: 4, pg: 3, pe: 0, pp: 1, pf: 140, pc: 80, diff: 60, pts: 15 },
    { pos: 3, team: "PWCC", pj: 4, pg: 3, pe: 1, pp: 0, pf: 115, pc: 106, diff: 9, pts: 15 },
    { pos: 4, team: "Old Macks", pj: 4, pg: 2, pe: 0, pp: 2, pf: 88, pc: 72, diff: 16, pts: 12 },
    { pos: 5, team: "Stade Francais", pj: 4, pg: 1, pe: 1, pp: 2, pf: 105, pc: 113, diff: -8, pts: 8 },
    { pos: 6, team: "Sporting RC", pj: 4, pg: 2, pe: 0, pp: 2, pf: 73, pc: 97, diff: -24, pts: 8 },
    { pos: 7, team: "DOBS", pj: 4, pg: 1, pe: 0, pp: 3, pf: 103, pc: 147, diff: -44, pts: 8 },
    { pos: 8, team: "UC", pj: 4, pg: 1, pe: 0, pp: 3, pf: 115, pc: 122, diff: -7, pts: 7 },
    { pos: 9, team: "Old Johns", pj: 4, pg: 1, pe: 0, pp: 3, pf: 95, pc: 124, diff: -29, pts: 7 },
    { pos: 10, team: "Old Reds", pj: 4, pg: 1, pe: 0, pp: 3, pf: 79, pc: 104, diff: -25, pts: 6 },
  ],
  "INTERMEDIA": [
    { pos: 1, team: "Old Macks", pj: 4, pg: 4, pe: 0, pp: 0, pf: 167, pc: 48, diff: 119, pts: 20 },
    { pos: 2, team: "Old Johns", pj: 4, pg: 4, pe: 0, pp: 0, pf: 201, pc: 102, diff: 99, pts: 20 },
    { pos: 3, team: "Old Boys", pj: 4, pg: 3, pe: 0, pp: 1, pf: 152, pc: 89, diff: 63, pts: 16 },
    { pos: 4, team: "COBS", pj: 4, pg: 2, pe: 0, pp: 2, pf: 161, pc: 99, diff: 62, pts: 13 },
    { pos: 5, team: "PWCC", pj: 4, pg: 2, pe: 0, pp: 2, pf: 107, pc: 115, diff: -8, pts: 10 },
    { pos: 6, team: "DOBS", pj: 4, pg: 2, pe: 0, pp: 2, pf: 121, pc: 168, diff: -47, pts: 10 },
    { pos: 7, team: "Old Reds", pj: 4, pg: 1, pe: 0, pp: 3, pf: 115, pc: 154, diff: -39, pts: 9 },
    { pos: 8, team: "UC", pj: 4, pg: 1, pe: 0, pp: 3, pf: 114, pc: 175, diff: -61, pts: 7 },
    { pos: 9, team: "Stade Francais", pj: 4, pg: 1, pe: 0, pp: 3, pf: 82, pc: 139, diff: -57, pts: 6 },
    { pos: 10, team: "Sporting RC", pj: 4, pg: 0, pe: 0, pp: 4, pf: 77, pc: 208, diff: -131, pts: 1 },
  ],
  "PRE_INTERMEDIA": [
    { pos: 1, team: "Old Macks", pj: 4, pg: 3, pe: 1, pp: 0, pf: 167, pc: 88, diff: 79, pts: 18 },
    { pos: 2, team: "COBS", pj: 4, pg: 3, pe: 0, pp: 1, pf: 130, pc: 118, diff: 12, pts: 15 },
    { pos: 3, team: "PWCC", pj: 3, pg: 2, pe: 1, pp: 0, pf: 172, pc: 55, diff: 117, pts: 13 },
    { pos: 4, team: "Sporting RC", pj: 4, pg: 2, pe: 0, pp: 2, pf: 84, pc: 75, diff: 9, pts: 11 },
    { pos: 5, team: "Old Boys", pj: 3, pg: 2, pe: 0, pp: 1, pf: 78, pc: 40, diff: 38, pts: 10 },
    { pos: 6, team: "DOBS", pj: 3, pg: 1, pe: 0, pp: 2, pf: 71, pc: 71, diff: 0, pts: 6 },
    { pos: 7, team: "UC", pj: 2, pg: 1, pe: 0, pp: 1, pf: 63, pc: 62, diff: 1, pts: 5 },
    { pos: 8, team: "Old Johns", pj: 3, pg: 1, pe: 0, pp: 2, pf: 47, pc: 125, diff: -78, pts: 5 },
    { pos: 9, team: "Stade Francais", pj: 4, pg: 1, pe: 0, pp: 3, pf: 83, pc: 162, diff: -79, pts: 5 },
    { pos: 10, team: "Old Reds", pj: 4, pg: 0, pe: 0, pp: 4, pf: 82, pc: 181, diff: -99, pts: 2 },
  ],
};

export const ROUNDS: Record<DivisionKey, Round[]> = {
  "PRIMERA": [
    { round: 1, dates: "11-12 Abr", matches: [
      { home: "Stade Francais", away: "Old Boys", date: "Sáb 11 Abr", time: "14:00", venue: "Club Deportivo Stade Francais" },
      { home: "Old Macks", away: "Sporting RC", date: "Sáb 11 Abr", time: "14:30", venue: "Colegio Mackay" },
      { home: "UC", away: "Old Reds", date: "Sáb 11 Abr", time: "14:30", venue: "San Carlos de Apoquindo" },
      { home: "Old Johns", away: "PWCC", date: "Dom 12 Abr", time: "13:00", venue: "Colegio Saint John's" },
      { home: "COBS", away: "DOBS", date: "Dom 12 Abr", time: "14:30", venue: "Colegio Craighouse" },
    ] },
    { round: 2, dates: "18-19 Abr", matches: [
      { home: "Old Johns", away: "UC", date: "Sáb 18 Abr", time: "13:00", venue: "Colegio Saint John's" },
      { home: "Old Macks", away: "COBS", date: "Sáb 18 Abr", time: "14:00", venue: "Colegio Mackay" },
      { home: "DOBS", away: "Old Boys", date: "Sáb 18 Abr", time: "14:30", venue: "Colegio Dunalastair" },
      { home: "Sporting RC", away: "Old Reds", date: "Sáb 18 Abr", time: "14:30", venue: "Sporting Club" },
      { home: "PWCC", away: "Stade Francais", date: "Dom 19 Abr", time: "14:30", venue: "Prince of Wales Country Club" },
    ] },
    { round: 3, dates: "25-26 Abr", matches: [
      { home: "Stade Francais", away: "Old Macks", date: "Sáb 25 Abr", time: "14:00", venue: "Club Deportivo Stade Francais" },
      { home: "Old Boys", away: "Old Reds", date: "Sáb 25 Abr", time: "14:30", venue: "Old Grangonian Club" },
      { home: "Sporting RC", away: "DOBS", date: "Sáb 25 Abr", time: "14:30", venue: "Sporting Club" },
      { home: "PWCC", away: "UC", date: "Sáb 25 Abr", time: "15:00", venue: "Prince of Wales Country Club" },
      { home: "COBS", away: "Old Johns", date: "Dom 26 Abr", time: "14:30", venue: "Colegio Craighouse" },
    ] },
    { round: 4, dates: "8-10 May", matches: [
      { home: "Old Boys", away: "COBS", date: "Vie 8 May", time: "19:30", venue: "Old Grangonian Club" },
      { home: "Sporting RC", away: "Old Johns", date: "Sáb 9 May", time: "12:30", venue: "Sporting Club" },
      { home: "DOBS", away: "UC", date: "Dom 10 May", time: "14:00", venue: "Colegio Dunalastair" },
      { home: "Old Macks", away: "PWCC", date: "Dom 10 May", time: "15:30", venue: "Colegio Mackay" },
      { home: "Stade Francais", away: "Old Reds", date: "Dom 10 May", time: "15:30", venue: "Club Deportivo Stade Francais" },
    ] },
    { round: 5, dates: "16-17 May", matches: [
      { home: "Old Johns", away: "Stade Francais", date: "Sáb 16 May", time: "14:30", venue: "Colegio Saint Jonh´s" },
      { home: "PWCC", away: "COBS", date: "Sáb 16 May", time: "15:30", venue: "Prince of Wales Country Club" },
      { home: "UC", away: "Old Macks", date: "Sáb 16 May", time: "15:30", venue: "San Carlos de Apoquindo" },
      { home: "Old Boys", away: "Sporting RC", date: "Sáb 16 May", time: "17:00", venue: "Old Grangonian Club" },
      { home: "Old Reds", away: "DOBS", date: "Dom 17 May", time: "15:30", venue: "Cancha Federación" },
    ] },
    { round: 6, dates: "30-31 May", matches: [
      { home: "Old Macks", away: "Old Reds", date: "Sáb 30 May", time: "15:00", venue: "Colegio Mackay" },
      { home: "COBS", away: "UC", date: "Sáb 30 May", time: "15:30", venue: "Colegio Craighouse" },
      { home: "DOBS", away: "Old Johns", date: "Sáb 30 May", time: "15:30", venue: "Colegio Dunalastair" },
      { home: "Old Boys", away: "PWCC", date: "Dom 31 May", time: "15:30", venue: "Old Grangonian Club" },
      { home: "Stade Francais", away: "Sporting RC", date: "Dom 31 May", time: "15:30", venue: "Club Deportivo Stade Francais" },
    ] },
    { round: 7, dates: "6-7 Jun", matches: [
      { home: "Old Johns", away: "Old Macks", date: "Sáb 6 Jun", time: "15:30", venue: "Colegio Saint Jonh´s" },
      { home: "DOBS", away: "Stade Francais", date: "Dom 7 Jun", time: "15:30", venue: "Colegio Dunalastair Chicureo" },
      { home: "Old Reds", away: "COBS", date: "Dom 7 Jun", time: "15:30", venue: "Cancha Federación" },
      { home: "UC", away: "Old Boys", date: "Dom 7 Jun", time: "15:30", venue: "San Carlos de Apoquindo" },
      { home: "PWCC", away: "Sporting RC", date: "Dom 7 Jun", time: "16:00", venue: "Prince of Wales Country Club" },
    ] },
    { round: 8, dates: "13-14 Jun", matches: [
      { home: "UC", away: "Stade Francais", date: "Sáb 13 Jun", time: "15:00", venue: "San Carlos de Apoquindo" },
      { home: "Old Boys", away: "Old Macks", date: "Sáb 13 Jun", time: "15:30", venue: "Old Grangonian Club" },
      { home: "Old Reds", away: "Old Johns", date: "Sáb 13 Jun", time: "15:30", venue: "Cancha Federación" },
      { home: "PWCC", away: "DOBS", date: "Sáb 13 Jun", time: "16:00", venue: "Prince of Wales Country Club" },
      { home: "COBS", away: "Sporting RC", date: "Dom 14 Jun", time: "15:30", venue: "Colegio Craighouse" },
    ] },
    { round: 9, dates: "20-21 Jun", matches: [
      { home: "Old Johns", away: "Old Boys", date: "Sáb 20 Jun", time: "14:00", venue: "Colegio Saint Jonh´s" },
      { home: "Old Macks", away: "DOBS", date: "Sáb 20 Jun", time: "15:00", venue: "Colegio Mackay" },
      { home: "Old Reds", away: "PWCC", date: "Sáb 20 Jun", time: "15:30", venue: "Cancha Federación" },
      { home: "Sporting RC", away: "UC", date: "Sáb 20 Jun", time: "15:30", venue: "Sporting Club" },
      { home: "Stade Francais", away: "COBS", date: "Dom 21 Jun", time: "15:30", venue: "Stade Francais" },
    ] },
    { round: 10, dates: "4-5 Jul", matches: [
      { home: "Sporting RC", away: "Old Macks", date: "Sáb 4 Jul", time: "15:30", venue: "Sporting Club" },
      { home: "Old Reds", away: "UC", date: "Dom 5 Jul", time: "14:00", venue: "Cancha Federación" },
      { home: "DOBS", away: "COBS", date: "Dom 5 Jul", time: "15:30", venue: "Colegio Dunalastair" },
      { home: "Old Boys", away: "Stade Francais", date: "Dom 5 Jul", time: "15:30", venue: "Old Grangonian Club" },
      { home: "PWCC", away: "Old Johns", date: "Dom 5 Jul", time: "16:00", venue: "Prince of Wales Country Club" },
    ] },
    { round: 11, dates: "11-12 Jul", matches: [
      { home: "Old Boys", away: "DOBS", date: "Sáb 11 Jul", time: "15:30", venue: "Old Grangonian Club" },
      { home: "COBS", away: "Old Macks", date: "Dom 12 Jul", time: "13:30", venue: "Colegio Craighouse" },
      { home: "Old Reds", away: "Sporting RC", date: "Dom 12 Jul", time: "15:30", venue: "Cancha Federación" },
      { home: "Stade Francais", away: "PWCC", date: "Dom 12 Jul", time: "15:30", venue: "Stade Francais" },
      { home: "UC", away: "Old Johns", date: "Dom 12 Jul", time: "15:30", venue: "San Carlos de Apoquindo" },
    ] },
    { round: 12, dates: "18-19 Jul · suspendida", matches: [
      { home: "Old Johns", away: "Old Reds", date: "Sáb 18 Jul", time: "14:00", venue: "Colegio Saint Jonh´s", postponed: true, reschedule: "A definir · agosto" },
      { home: "Old Macks", away: "Old Boys", date: "Sáb 18 Jul", time: "15:00", venue: "Colegio Mackay", postponed: true, reschedule: "A definir · agosto" },
      { home: "DOBS", away: "PWCC", date: "Sáb 18 Jul", time: "15:30", venue: "Colegio Dunalastair", postponed: true, reschedule: "A definir · agosto" },
      { home: "Sporting RC", away: "COBS", date: "Sáb 18 Jul", time: "15:30", venue: "Sporting Club", postponed: true, reschedule: "A definir · agosto" },
      { home: "Stade Francais", away: "UC", date: "Dom 19 Jul", time: "15:30", venue: "Stade Francais", postponed: true, reschedule: "A definir · agosto" },
    ] },
    { round: 13, dates: "1-2 Ago", matches: [
      { home: "Old Johns", away: "Sporting RC", date: "Sáb 1 Ago", time: "14:00", venue: "Colegio Saint Jonh´s" },
      { home: "UC", away: "DOBS", date: "Sáb 1 Ago", time: "15:00", venue: "San Carlos de Apoquindo" },
      { home: "Old Reds", away: "Stade Francais", date: "Sáb 1 Ago", time: "15:30", venue: "Cancha Federación" },
      { home: "COBS", away: "Old Boys", date: "Dom 2 Ago", time: "15:30", venue: "Colegio Craighouse" },
      { home: "PWCC", away: "Old Macks", date: "Dom 2 Ago", time: "15:30", venue: "PWCC" },
    ] },
    { round: 14, dates: "8-9 Ago", matches: [
      { home: "Stade Francais", away: "Old Johns", date: "Sáb 8 Ago", time: "13:00", venue: "Stade Francais" },
      { home: "Sporting RC", away: "Old Boys", date: "Sáb 8 Ago", time: "13:30", venue: "Sporting Club" },
      { home: "Old Macks", away: "UC", date: "Sáb 8 Ago", time: "15:30", venue: "Colegio Mackay" },
      { home: "DOBS", away: "Old Reds", date: "Dom 9 Ago", time: "14:00", venue: "Colegio Dunalastair" },
      { home: "COBS", away: "PWCC", date: "Dom 9 Ago", time: "14:30", venue: "Colegio Craighouse" },
    ] },
    { round: 15, dates: "15-16 Ago", matches: [
      { home: "COBS", away: "Stade Francais", date: "Sáb 15 Ago", time: "14:00", venue: "Colegio Craighouse" },
      { home: "DOBS", away: "Old Macks", date: "Sáb 15 Ago", time: "14:30", venue: "Colegio Dunalastair Chicureo" },
      { home: "Old Boys", away: "Old Johns", date: "Sáb 15 Ago", time: "14:30", venue: "Old Grangonian Club" },
      { home: "PWCC", away: "Old Reds", date: "Sáb 15 Ago", time: "16:00", venue: "PWCC" },
      { home: "UC", away: "Sporting RC", date: "Dom 16 Ago", time: "14:30", venue: "San Carlos de Apoquindo" },
    ] },
    { round: 16, dates: "22-23 Ago", matches: [
      { home: "Old Macks", away: "Old Johns", date: "Sáb 22 Ago", time: "13:00", venue: "Colegio Mackay" },
      { home: "COBS", away: "Old Reds", date: "Sáb 22 Ago", time: "14:00", venue: "Colegio Craighouse" },
      { home: "Old Boys", away: "UC", date: "Sáb 22 Ago", time: "14:30", venue: "Old Grangonian Club" },
      { home: "Sporting RC", away: "PWCC", date: "Sáb 22 Ago", time: "14:30", venue: "Sporting Club" },
      { home: "Stade Francais", away: "DOBS", date: "Dom 23 Ago", time: "14:30", venue: "Club Deportivo Stade Francais" },
    ] },
    { round: 17, dates: "5-6 Sep", matches: [
      { home: "Old Johns", away: "COBS", date: "Sáb 5 Sep", time: "13:00", venue: "Colegio Saint Jonh´s" },
      { home: "UC", away: "PWCC", date: "Sáb 5 Sep", time: "14:00", venue: "San Carlos de Apoquindo" },
      { home: "DOBS", away: "Sporting RC", date: "Sáb 5 Sep", time: "14:30", venue: "Colegio Dunalastair" },
      { home: "Old Reds", away: "Old Boys", date: "Sáb 5 Sep", time: "14:30", venue: "Cancha Federación" },
      { home: "Old Macks", away: "Stade Francais", date: "Dom 6 Sep", time: "14:30", venue: "Colegio Mackay" },
    ] },
    { round: 18, dates: "12 Sep", matches: [
      { home: "Old Johns", away: "DOBS", date: "Sáb 12 Sep", time: "14:30", venue: "Saint John’s school" },
      { home: "Old Reds", away: "Old Macks", date: "Sáb 12 Sep", time: "14:30", venue: "Cancha Federación" },
      { home: "PWCC", away: "Old Boys", date: "Sáb 12 Sep", time: "14:30", venue: "PWCC" },
      { home: "Sporting RC", away: "Stade Francais", date: "Sáb 12 Sep", time: "14:30", venue: "Sporting Club" },
      { home: "UC", away: "COBS", date: "Sáb 12 Sep", time: "14:30", venue: "San Carlos de Apoquindo" },
    ] },
  ],
  "INTERMEDIA": [
    { round: 1, dates: "11-12 Abr", matches: [
      { home: "Stade Francais", away: "Old Boys", date: "Sáb 11 Abr", time: "12:00", venue: "Club Deportivo Stade Francais" },
      { home: "Old Macks", away: "Sporting RC", date: "Sáb 11 Abr", time: "12:30", venue: "Colegio Mackay" },
      { home: "UC", away: "Old Reds", date: "Sáb 11 Abr", time: "12:30", venue: "San Carlos de Apoquindo" },
      { home: "Old Johns", away: "PWCC", date: "Dom 12 Abr", time: "11:00", venue: "Colegio Saint John's" },
      { home: "COBS", away: "DOBS", date: "Dom 12 Abr", time: "12:30", venue: "Colegio Craighouse" },
    ] },
    { round: 2, dates: "18-19 Abr", matches: [
      { home: "Old Johns", away: "UC", date: "Sáb 18 Abr", time: "11:00", venue: "Colegio Saint John's" },
      { home: "Old Macks", away: "COBS", date: "Sáb 18 Abr", time: "12:00", venue: "Colegio Mackay" },
      { home: "DOBS", away: "Old Boys", date: "Sáb 18 Abr", time: "12:30", venue: "Colegio Dunalastair" },
      { home: "Sporting RC", away: "Old Reds", date: "Sáb 18 Abr", time: "12:30", venue: "Sporting Club" },
      { home: "PWCC", away: "Stade Francais", date: "Dom 19 Abr", time: "12:30", venue: "Prince of Wales Country Club" },
    ] },
    { round: 3, dates: "25-26 Abr", matches: [
      { home: "Stade Francais", away: "Old Macks", date: "Sáb 25 Abr", time: "12:00", venue: "Club Deportivo Stade Francais" },
      { home: "Old Boys", away: "Old Reds", date: "Sáb 25 Abr", time: "12:30", venue: "Old Grangonian Club" },
      { home: "Sporting RC", away: "DOBS", date: "Sáb 25 Abr", time: "12:30", venue: "Sporting Club" },
      { home: "PWCC", away: "UC", date: "Sáb 25 Abr", time: "13:00", venue: "Prince of Wales Country Club" },
      { home: "COBS", away: "Old Johns", date: "Dom 26 Abr", time: "12:30", venue: "Colegio Craighouse" },
    ] },
    { round: 4, dates: "9-10 May", matches: [
      { home: "Sporting RC", away: "Old Johns", date: "Sáb 9 May", time: "10:30", venue: "Sporting Club" },
      { home: "Old Boys", away: "COBS", date: "Sáb 9 May", time: "11:30", venue: "Old Grangonian Club" },
      { home: "DOBS", away: "UC", date: "Dom 10 May", time: "12:00", venue: "Colegio Dunalastair" },
      { home: "Old Macks", away: "PWCC", date: "Dom 10 May", time: "13:30", venue: "Colegio Mackay" },
      { home: "Stade Francais", away: "Old Reds", date: "Dom 10 May", time: "13:30", venue: "Club Deportivo Stade Francais" },
    ] },
    { round: 5, dates: "16-17 May", matches: [
      { home: "Old Johns", away: "Stade Francais", date: "Sáb 16 May", time: "12:30", venue: "Colegio Saint Jonh´s" },
      { home: "PWCC", away: "COBS", date: "Sáb 16 May", time: "13:30", venue: "Prince of Wales Country Club" },
      { home: "UC", away: "Old Macks", date: "Sáb 16 May", time: "13:30", venue: "San Carlos de Apoquindo" },
      { home: "Old Boys", away: "Sporting RC", date: "Sáb 16 May", time: "15:00", venue: "Old Grangonian Club" },
      { home: "Old Reds", away: "DOBS", date: "Dom 17 May", time: "13:30", venue: "Cancha Federación" },
    ] },
    { round: 6, dates: "30-31 May", matches: [
      { home: "Old Macks", away: "Old Reds", date: "Sáb 30 May", time: "13:00", venue: "Colegio Mackay" },
      { home: "COBS", away: "UC", date: "Sáb 30 May", time: "13:30", venue: "Colegio Craighouse" },
      { home: "DOBS", away: "Old Johns", date: "Sáb 30 May", time: "13:30", venue: "Colegio Dunalastair" },
      { home: "Old Boys", away: "PWCC", date: "Dom 31 May", time: "13:30", venue: "Old Grangonian Club" },
      { home: "Stade Francais", away: "Sporting RC", date: "Dom 31 May", time: "13:30", venue: "Club Deportivo Stade Francais" },
    ] },
    { round: 7, dates: "6-7 Jun", matches: [
      { home: "Old Johns", away: "Old Macks", date: "Sáb 6 Jun", time: "13:30", venue: "Colegio Saint Jonh´s" },
      { home: "DOBS", away: "Stade Francais", date: "Dom 7 Jun", time: "13:30", venue: "Colegio Dunalastair Chicureo" },
      { home: "Old Reds", away: "COBS", date: "Dom 7 Jun", time: "13:30", venue: "Cancha Federación" },
      { home: "UC", away: "Old Boys", date: "Dom 7 Jun", time: "13:30", venue: "San Carlos de Apoquindo" },
      { home: "PWCC", away: "Sporting RC", date: "Dom 7 Jun", time: "14:00", venue: "Prince of Wales Country Club" },
    ] },
    { round: 8, dates: "13-14 Jun", matches: [
      { home: "UC", away: "Stade Francais", date: "Sáb 13 Jun", time: "13:00", venue: "San Carlos de Apoquindo" },
      { home: "Old Boys", away: "Old Macks", date: "Sáb 13 Jun", time: "13:30", venue: "Old Grangonian Club" },
      { home: "Old Reds", away: "Old Johns", date: "Sáb 13 Jun", time: "13:30", venue: "Cancha Federación" },
      { home: "PWCC", away: "DOBS", date: "Sáb 13 Jun", time: "14:00", venue: "Prince of Wales Country Club" },
      { home: "COBS", away: "Sporting RC", date: "Dom 14 Jun", time: "13:30", venue: "Colegio Craighouse" },
    ] },
    { round: 9, dates: "20-21 Jun", matches: [
      { home: "Old Johns", away: "Old Boys", date: "Sáb 20 Jun", time: "12:00", venue: "Colegio Saint Jonh´s" },
      { home: "Old Macks", away: "DOBS", date: "Sáb 20 Jun", time: "13:00", venue: "Colegio Mackay" },
      { home: "Old Reds", away: "PWCC", date: "Sáb 20 Jun", time: "13:30", venue: "Cancha Federación" },
      { home: "Sporting RC", away: "UC", date: "Sáb 20 Jun", time: "13:30", venue: "Sporting Club" },
      { home: "Stade Francais", away: "COBS", date: "Dom 21 Jun", time: "13:30", venue: "Stade Francais" },
    ] },
    { round: 10, dates: "4-5 Jul", matches: [
      { home: "Sporting RC", away: "Old Macks", date: "Sáb 4 Jul", time: "13:30", venue: "Sporting Club" },
      { home: "Old Reds", away: "UC", date: "Dom 5 Jul", time: "12:00", venue: "Cancha Federación" },
      { home: "DOBS", away: "COBS", date: "Dom 5 Jul", time: "13:30", venue: "Colegio Dunalastair" },
      { home: "Old Boys", away: "Stade Francais", date: "Dom 5 Jul", time: "13:30", venue: "Old Grangonian Club" },
      { home: "PWCC", away: "Old Johns", date: "Dom 5 Jul", time: "14:00", venue: "Prince of Wales Country Club" },
    ] },
    { round: 11, dates: "11-12 Jul", matches: [
      { home: "Old Boys", away: "DOBS", date: "Sáb 11 Jul", time: "13:30", venue: "Old Grangonian Club" },
      { home: "Old Reds", away: "Sporting RC", date: "Dom 12 Jul", time: "13:30", venue: "Cancha Federación" },
      { home: "Stade Francais", away: "PWCC", date: "Dom 12 Jul", time: "13:30", venue: "Stade Francais" },
      { home: "UC", away: "Old Johns", date: "Dom 12 Jul", time: "13:30", venue: "San Carlos de Apoquindo" },
      { home: "COBS", away: "Old Macks", date: "Dom 12 Jul", time: "15:30", venue: "Colegio Craighouse" },
    ] },
    { round: 12, dates: "18-19 Jul · suspendida", matches: [
      { home: "Old Johns", away: "Old Reds", date: "Sáb 18 Jul", time: "12:00", venue: "Colegio Saint Jonh´s", postponed: true, reschedule: "A definir · agosto" },
      { home: "Old Macks", away: "Old Boys", date: "Sáb 18 Jul", time: "13:00", venue: "Colegio Mackay", postponed: true, reschedule: "A definir · agosto" },
      { home: "DOBS", away: "PWCC", date: "Sáb 18 Jul", time: "13:30", venue: "Colegio Dunalastair", postponed: true, reschedule: "A definir · agosto" },
      { home: "Sporting RC", away: "COBS", date: "Sáb 18 Jul", time: "13:30", venue: "Sporting Club", postponed: true, reschedule: "A definir · agosto" },
      { home: "Stade Francais", away: "UC", date: "Dom 19 Jul", time: "13:30", venue: "Stade Francais", postponed: true, reschedule: "A definir · agosto" },
    ] },
    { round: 13, dates: "1-2 Ago", matches: [
      { home: "Old Johns", away: "Sporting RC", date: "Sáb 1 Ago", time: "12:00", venue: "Colegio Saint Jonh´s" },
      { home: "UC", away: "DOBS", date: "Sáb 1 Ago", time: "13:00", venue: "San Carlos de Apoquindo" },
      { home: "Old Reds", away: "Stade Francais", date: "Sáb 1 Ago", time: "13:30", venue: "Cancha Federación" },
      { home: "COBS", away: "Old Boys", date: "Dom 2 Ago", time: "13:30", venue: "Colegio Craighouse" },
      { home: "PWCC", away: "Old Macks", date: "Dom 2 Ago", time: "13:30", venue: "PWCC" },
    ] },
    { round: 14, dates: "8-9 Ago", matches: [
      { home: "Sporting RC", away: "Old Boys", date: "Sáb 8 Ago", time: "13:00", venue: "Sporting Club" },
      { home: "Old Macks", away: "UC", date: "Sáb 8 Ago", time: "13:30", venue: "Colegio Mackay" },
      { home: "Stade Francais", away: "Old Johns", date: "Sáb 8 Ago", time: "15:00", venue: "Stade Francais" },
      { home: "DOBS", away: "Old Reds", date: "Dom 9 Ago", time: "12:00", venue: "Colegio Dunalastair" },
      { home: "COBS", away: "PWCC", date: "Dom 9 Ago", time: "12:30", venue: "Colegio Craighouse" },
    ] },
    { round: 15, dates: "15-16 Ago", matches: [
      { home: "COBS", away: "Stade Francais", date: "Sáb 15 Ago", time: "12:00", venue: "Colegio Craighouse" },
      { home: "DOBS", away: "Old Macks", date: "Sáb 15 Ago", time: "12:30", venue: "Colegio Dunalastair Chicureo" },
      { home: "PWCC", away: "Old Reds", date: "Sáb 15 Ago", time: "14:00", venue: "PWCC" },
      { home: "Old Boys", away: "Old Johns", date: "Sáb 15 Ago", time: "14:00", venue: "Old Grangonian Club" },
      { home: "UC", away: "Sporting RC", date: "Dom 16 Ago", time: "12:30", venue: "San Carlos de Apoquindo" },
    ] },
    { round: 16, dates: "22-23 Ago", matches: [
      { home: "Old Macks", away: "Old Johns", date: "Sáb 22 Ago", time: "11:00", venue: "Colegio Mackay" },
      { home: "COBS", away: "Old Reds", date: "Sáb 22 Ago", time: "12:00", venue: "Colegio Craighouse" },
      { home: "Old Boys", away: "UC", date: "Sáb 22 Ago", time: "12:30", venue: "Old Grangonian Club" },
      { home: "Sporting RC", away: "PWCC", date: "Sáb 22 Ago", time: "12:30", venue: "Sporting Club" },
      { home: "Stade Francais", away: "DOBS", date: "Dom 23 Ago", time: "12:30", venue: "Club Deportivo Stade Francais" },
    ] },
    { round: 17, dates: "5-6 Sep", matches: [
      { home: "Old Johns", away: "COBS", date: "Sáb 5 Sep", time: "11:00", venue: "Colegio Saint Jonh´s" },
      { home: "UC", away: "PWCC", date: "Sáb 5 Sep", time: "12:00", venue: "San Carlos de Apoquindo" },
      { home: "DOBS", away: "Sporting RC", date: "Sáb 5 Sep", time: "12:30", venue: "Colegio Dunalastair Chicureo" },
      { home: "Old Reds", away: "Old Boys", date: "Sáb 5 Sep", time: "12:30", venue: "Cancha Federación" },
      { home: "Old Macks", away: "Stade Francais", date: "Dom 6 Sep", time: "12:30", venue: "Colegio Mackay" },
    ] },
    { round: 18, dates: "12-13 Sep", matches: [
      { home: "Old Johns", away: "DOBS", date: "Sáb 12 Sep", time: "12:30", venue: "Saint John’s school" },
      { home: "Old Reds", away: "Old Macks", date: "Sáb 12 Sep", time: "12:30", venue: "Cancha Federación" },
      { home: "Sporting RC", away: "Stade Francais", date: "Sáb 12 Sep", time: "12:30", venue: "Sporting Club" },
      { home: "UC", away: "COBS", date: "Sáb 12 Sep", time: "12:30", venue: "San Carlos de Apoquindo" },
      { home: "PWCC", away: "Old Boys", date: "Dom 13 Sep", time: "12:30", venue: "PWCC" },
    ] },
  ],
  "PRE_INTERMEDIA": [
    { round: 1, dates: "11-12 Abr", matches: [
      { home: "Stade Francais", away: "Old Boys", date: "Sáb 11 Abr", time: "10:00", venue: "Club Deportivo Stade Francais" },
      { home: "Old Macks", away: "Sporting RC", date: "Sáb 11 Abr", time: "10:30", venue: "Colegio Mackay" },
      { home: "UC", away: "Old Reds", date: "Sáb 11 Abr", time: "10:30", venue: "San Carlos de Apoquindo" },
      { home: "Old Johns", away: "PWCC", date: "Dom 12 Abr", time: "09:00", venue: "Colegio Saint John's" },
      { home: "COBS", away: "DOBS", date: "Dom 12 Abr", time: "10:30", venue: "Colegio Craighouse" },
    ] },
    { round: 2, dates: "18-19 Abr", matches: [
      { home: "Old Macks", away: "COBS", date: "Sáb 18 Abr", time: "10:00", venue: "Colegio Mackay" },
      { home: "Sporting RC", away: "Old Reds", date: "Sáb 18 Abr", time: "10:30", venue: "Sporting Club" },
      { home: "PWCC", away: "Stade Francais", date: "Dom 19 Abr", time: "10:30", venue: "Prince of Wales Country Club" },
      { home: "DOBS", away: "Old Boys", date: "Sáb 18 Abr", time: "10:30", venue: "Colegio Dunalastair" },
      { home: "Old Johns", away: "UC", date: "Por definir", time: "", venue: "Colegio Saint John's" },
    ] },
    { round: 3, dates: "25-26 Abr", matches: [
      { home: "Stade Francais", away: "Old Macks", date: "Sáb 25 Abr", time: "10:15", venue: "Club Deportivo Stade Francais" },
      { home: "Old Boys", away: "Old Reds", date: "Sáb 25 Abr", time: "10:30", venue: "Old Grangonian Club" },
      { home: "Sporting RC", away: "DOBS", date: "Sáb 25 Abr", time: "10:30", venue: "Sporting Club" },
      { home: "COBS", away: "Old Johns", date: "Dom 26 Abr", time: "10:30", venue: "Colegio Craighouse" },
      { home: "PWCC", away: "UC", date: "Sáb 25 Abr", time: "11:00", venue: "Prince of Wales Country Club" },
    ] },
    { round: 4, dates: "9-10 May", matches: [
      { home: "Old Boys", away: "COBS", date: "Sáb 9 May", time: "09:30", venue: "Old Grangonian Club" },
      { home: "Sporting RC", away: "Old Johns", date: "Sáb 9 May", time: "14:30", venue: "Sporting Club" },
      { home: "DOBS", away: "UC", date: "Dom 10 May", time: "10:00", venue: "Colegio Dunalastair" },
      { home: "Old Macks", away: "PWCC", date: "Dom 10 May", time: "11:30", venue: "Colegio Mackay" },
      { home: "Stade Francais", away: "Old Reds", date: "Dom 10 May", time: "11:30", venue: "Club Deportivo Stade Francais" },
    ] },
    { round: 5, dates: "16-17 May", matches: [
      { home: "Old Johns", away: "Stade Francais", date: "Sáb 16 May", time: "10:30", venue: "Colegio Saint Jonh´s" },
      { home: "PWCC", away: "COBS", date: "Sáb 16 May", time: "11:30", venue: "Prince of Wales Country Club" },
      { home: "UC", away: "Old Macks", date: "Sáb 16 May", time: "11:30", venue: "San Carlos de Apoquindo" },
      { home: "Old Boys", away: "Sporting RC", date: "Sáb 16 May", time: "13:00", venue: "Old Grangonian Club" },
      { home: "Old Reds", away: "DOBS", date: "Dom 17 May", time: "11:30", venue: "Cancha Federación" },
    ] },
    { round: 6, dates: "30-31 May", matches: [
      { home: "Old Macks", away: "Old Reds", date: "Sáb 30 May", time: "11:00", venue: "Colegio Mackay" },
      { home: "COBS", away: "UC", date: "Sáb 30 May", time: "11:30", venue: "Colegio Craighouse" },
      { home: "DOBS", away: "Old Johns", date: "Sáb 30 May", time: "11:30", venue: "Colegio Dunalastair" },
      { home: "Old Boys", away: "PWCC", date: "Dom 31 May", time: "11:30", venue: "Old Grangonian Club" },
      { home: "Stade Francais", away: "Sporting RC", date: "Dom 31 May", time: "11:30", venue: "Club Deportivo Stade Francais" },
    ] },
    { round: 7, dates: "6-7 Jun", matches: [
      { home: "Old Johns", away: "Old Macks", date: "Sáb 6 Jun", time: "11:30", venue: "Colegio Saint Jonh´s" },
      { home: "DOBS", away: "Stade Francais", date: "Dom 7 Jun", time: "11:30", venue: "Colegio Dunalastair Chicureo" },
      { home: "Old Reds", away: "COBS", date: "Dom 7 Jun", time: "11:30", venue: "Cancha Federación" },
      { home: "UC", away: "Old Boys", date: "Dom 7 Jun", time: "11:30", venue: "San Carlos de Apoquindo" },
      { home: "PWCC", away: "Sporting RC", date: "Dom 7 Jun", time: "12:00", venue: "Prince of Wales Country Club" },
    ] },
    { round: 8, dates: "13-14 Jun", matches: [
      { home: "UC", away: "Stade Francais", date: "Sáb 13 Jun", time: "11:00", venue: "San Carlos de Apoquindo" },
      { home: "Old Boys", away: "Old Macks", date: "Sáb 13 Jun", time: "11:30", venue: "Old Grangonian Club" },
      { home: "Old Reds", away: "Old Johns", date: "Sáb 13 Jun", time: "11:30", venue: "Cancha Federación" },
      { home: "PWCC", away: "DOBS", date: "Sáb 13 Jun", time: "12:00", venue: "Prince of Wales Country Club" },
      { home: "COBS", away: "Sporting RC", date: "Dom 14 Jun", time: "11:30", venue: "Colegio Craighouse" },
    ] },
    { round: 9, dates: "20-21 Jun", matches: [
      { home: "Old Johns", away: "Old Boys", date: "Sáb 20 Jun", time: "10:00", venue: "Colegio Saint Jonh´s" },
      { home: "Old Macks", away: "DOBS", date: "Sáb 20 Jun", time: "11:30", venue: "Colegio Mackay" },
      { home: "Old Reds", away: "PWCC", date: "Sáb 20 Jun", time: "11:30", venue: "Cancha Federación" },
      { home: "Sporting RC", away: "UC", date: "Sáb 20 Jun", time: "11:30", venue: "Sporting Club" },
      { home: "Stade Francais", away: "COBS", date: "Dom 21 Jun", time: "11:30", venue: "Stade Francais" },
    ] },
    { round: 10, dates: "4-5 Jul", matches: [
      { home: "Sporting RC", away: "Old Macks", date: "Sáb 4 Jul", time: "11:30", venue: "Sporting Club" },
      { home: "Old Reds", away: "UC", date: "Dom 5 Jul", time: "10:00", venue: "Cancha Federación" },
      { home: "DOBS", away: "COBS", date: "Dom 5 Jul", time: "11:30", venue: "Colegio Dunalastair" },
      { home: "Old Boys", away: "Stade Francais", date: "Dom 5 Jul", time: "11:30", venue: "Old Grangonian Club" },
      { home: "PWCC", away: "Old Johns", date: "Dom 5 Jul", time: "12:00", venue: "Prince of Wales Country Club" },
    ] },
    { round: 11, dates: "11-12 Jul", matches: [
      { home: "Old Boys", away: "DOBS", date: "Sáb 11 Jul", time: "11:30", venue: "Old Grangonian Club" },
      { home: "COBS", away: "Old Macks", date: "Dom 12 Jul", time: "11:30", venue: "Colegio Craighouse" },
      { home: "Old Reds", away: "Sporting RC", date: "Dom 12 Jul", time: "11:30", venue: "Cancha Federación" },
      { home: "Stade Francais", away: "PWCC", date: "Dom 12 Jul", time: "11:30", venue: "Stade Francais" },
      { home: "UC", away: "Old Johns", date: "Dom 12 Jul", time: "11:30", venue: "San Carlos de Apoquindo" },
    ] },
    { round: 12, dates: "18-19 Jul · suspendida", matches: [
      { home: "Old Johns", away: "Old Reds", date: "Sáb 18 Jul", time: "10:00", venue: "Colegio Saint Jonh´s", postponed: true, reschedule: "A definir · agosto" },
      { home: "Old Macks", away: "Old Boys", date: "Sáb 18 Jul", time: "11:00", venue: "Colegio Mackay", postponed: true, reschedule: "A definir · agosto" },
      { home: "DOBS", away: "PWCC", date: "Sáb 18 Jul", time: "11:30", venue: "Colegio Dunalastair", postponed: true, reschedule: "A definir · agosto" },
      { home: "Sporting RC", away: "COBS", date: "Sáb 18 Jul", time: "11:30", venue: "Sporting Club", postponed: true, reschedule: "A definir · agosto" },
      { home: "Stade Francais", away: "UC", date: "Dom 19 Jul", time: "11:30", venue: "Stade Francais", postponed: true, reschedule: "A definir · agosto" },
    ] },
    { round: 13, dates: "1-2 Ago", matches: [
      { home: "Old Johns", away: "Sporting RC", date: "Sáb 1 Ago", time: "10:00", venue: "Colegio Saint Jonh´s" },
      { home: "UC", away: "DOBS", date: "Sáb 1 Ago", time: "11:00", venue: "San Carlos de Apoquindo" },
      { home: "Old Reds", away: "Stade Francais", date: "Sáb 1 Ago", time: "11:30", venue: "Cancha Federación" },
      { home: "COBS", away: "Old Boys", date: "Dom 2 Ago", time: "11:30", venue: "Colegio Craighouse" },
      { home: "PWCC", away: "Old Macks", date: "Dom 2 Ago", time: "11:30", venue: "PWCC" },
    ] },
    { round: 14, dates: "8-9 Ago", matches: [
      { home: "Sporting RC", away: "Old Boys", date: "Sáb 8 Ago", time: "11:00", venue: "Sporting Club", postponed: true, reschedule: "A reprogramar" },
      { home: "Old Macks", away: "UC", date: "Sáb 8 Ago", time: "11:30", venue: "Colegio Mackay", postponed: true, reschedule: "A reprogramar" },
      { home: "Stade Francais", away: "Old Johns", date: "Sáb 8 Ago", time: "11:30", venue: "Stade Francais" },
      { home: "DOBS", away: "Old Reds", date: "Dom 9 Ago", time: "10:00", venue: "Colegio Dunalastair" },
      { home: "COBS", away: "PWCC", date: "Dom 9 Ago", time: "10:30", venue: "Colegio Craighouse" },
    ] },
    { round: 15, dates: "15-16 Ago", matches: [
      { home: "COBS", away: "Stade Francais", date: "Sáb 15 Ago", time: "10:00", venue: "Colegio Craighouse" },
      { home: "DOBS", away: "Old Macks", date: "Sáb 15 Ago", time: "10:30", venue: "Colegio Dunalastair Chicureo" },
      { home: "Old Boys", away: "Old Johns", date: "Sáb 15 Ago", time: "10:30", venue: "Old Grangonian Club" },
      { home: "PWCC", away: "Old Reds", date: "Sáb 15 Ago", time: "12:00", venue: "PWCC" },
      { home: "UC", away: "Sporting RC", date: "Dom 16 Ago", time: "10:30", venue: "San Carlos de Apoquindo" },
    ] },
    { round: 16, dates: "22-23 Ago", matches: [
      { home: "Old Macks", away: "Old Johns", date: "Sáb 22 Ago", time: "09:00", venue: "Colegio Mackay" },
      { home: "COBS", away: "Old Reds", date: "Sáb 22 Ago", time: "10:00", venue: "Colegio Craighouse" },
      { home: "Old Boys", away: "UC", date: "Sáb 22 Ago", time: "10:30", venue: "Old Grangonian Club" },
      { home: "Sporting RC", away: "PWCC", date: "Sáb 22 Ago", time: "10:30", venue: "Sporting Club" },
      { home: "Stade Francais", away: "DOBS", date: "Dom 23 Ago", time: "10:30", venue: "Club Deportivo Stade Francais" },
    ] },
    { round: 17, dates: "5-6 Sep", matches: [
      { home: "Old Johns", away: "COBS", date: "Sáb 5 Sep", time: "09:00", venue: "Colegio Saint Jonh´s" },
      { home: "UC", away: "PWCC", date: "Sáb 5 Sep", time: "10:00", venue: "San Carlos de Apoquindo" },
      { home: "DOBS", away: "Sporting RC", date: "Sáb 5 Sep", time: "10:30", venue: "Colegio Dunalastair Chicureo" },
      { home: "Old Reds", away: "Old Boys", date: "Sáb 5 Sep", time: "10:30", venue: "Cancha Federación" },
      { home: "Old Macks", away: "Stade Francais", date: "Dom 6 Sep", time: "10:30", venue: "Colegio Mackay" },
    ] },
    { round: 18, dates: "12-13 Sep", matches: [
      { home: "Old Johns", away: "DOBS", date: "Sáb 12 Sep", time: "10:30", venue: "Saint John’s school" },
      { home: "Old Reds", away: "Old Macks", date: "Sáb 12 Sep", time: "10:30", venue: "Cancha Federación" },
      { home: "Sporting RC", away: "Stade Francais", date: "Sáb 12 Sep", time: "10:30", venue: "Sporting Club" },
      { home: "UC", away: "COBS", date: "Sáb 12 Sep", time: "10:30", venue: "San Carlos de Apoquindo" },
      { home: "PWCC", away: "Old Boys", date: "Dom 13 Sep", time: "10:30", venue: "PWCC" },
    ] },
  ],
};