import { fetchLeveradeStandings } from "@/lib/leverade";
import { TeamsGrid } from "./teams-grid";

// Dinámica: sembramos la tabla real de Primera en el server en cada request,
// así las tarjetas salen con posición/puntos reales al primer paint (sin flash
// del snapshot viejo, sin placeholder eterno) y el cliente la mantiene fresca.
export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  // Timeout corto: si la API está fría (Render duerme a los 15min) no bloqueamos
  // el render — cae a null y el cliente (teams-grid) rellena con su propio fetch.
  const initialRows = await fetchLeveradeStandings("PRIMERA", { signal: AbortSignal.timeout(3500) });
  return <TeamsGrid initialRows={initialRows} />;
}
