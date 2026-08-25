// Precios del fantasy. El precio base sale del rendimiento de temporada del
// jugador (mapeado a 4.0–12.0M); después se vuelve DINÁMICO según cuánta gente lo
// compra/vende (net transfers), como en FPL. Precios en décimas (65 = 6.5M).
import { db } from "../db";
import { fantasyPlayerPrices } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { fetchPlayerStats, type DivisionKey, type PlayerStatRow } from "../lib/leverade";

const DIV_MAP: Record<string, DivisionKey> = {
  primera: "PRIMERA", intermedia: "INTERMEDIA", "pre-intermedia": "PRE_INTERMEDIA",
};

const MIN_PRICE = 40;   // 4.0M
const MAX_PRICE = 120;  // 12.0M

// Valor de temporada del jugador (mismo criterio que el puntaje fantasy).
function seasonValue(p: PlayerStatRow): number {
  return (
    p.matches * 2 +
    (p.tries + p.penaltyTries) * 10 +
    p.conversions * 2 +
    p.penalties * 3 +
    p.drops * 4 +
    p.mvp * 8 -
    p.yellowCards * 1 -
    p.redCards * 4
  );
}

// Precio base a partir del valor, mapeado linealmente al rango, redondeado a 0.1M.
function basePriceFor(value: number, maxValue: number): number {
  if (maxValue <= 0) return 50; // 5.0M por defecto al arranque de temporada
  const scaled = MIN_PRICE + (MAX_PRICE - MIN_PRICE) * Math.max(0, value) / maxValue;
  return Math.max(MIN_PRICE, Math.min(MAX_PRICE, Math.round(scaled)));
}

export interface PricedPlayer {
  arusaId: string;
  name: string;
  team: string;
  teamSlug: string;
  price: number;      // décimas
  matches: number;
  points: number;     // valor de temporada (proxy de rendimiento)
}

/** Universo de jugadores de la división con su precio (sembrando la base si falta). */
export async function getPricedPlayers(division: string): Promise<PricedPlayer[]> {
  const dk = DIV_MAP[division] ?? "PRIMERA";
  const stats = (await fetchPlayerStats(dk)) ?? [];
  if (stats.length === 0) return [];

  const maxValue = Math.max(1, ...stats.map(seasonValue));

  // Precios ya persistidos (para respetar el precio dinámico actual).
  const existing = await db
    .select()
    .from(fantasyPlayerPrices)
    .where(eq(fantasyPlayerPrices.division, division));
  const byId = new Map(existing.map((r) => [r.arusaId, r]));

  const out: PricedPlayer[] = [];
  const toSeed: Array<{ division: string; arusaId: string; price: number; basePrice: number }> = [];
  for (const p of stats) {
    const base = basePriceFor(seasonValue(p), maxValue);
    const row = byId.get(p.id);
    const price = row?.price ?? base;
    if (!row) toSeed.push({ division, arusaId: p.id, price: base, basePrice: base });
    out.push({
      arusaId: p.id, name: p.name, team: p.team, teamSlug: p.teamSlug,
      price, matches: p.matches, points: seasonValue(p),
    });
  }
  if (toSeed.length > 0) {
    await db.insert(fantasyPlayerPrices).values(toSeed).onConflictDoNothing();
  }
  return out.sort((a, b) => b.price - a.price || b.points - a.points);
}

/** Mapa arusaId → precio actual (décimas) para validar presupuesto/transfers. */
export async function priceMap(division: string): Promise<Map<string, number>> {
  const players = await getPricedPlayers(division);
  return new Map(players.map((p) => [p.arusaId, p.price]));
}

/** Ajuste dinámico de precios por net transfers (correr periódicamente). Sube
 *  1 décima por cada UMBRAL de compras netas, baja igual por ventas netas, sin
 *  pasar el rango. Resetea el contador tras ajustar. */
export async function adjustDynamicPrices(division: string, threshold = 5): Promise<number> {
  const rows = await db.select().from(fantasyPlayerPrices).where(eq(fantasyPlayerPrices.division, division));
  let changed = 0;
  for (const r of rows) {
    const steps = Math.trunc(r.netTransfers / threshold);
    if (steps === 0) continue;
    const next = Math.max(MIN_PRICE, Math.min(MAX_PRICE, r.price + steps));
    if (next !== r.price) {
      await db.update(fantasyPlayerPrices)
        .set({ price: next, netTransfers: r.netTransfers - steps * threshold, updatedAt: new Date() })
        .where(and(eq(fantasyPlayerPrices.division, division), eq(fantasyPlayerPrices.arusaId, r.arusaId)));
      changed++;
    }
  }
  return changed;
}
