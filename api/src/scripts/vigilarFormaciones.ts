/**
 * Vigila la carga de nóminas de la fecha 18 y termina cuando están todas.
 * Los clubes las suben la tarde/noche anterior, uno por uno.
 *   npx tsx --env-file=.env src/scripts/vigilarFormaciones.ts
 */
import { fetchAllMatchesMeta } from "../lib/leverade";
const Q = (s: string) => encodeURIComponent(s);
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const meta = await fetchAllMatchesMeta();
  const partidos = meta.filter((m) => m.round === 18 && !m.postponed);
  const LIMITE = Date.now() + 10 * 3600_000; // deja de mirar a las 10 horas

  while (Date.now() < LIMITE) {
    const faltan: string[] = [];
    for (const m of partidos) {
      const url = `https://api.leverade.com/matches?query=${Q(`id = "${m.matchId}"`)}&include=attendances.participant.team`;
      const d: any = await (await fetch(url)).json().catch(() => ({}));
      const inc = d.included ?? [];
      const nombre = new Map<string, string>(inc.filter((x: any) => x.type === "team").map((t: any) => [t.id, t.attributes?.name ?? t.id]));
      const equipoDe = new Map<string, string>(inc.filter((x: any) => x.type === "participant").map((p: any) => [p.id, p.relationships?.team?.data?.id]));
      const equipos = new Set<string>();
      for (const a of inc.filter((x: any) => x.type === "attendance")) {
        const t = equipoDe.get(a.relationships?.participant?.data?.id ?? "");
        if (t) equipos.add(nombre.get(t) ?? t);
      }
      // Completo = las dos nóminas cargadas.
      if (equipos.size < 2) {
        const cargado = [...equipos][0];
        faltan.push(`${m.division} ${m.homeTeam}-${m.awayTeam}${cargado ? ` (falta el rival de ${cargado})` : " (ninguna)"}`);
      }
    }
    const hora = new Date().toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" });
    if (faltan.length === 0) {
      console.log(`\n[${hora}] LISTO: los ${partidos.length} partidos tienen las dos nóminas cargadas.`);
      process.exit(0);
    }
    console.log(`[${hora}] faltan ${faltan.length}/${partidos.length}: ${faltan.join(" · ")}`);
    await dormir(15 * 60_000);
  }
  console.log("\n[vigía] corté a las 10 horas sin que estuvieran todas.");
  process.exit(0);
})();
