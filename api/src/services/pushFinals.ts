import { fetchAllResults } from "../routes/leveradeResults";
import { readCache, writeCache } from "../lib/arusaCache";
import { sendPushToAll, pushEnabled } from "./push";

// Avisa por push cuando un partido de Primera pasa a terminado. Guarda los IDs
// ya notificados en arusa_cache (durable, sin TTL) para no repetir. En la
// primera corrida siembra los finales actuales SIN avisar (evita spamear los
// resultados viejos de la temporada); solo los que terminen después disparan.
const CACHE_KEY = "push:notified-finals";

type Final = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
};

export async function checkAndNotifyFinals(): Promise<void> {
  if (!pushEnabled) return;

  const results = await fetchAllResults().catch(() => null);
  if (!results) return;

  const finals: Final[] = Object.values(results)
    .filter((r) => {
      const m = r as Partial<Final> & { finished?: boolean; division?: string };
      return (
        m.finished === true &&
        m.division === "PRIMERA" &&
        typeof m.homeScore === "number" &&
        typeof m.awayScore === "number" &&
        typeof m.matchId === "string"
      );
    })
    .map((r) => {
      const m = r as Final;
      return { matchId: m.matchId, homeTeam: m.homeTeam, awayTeam: m.awayTeam, homeScore: m.homeScore, awayScore: m.awayScore };
    });

  const notified = await readCache<string[]>(CACHE_KEY);

  // Primera corrida: sembrar sin avisar.
  if (!notified) {
    await writeCache(CACHE_KEY, finals.map((f) => f.matchId));
    return;
  }

  const seen = new Set(notified);
  const fresh = finals.filter((f) => !seen.has(f.matchId));
  if (fresh.length === 0) return;

  for (const f of fresh) {
    await sendPushToAll({
      title: "🏉 Final del partido",
      body: `${f.homeTeam} ${f.homeScore} - ${f.awayScore} ${f.awayTeam}`,
      url: "/",
      tag: `final-${f.matchId}`,
    });
    seen.add(f.matchId);
  }
  await writeCache(CACHE_KEY, [...seen]);
}
