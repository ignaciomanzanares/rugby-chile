// Backfill del minuto a minuto de TODOS los partidos terminados, corrido desde
// una IP no baneada por arusa, escribiendo directo a la DB de prod (writeCache
// usa DATABASE_URL del .env). Uso: tsx --env-file=.env scripts/backfillEvents.ts
import { fetchAllMatchesMeta, backfillFinishedEvents } from "../src/lib/leverade";

async function main() {
  const meta = await fetchAllMatchesMeta();
  const finished = meta.filter((m) => m.finished);
  console.log(`meta: ${meta.length} partidos, terminados: ${finished.length}`);
  const r = await backfillFinishedEvents(finished);
  console.log("resultado:", JSON.stringify(r));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
