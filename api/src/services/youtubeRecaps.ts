/**
 * Resúmenes en video de ARUSA (YouTube).
 *
 * El canal publica "Resumen Fecha N Itaú Top 10 by Entel" — o sea son por
 * FECHA, no por partido. Así que se muestran en los partidos de Primera de esa
 * fecha, rotulados como resumen de la jornada, sin prometer que es de ese
 * partido puntual.
 *
 * Se lee del feed RSS público del canal (sin API key). Trae los 15 videos más
 * recientes, que cubre las fechas recientes y se actualiza solo cuando suben
 * una nueva. El catálogo completo necesitaría la API de YouTube con clave; la
 * página del canal devuelve HTML sin datos a un cliente sin navegador.
 *
 * No todas las fechas tienen: se muestra solo donde hay.
 */
import { readCache, writeCache } from "../lib/arusaCache";

const CHANNEL_ID = "UChaF_KyrZlOpgTNYhgNVi3g"; // Asociación Rugby de Santiago
const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const CACHE_KEY = "youtube:recaps";
const TTL_MS = 6 * 60 * 60 * 1000; // el canal sube como mucho uno por semana

export interface Recap {
  round: number;
  videoId: string;
  title: string;
  published: string;
}

function parseFeed(xml: string): Recap[] {
  const out: Recap[] = [];
  // Cada <entry> trae id, título y fecha. Nos quedamos con los que dicen
  // "Fecha N" y mencionan el Top 10 (el canal también sube femenino, tutoriales…).
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const videoId = /<yt:videoId>(.*?)<\/yt:videoId>/.exec(e)?.[1];
    const title = /<media:title>([\s\S]*?)<\/media:title>/.exec(e)?.[1]?.trim();
    const published = /<published>(.*?)<\/published>/.exec(e)?.[1] ?? "";
    if (!videoId || !title) continue;
    if (!/top\s*10/i.test(title)) continue;
    const fecha = /fecha\s*(\d{1,2})/i.exec(title)?.[1];
    if (!fecha) continue;
    out.push({ round: Number(fecha), videoId, title, published });
  }
  // Si hubiera dos del mismo número, gana el más nuevo.
  const porFecha = new Map<number, Recap>();
  for (const r of out.sort((a, b) => a.published.localeCompare(b.published))) porFecha.set(r.round, r);
  return [...porFecha.values()].sort((a, b) => b.round - a.round);
}

let memoria: { data: Recap[]; ts: number } | null = null;

export async function fetchRecaps(): Promise<Recap[]> {
  if (memoria && Date.now() - memoria.ts < TTL_MS) return memoria.data;

  try {
    const res = await fetch(FEED, { signal: AbortSignal.timeout(15_000) });
    if (res.ok) {
      const recaps = parseFeed(await res.text());
      if (recaps.length > 0) {
        memoria = { data: recaps, ts: Date.now() };
        void writeCache(CACHE_KEY, recaps);
        return recaps;
      }
    }
  } catch { /* sin red o YouTube caído: se sirve lo persistido */ }

  const persistido = (await readCache<Recap[]>(CACHE_KEY)) ?? [];
  memoria = { data: persistido, ts: Date.now() };
  return persistido;
}

/** El resumen de una fecha, si existe. Solo Primera: los videos son del Top 10. */
export async function recapForRound(division: string, round: number): Promise<Recap | null> {
  if (division !== "PRIMERA") return null;
  const all = await fetchRecaps();
  return all.find((r) => r.round === round) ?? null;
}
