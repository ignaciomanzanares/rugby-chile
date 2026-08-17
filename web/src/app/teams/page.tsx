import { fetchLeveradeStandings } from "@/lib/leverade";
import { TeamsGrid } from "./teams-grid";

// ISR: el shell (tarjetas con la tabla real de Primera) se pre-renderiza y se
// revalida en segundo plano cada 2 min, así sale al instante con posición/puntos
// reales sin esperar la API en el camino crítico; el cliente (teams-grid) la
// mantiene fresca encima.
export const revalidate = 120;

export default async function TeamsPage() {
  // Timeout corto: si la API está fría (Render duerme a los 15min) no bloqueamos
  // el render — cae a null y el cliente (teams-grid) rellena con su propio fetch.
  const initialRows = await fetchLeveradeStandings("PRIMERA", { next: { revalidate: 120 }, signal: AbortSignal.timeout(3500) });
  return <TeamsGrid initialRows={initialRows} />;
}
