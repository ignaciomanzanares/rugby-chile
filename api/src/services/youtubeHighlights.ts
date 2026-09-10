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
  const k = raw.toLowerCase()
    .replace(/['’`]/g, "")                      // "Old John's" → "old johns"
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (ALIAS[k]) return ALIAS[k];
  // Por si viene con algo pegado ("Old Macks RC"): busca el alias más largo que calce.
  const hit = Object.keys(ALIAS).sort((a, b) => b.length - a.length).find((a) => k.includes(a));
  return hit ? ALIAS[hit] : (canonicalTeam(raw.trim()) || null);
}

function parseTitle(title: string): Omit<Highlight, "videoId" | "title"> | null {
  // "… : EQUIPO A vs EQUIPO B - <resto>"
  // Los títulos traen apóstrofes ("Old John's", "Old John’s", "Old Mack's") y
  // acentos de todo tipo ("Stade Français", "Universidad Catòlica"), así que la
  // clase de caracteres tiene que ser ancha: À-ÿ cubre el latín acentuado.
  const m = /(?::|·)?\s*([A-Za-zÀ-ÿ.'’\s]{2,28})\s+vs\.?\s+([A-Za-zÀ-ÿ.'’\s]{2,28})\s*[-–|]/i.exec(title);
  if (!m) return null;
  const a = normalizaEquipo(m[1]);
  const b = normalizaEquipo(m[2]);
  if (!a || !b || a === b) return null;
  const round = /(?:fecha|round|jornada)\s*(\d{1,2})/i.exec(title)?.[1];
  const year = /\b(20\d{2})\b/.exec(title)?.[1];
  return { teams: [a, b], round: round ? Number(round) : null, year: year ? Number(year) : null };
}

export async function buscar(query: string): Promise<Highlight[]> {
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

/** Suma videos al acumulado persistido. Lo usa el backfill por pares. */
export async function acumular(nuevos: Highlight[]): Promise<number> {
  const previos = (await readCache<Highlight[]>(CACHE_KEY)) ?? [];
  const porId = new Map(previos.map((h) => [h.videoId, h]));
  let agregados = 0;
  for (const h of nuevos) if (!porId.has(h.videoId)) { porId.set(h.videoId, h); agregados += 1; }
  if (agregados > 0) await writeCache(CACHE_KEY, [...porId.values()]);
  memoria = null; // que la próxima lectura tome lo nuevo
  return agregados;
}


// ── API oficial de YouTube ──────────────────────────────────────────────────
// Con YOUTUBE_API_KEY se recorre la playlist de SUBIDAS de cada canal, que
// devuelve el catálogo completo y es determinista — a diferencia del buscador,
// que da ~20 resultados distintos en cada corrida.
//
// Se usa playlistItems (1 unidad por página de 50) y NO search.list (100
// unidades por llamada): con la cuota gratis de 10.000/día esto es gratis en la
// práctica. El id de la playlist de subidas es el del canal con UC→UU.
const API_KEY = process.env.YOUTUBE_API_KEY;
const CANALES = [
  "UCLSRybRYNn8n6aK_R9X1M4A", // CDO — Canal del Deporte Olímpico (resúmenes por partido)
  "UChaF_KyrZlOpgTNYhgNVi3g", // ARUSA (resúmenes por fecha; se filtran igual por título)
];

async function desdeApi(): Promise<Highlight[]> {
  if (!API_KEY) return [];
  const out: Highlight[] = [];

  for (const canal of CANALES) {
    const playlist = "UU" + canal.slice(2);
    let pageToken: string | undefined;
    let paginas = 0;
    do {
      const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("playlistId", playlist);
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("key", API_KEY);
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      let json: any;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        json = await res.json();
      } catch { break; }
      if (json?.error) {
        console.warn("[youtube] API:", String(json.error.message).slice(0, 120));
        break;
      }

      for (const it of json.items ?? []) {
        const title: string = it?.snippet?.title ?? "";
        const videoId: string = it?.snippet?.resourceId?.videoId ?? "";
        if (!videoId || !title) continue;
        if (!/arusa/i.test(title) && !/top\s*10/i.test(title)) continue;
        const p = parseTitle(title);
        if (p) out.push({ videoId, title, ...p });
      }
      pageToken = json.nextPageToken;
      paginas += 1;
    } while (pageToken && paginas < 40); // tope de seguridad: 2.000 videos por canal
  }
  return out;
}

let memoria: { data: Highlight[]; ts: number } | null = null;

export async function fetchHighlights(): Promise<Highlight[]> {
  if (memoria && Date.now() - memoria.ts < TTL_MS) return memoria.data;

  const porId = new Map<string, Highlight>();

  // Con clave: catálogo completo y determinista. Sin clave: el scrape del
  // buscador, que es parcial pero no necesita configuración.
  const deApi = await desdeApi();
  for (const h of deApi) porId.set(h.videoId, h);

  if (deApi.length === 0) {
    for (const q of QUERIES) {
      try {
        for (const h of await buscar(q)) porId.set(h.videoId, h);
      } catch { /* una consulta que falle no tumba al resto */ }
    }
  }

  // ACUMULAR, no reemplazar. El buscador de YouTube no es determinista: dos
  // corridas seguidas devuelven listas distintas (57 vs 68 en una prueba). Si
  // se pisara lo guardado, un partido tendría video un día y no al siguiente.
  // Uniendo, la cobertura solo crece.
  const persistido = (await readCache<Highlight[]>(CACHE_KEY)) ?? [];
  for (const h of persistido) if (!porId.has(h.videoId)) porId.set(h.videoId, h);

  const lista = [...porId.values()];
  memoria = { data: lista, ts: Date.now() };
  if (lista.length > 0) void writeCache(CACHE_KEY, lista);
  return lista;
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
  division: string, home: string, away: string, round: number, season = 2026, pairPlayedTwice = true,
): Promise<Highlight | null> {
  // CDO filma el Top 10, o sea PRIMERA. El mismo par de clubes juega también en
  // Intermedia y Pre la misma fecha, así que sin este filtro se le colgaba el
  // video de Primera a los otros dos partidos — que son de otros jugadores.
  if (division !== "PRIMERA") return null;
  const all = await fetchHighlights();
  const h = canonicalTeam(home), a = canonicalTeam(away);
  const mismoPar = all.filter(
    (x) => (x.teams[0] === h && x.teams[1] === a) || (x.teams[0] === a && x.teams[1] === h),
  );
  const deLaTemporada = mismoPar.filter((x) => x.year == null || x.year === season);

  // Suele haber varios del mismo partido: "Resumen en 10'", "Resumen en 30'" y
  // uno suelto tipo "Jornada 16". Se prefiere el de 10', que es el formato
  // habitual y el más corto de ver.
  const prioridad = (x: Highlight) => (/\b10'/.test(x.title) ? 0 : /\b30'/.test(x.title) ? 2 : 1);
  const conFecha = deLaTemporada.filter((x) => x.round === round).sort((a, b) => prioridad(a) - prioridad(b))[0];
  if (conFecha) return conFecha;

  const sinFecha = deLaTemporada.filter((x) => x.round == null);
  if (sinFecha.length === 1 && !pairPlayedTwice) return sinFecha[0];
  return null;
}
