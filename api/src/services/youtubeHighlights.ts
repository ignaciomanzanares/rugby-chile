/**
 * Resúmenes en video POR PARTIDO.
 *
 * Los sube CDO (Canal del Deporte Olímpico), que transmite el torneo, con
 * títulos del tipo:
 *   "🏉Resumen en 10': PWCC vs DOBS - Fecha 8 Top 10 Arusa 2026"
 *   "🏉10' Highlights: PWCC vs COBS - Round 5 Top 10 Arusa 2026"
 *   "🏉Resumen en 30': Old Macks vs COBS - Final Top 10 Arusa 2025"
 *
 * ARUSA por su lado sube resúmenes por FECHA ("Resumen Fecha 16 Itaú Top 10"),
 * que es lo que cubre youtubeRecaps.ts. Este archivo es el de partido, que es
 * bastante mejor cuando existe. No todos los partidos tienen: se muestra donde hay.
 *
 * Descubrimiento: se lee la página de resultados de búsqueda de YouTube y se
 * parsea su `ytInitialData`. No hace falta API key. Es un scrape de HTML y por
 * eso puede romperse si YouTube cambia: ante cualquier fallo se sirve lo último
 * persistido y no se rompe nada.
 */
import { readCache, writeCache } from "../lib/arusaCache";
import { canonicalTeam } from "../lib/leverade";

const CACHE_KEY = "youtube:highlights";
const TTL_MS = 12 * 60 * 60 * 1000;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

// Varias consultas porque el buscador devuelve ~20 por vez y los títulos varían
// entre "Resumen en 10'" y "Highlights".
// Cada consulta devuelve ~20 resultados, así que con una sola se pierden
// partidos. Se agregan búsquedas por club para barrer mejor. Todo esto se
// cachea 12h: son ~13 peticiones a YouTube por medio día, nada.
const CLUBS = [
  "COBS", "DOBS", "Old Boys", "Old Macks", "Old Reds",
  "Old Johns", "PWCC", "Sporting RC", "Stade Francais", "UC",
];
const QUERIES = [
  "Top 10 Arusa 2026 resumen en 10",
  "Top 10 Arusa 2026 highlights",
  "Arusa Top 10 2026 fecha resumen rugby",
  ...CLUBS.map((c) => `${c} Top 10 Arusa 2026 resumen`),
];

export interface Highlight {
  videoId: string;
  title: string;
  /** Equipos en el orden del título, ya canonicalizados. */
  teams: [string, string];
  round: number | null;
  year: number | null;
}

// Los títulos escriben los clubes como se les ocurre: "Cobs", "DOBS", "Rugby
// UC", "Universidad Católica", "Stade Français". canonicalTeam no cubre esas
// variantes, así que acá se normaliza contra los 10 nombres del torneo.
const ALIAS: Record<string, string> = {
  cobs: "COBS", dobs: "DOBS",
  uc: "UC", "rugby uc": "UC", "universidad catolica": "UC", "u catolica": "UC", catolica: "UC",
  pwcc: "PWCC", "prince of wales": "PWCC",
  "old boys": "Old Boys", "old macks": "Old Macks", "old reds": "Old Reds", "old johns": "Old Johns",
  "sporting": "Sporting RC", "sporting rc": "Sporting RC",
  "stade": "Stade Francais", "stade francais": "Stade Francais", "stade français": "Stade Francais",
};

function normalizaEquipo(raw: string): string | null {
  const k = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (ALIAS[k]) return ALIAS[k];
  // Por si viene con algo pegado ("Old Macks RC"): busca el alias más largo que calce.
  const hit = Object.keys(ALIAS).sort((a, b) => b.length - a.length).find((a) => k.includes(a));
  return hit ? ALIAS[hit] : (canonicalTeam(raw.trim()) || null);
}

function parseTitle(title: string): Omit<Highlight, "videoId" | "title"> | null {
  // "… : EQUIPO A vs EQUIPO B - <resto>"
  const m = /(?::|·)?\s*([A-Za-zÁÉÍÓÚÑáéíóúñ.\s]{2,25})\s+vs\.?\s+([A-Za-zÁÉÍÓÚÑáéíóúñ.\s]{2,25})\s*[-–]/i.exec(title);
  if (!m) return null;
  const a = normalizaEquipo(m[1]);
  const b = normalizaEquipo(m[2]);
  if (!a || !b || a === b) return null;
  const round = /(?:fecha|round|jornada)\s*(\d{1,2})/i.exec(title)?.[1];
  const year = /\b(20\d{2})\b/.exec(title)?.[1];
  return { teams: [a, b], round: round ? Number(round) : null, year: year ? Number(year) : null };
}

async function buscar(query: string): Promise<Highlight[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return [];
  const html = await res.text();
  const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html);
  if (!m) return [];

  let data: unknown;
  try { data = JSON.parse(m[1]); } catch { return []; }

  const out: Highlight[] = [];
  const vistos = new Set<string>();
  const walk = (o: any): void => {
    if (o && typeof o === "object") {
      const vid = o.videoId;
      const t = o.title;
      if (typeof vid === "string" && t && typeof t === "object") {
        const title: string | undefined = t.runs?.[0]?.text ?? t.simpleText;
        if (title && !vistos.has(vid)) {
          vistos.add(vid);
          // Solo lo que sea claramente del Top 10 de ARUSA.
          if (/arusa/i.test(title) || /top\s*10/i.test(title)) {
            const p = parseTitle(title);
            if (p) out.push({ videoId: vid, title, ...p });
          }
        }
      }
      for (const v of Object.values(o)) walk(v);
    } else if (Array.isArray(o)) {
      for (const v of o) walk(v);
    }
  };
  walk(data);
  return out;
}

let memoria: { data: Highlight[]; ts: number } | null = null;

export async function fetchHighlights(): Promise<Highlight[]> {
  if (memoria && Date.now() - memoria.ts < TTL_MS) return memoria.data;

  const porId = new Map<string, Highlight>();
  for (const q of QUERIES) {
    try {
      for (const h of await buscar(q)) porId.set(h.videoId, h);
    } catch { /* una consulta que falle no tumba al resto */ }
  }

  if (porId.size > 0) {
    const lista = [...porId.values()];
    memoria = { data: lista, ts: Date.now() };
    void writeCache(CACHE_KEY, lista);
    return lista;
  }
  const persistido = (await readCache<Highlight[]>(CACHE_KEY)) ?? [];
  memoria = { data: persistido, ts: Date.now() };
  return persistido;
}

/**
 * El video de UN partido concreto, si existe.
 *
 * Empareja por los dos equipos (en cualquier orden) y, cuando el título trae la
 * fecha, también por ella. Si el título NO la trae y el par jugó dos veces en la
 * temporada (ida y vuelta), se descarta: preferimos no mostrar nada antes que
 * poner el video del partido equivocado.
 */
export async function highlightForMatch(
  home: string, away: string, round: number, season = 2026, pairPlayedTwice = true,
): Promise<Highlight | null> {
  const all = await fetchHighlights();
  const h = canonicalTeam(home), a = canonicalTeam(away);
  const mismoPar = all.filter(
    (x) => (x.teams[0] === h && x.teams[1] === a) || (x.teams[0] === a && x.teams[1] === h),
  );
  const deLaTemporada = mismoPar.filter((x) => x.year == null || x.year === season);

  const conFecha = deLaTemporada.find((x) => x.round === round);
  if (conFecha) return conFecha;

  const sinFecha = deLaTemporada.filter((x) => x.round == null);
  if (sinFecha.length === 1 && !pairPlayedTwice) return sinFecha[0];
  return null;
}
