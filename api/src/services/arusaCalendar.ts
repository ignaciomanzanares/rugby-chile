/**
 * Scrape del CALENDARIO de arusa (horarios, sedes y estado aplazado/cancelado).
 *
 * Hasta ahora los horarios de los partidos futuros se cargaban a mano en el front
 * (web/src/lib/tournament.ts) y se desactualizaban. arusa expone el fixture
 * completo en `/calendar/{groupId}/all` (las 18 fechas, 5 partidos c/u). Lo
 * parseamos y lo servimos para que el front lo superponga sobre su fixture base.
 *
 * Igual que el resto de los datos de arusa: SWR (nunca bloquea al usuario) +
 * persistencia en arusa_cache para sobrevivir cortes, y warm desde arusaSync.
 */
import { DIVISION_TO_GROUP, canonicalTeam, fetchArusaPage, type DivisionKey } from "../lib/leverade";
import { readCache, writeCache } from "../lib/arusaCache";

const TOURNAMENT_ID = "1328550";
const CAL_URL = (groupId: string) =>
  `https://arusa.cl/en/tournament/${TOURNAMENT_ID}/calendar/${groupId}/all`;

export interface CalendarMatch {
  home: string;
  away: string;
  date: string | null; // "Sáb 15 Ago" (formato del fixture) o null si sin fecha
  time: string | null; // "16:00" o null
  venue: string | null;
  postponed: boolean;
  canceled: boolean;
}
export interface CalendarRound {
  round: number;
  matches: CalendarMatch[];
}

const WD: Record<string, string> = {
  Mon: "Lun", Tue: "Mar", Wed: "Mié", Thu: "Jue", Fri: "Vie", Sat: "Sáb", Sun: "Dom",
};
const MO: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr", "05": "May", "06": "Jun",
  "07": "Jul", "08": "Ago", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

const WD_IDX = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// "Sat, 08/15/2026 16:00 GMT−3" → { date: "Sáb 15 Ago", time: "16:00" }.
// OJO: usamos la hora MOSTRADA tal cual (arusa la da en GMT-3, que es la que la
// liga y la gente usa), NO recalculamos desde el UTC del data-sort.
function parseDisplayed(text: string): { date: string; time: string } | null {
  const m = text.match(/([A-Za-z]{3}),\s*(\d{2})\/(\d{2})\/\d{4}\s+(\d{2}:\d{2})\s*GMT/);
  if (!m) return null;
  const [, wd, mo, dd, hm] = m;
  return { date: `${WD[wd] ?? wd} ${Number(dd)} ${MO[mo] ?? mo}`, time: hm };
}

// Fallback: en `/all`, algunas filas no muestran el texto del horario pero traen
// `data-sort="0 YYYY-MM-DD HH:MM:SS ..."` en UTC. arusa muestra en GMT-3, así que
// el horario local es UTC−3h. Computamos en UTC puro (getUTC*) para no depender
// de la zona del host.
function fromDataSort(row: string): { date: string; time: string } | null {
  const m = row.match(/data-sort="0 (\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):\d{2}/);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  const local = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm) - 3 * 3600_000);
  const month = MO[String(local.getUTCMonth() + 1).padStart(2, "0")];
  const time = `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
  return { date: `${WD_IDX[local.getUTCDay()]} ${local.getUTCDate()} ${month}`, time };
}

/**
 * Parser del HTML de `/calendar/{groupId}/all`. La página es: header
 * "N. Fecha N" seguido de sus 5 filas <tr> de partido, en orden. Cada partido
 * tiene los equipos en <span class="ellipsis" title="…"> (orden: home, [sede],
 * away) y, en el texto, o el horario "…GMT−3" o "Postponed/Suspended/Cancelled".
 */
export function parseCalendarHTML(html: string): CalendarRound[] {
  const rounds: CalendarRound[] = [];
  const byNum = new Map<number, CalendarRound>();
  let current: CalendarRound | null = null;

  const token = /(?:>\s*(\d{1,2})\.\s*Fecha\s*\d+)|(<tr\b[^>]*>[\s\S]*?<\/tr>)/g;
  let m: RegExpExecArray | null;
  while ((m = token.exec(html))) {
    if (m[1]) {
      const n = Number(m[1]);
      current = byNum.get(n) ?? { round: n, matches: [] };
      if (!byNum.has(n)) {
        byNum.set(n, current);
        rounds.push(current);
      }
      continue;
    }
    const row = m[2];
    if (!current || !row.includes("/match/")) continue;
    const spans = [...row.matchAll(/class="ellipsis"[^>]*title="([^"]*)"/g)].map((x) => x[1]);
    if (spans.length < 2) continue;

    const home = canonicalTeam(spans[0]);
    const away = canonicalTeam(spans[spans.length - 1]);
    const venue = spans.length >= 3 ? spans[1] : null;
    const txt = row.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const status = /\b(Postponed|Suspended|Cancell?ed)\b/i.exec(txt);
    const canceled = !!status && /cancel/i.test(status[1]);
    const postponed = !!status && !canceled; // Postponed / Suspended
    // Horario mostrado; si la fila no lo trae (pasa en /all), del data-sort UTC.
    const disp = postponed || canceled ? null : parseDisplayed(txt) ?? fromDataSort(row);

    current.matches.push({
      home,
      away,
      date: disp?.date ?? null,
      time: disp?.time ?? null,
      venue,
      postponed,
      canceled,
    });
  }
  return rounds.sort((a, b) => a.round - b.round);
}

// ── SWR cache ───────────────────────────────────────────────────────────────
const cache = new Map<DivisionKey, { data: CalendarRound[]; ts: number }>();
const TTL = 30 * 60 * 1000; // el calendario cambia poco; 30 min
const refreshing = new Set<DivisionKey>();

async function refresh(division: DivisionKey): Promise<CalendarRound[] | null> {
  const groupId = DIVISION_TO_GROUP[division];
  const html = await fetchArusaPage(CAL_URL(groupId));
  if (html) {
    const rounds = parseCalendarHTML(html);
    // Sólo lo tomamos por bueno si trae partidos (evita pisar el caché con vacío).
    if (rounds.some((r) => r.matches.length > 0)) {
      cache.set(division, { data: rounds, ts: Date.now() });
      void writeCache(`calendar:${division}`, rounds);
      return rounds;
    }
  }
  const persisted = await readCache<CalendarRound[]>(`calendar:${division}`);
  if (persisted && persisted.length > 0) {
    cache.set(division, { data: persisted, ts: Date.now() });
    return persisted;
  }
  return null;
}

function triggerRefresh(division: DivisionKey): void {
  if (refreshing.has(division)) return;
  refreshing.add(division);
  void refresh(division).finally(() => refreshing.delete(division));
}

/** SWR: sirve lo cacheado (memoria o DB) al instante y refresca en bg si venció. */
export async function fetchCalendar(division: DivisionKey): Promise<CalendarRound[] | null> {
  const cached = cache.get(division);
  if (cached) {
    if (Date.now() - cached.ts >= TTL) triggerRefresh(division);
    return cached.data;
  }
  const persisted = await readCache<CalendarRound[]>(`calendar:${division}`);
  if (persisted && persisted.length > 0) {
    cache.set(division, { data: persisted, ts: Date.now() });
    triggerRefresh(division);
    return persisted;
  }
  return refresh(division);
}
