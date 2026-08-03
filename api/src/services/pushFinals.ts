import { fetchAllResults } from "../routes/leveradeResults";
import { readCache, writeCache } from "../lib/arusaCache";
import { sendPushToAll, pushEnabled, normDivision } from "./push";

// Avisa por push cuando un partido pasa a terminado en el scrape (todas las
// divisiones; cada suscripción recibe según sus categorías). Deduplica con el
// narrador en vivo por par de equipos (mismo `finalKey`), así un partido
// narrado no vuelve a avisar cuando arusa lo marca terminado. En la primera
// corrida siembra los finales actuales SIN avisar (no spamea lo viejo).
const CACHE_KEY = "push:notified-finals";

export function finalKey(division: string, home: string, away: string): string {
  const d = normDivision(division) ?? division.toLowerCase();
  const t = (s: string) => s.trim().toLowerCase();
  return `${d}|${t(home)}|${t(away)}`;
}

// Marca un final como ya notificado (lo usa también el narrador en vivo).
export async function markFinalNotified(key: string): Promise<void> {
  const notified = (await readCache<string[]>(CACHE_KEY)) ?? [];
  if (notified.includes(key)) return;
  await writeCache(CACHE_KEY, [...notified, key]);
}

type Final = { homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; division: string };

export async function checkAndNotifyFinals(): Promise<void> {
  if (!pushEnabled) return;

  const results = await fetchAllResults().catch(() => null);
  if (!results) return;

  const finals: Final[] = Object.values(results)
    .filter((r) => {
      const m = r as Partial<Final> & { finished?: boolean };
      return (
        m.finished === true &&
        typeof m.homeScore === "number" &&
        typeof m.awayScore === "number" &&
        typeof m.homeTeam === "string" &&
        typeof m.awayTeam === "string" &&
        typeof m.division === "string"
      );
    })
    .map((r) => r as Final);

  const notified = await readCache<string[]>(CACHE_KEY);

  // Primera corrida: sembrar sin avisar.
  if (!notified) {
    await writeCache(CACHE_KEY, finals.map((f) => finalKey(f.division, f.homeTeam, f.awayTeam)));
    return;
  }

  const seen = new Set(notified);
  const fresh = finals.filter((f) => !seen.has(finalKey(f.division, f.homeTeam, f.awayTeam)));
  if (fresh.length === 0) return;

  for (const f of fresh) {
    const key = finalKey(f.division, f.homeTeam, f.awayTeam);
    const div = normDivision(f.division) ?? undefined;
    await sendPushToAll(
      {
        title: "🏉 Final del partido",
        body: `${f.homeTeam} ${f.homeScore} - ${f.awayScore} ${f.awayTeam}`,
        url: "/",
        tag: `final-${key}`,
      },
      div,
    );
    seen.add(key);
  }
  await writeCache(CACHE_KEY, [...seen]);
}
