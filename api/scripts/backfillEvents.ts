// Backfill del minuto a minuto de TODOS los partidos terminados, corrido desde
// una IP no baneada por arusa, escribiendo directo a la DB de prod (writeCache
// usa DATABASE_URL del .env).
//
// arusa limita por IP tras ~90 requests (2 por partido) con cooldown de ~15min,
// así que va por tandas: corre, y si quedaron partidos bloqueados espera a que
// pase el cooldown y sigue, hasta terminar. Prioriza PRIMERA (la división que se
// muestra) primero. Idempotente: saltea los ya persistidos.
//
// Uso: tsx --env-file=.env scripts/backfillEvents.ts
import { fetchAllMatchesMeta, backfillFinishedEvents } from "../src/lib/leverade";

const DIV_ORDER: Record<string, number> = { PRIMERA: 0, INTERMEDIA: 1, PRE_INTERMEDIA: 2 };
const COOLDOWN_MS = 16 * 60 * 1000; // un poco más que el breaker (15min)

async function main() {
  const meta = await fetchAllMatchesMeta();
  const finished = meta
    .filter((m) => m.finished)
    .sort((a, b) => (DIV_ORDER[a.division] ?? 9) - (DIV_ORDER[b.division] ?? 9) || b.round - a.round);
  console.log(`meta: ${meta.length}, terminados: ${finished.length}`);

  for (let pass = 1; pass <= 8; pass++) {
    const r = await backfillFinishedEvents(finished);
    console.log(`pass ${pass}:`, JSON.stringify(r));
    // r.already = ya en DB (o de pasadas previas); r.blocked = frenados por 429.
    if (r.blocked === 0) {
      console.log("listo — no quedan partidos bloqueados");
      break;
    }
    console.log(`quedan ${r.blocked} bloqueados; esperando ${COOLDOWN_MS / 60000}min el cooldown...`);
    await new Promise((res) => setTimeout(res, COOLDOWN_MS));
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
