/**
 * ¿Cómo se nota en Leverade que un partido arrancó?
 *
 * Hoy la app marca "en vivo" recién con el PRIMER PUNTO, porque el horario de
 * Leverade a veces viene adelantado y confiar en el reloj daba partidos "en vivo
 * 0-0" antes de jugarse. La hipótesis a comprobar: cuando el planillero abre la
 * planilla, Leverade crea las filas de resultado en 0 — o sea que pasar de "sin
 * filas" a "0-0" sería la señal del arranque, varios minutos antes del try.
 *
 * Este script mira los 5 partidos de una división cada 30s y anota el momento en
 * que aparecen las filas y el momento del primer punto. Si las filas aparecen
 * primero, conviene usarlas para marcar el partido en vivo desde el pitazo.
 *
 * Solo consulta Leverade (que nunca bloquea), nunca arusa.
 *
 *   npx tsx --env-file=.env src/scripts/verArranque.ts PRE_INTERMEDIA
 */
import { fetchAllMatchesMeta, type DivisionKey } from "../lib/leverade";

const Q = (s: string) => encodeURIComponent(s);
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hora = () => new Date().toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour12: false });

(async () => {
  const division = (process.argv[2] ?? "PRE_INTERMEDIA") as DivisionKey;
  const meta = await fetchAllMatchesMeta();
  const partidos = meta.filter((m) => m.round === 18 && m.division === division && !m.postponed);
  console.log(`\nMirando ${partidos.length} partidos de ${division}. Corta con Ctrl+C.\n`);

  const visto = new Map<string, { filas: boolean; puntos: boolean }>();
  const FIN = Date.now() + 90 * 60_000;

  while (Date.now() < FIN) {
    for (const m of partidos) {
      const d: any = await (await fetch(`https://api.leverade.com/matches?query=${Q(`id = "${m.matchId}"`)}&include=results`)).json().catch(() => ({}));
      const filas = (d.included ?? []).filter((x: any) => x.type === "result");
      const valores = filas.map((r: any) => Number(r.attributes?.value ?? 0));
      const total = valores.reduce((a: number, b: number) => a + b, 0);
      const estado = visto.get(m.matchId) ?? { filas: false, puntos: false };

      if (filas.length > 0 && !estado.filas) {
        console.log(`[${hora()}] ${m.homeTeam} vs ${m.awayTeam}: APARECIERON LAS FILAS (${valores.join("-") || "vacías"}) → la planilla se abrió`);
        estado.filas = true;
      }
      if (total > 0 && !estado.puntos) {
        console.log(`[${hora()}] ${m.homeTeam} vs ${m.awayTeam}: PRIMER PUNTO (${valores.join("-")})`);
        estado.puntos = true;
      }
      visto.set(m.matchId, estado);
    }
    if ([...visto.values()].length === partidos.length && [...visto.values()].every((v) => v.puntos)) {
      console.log("\nTodos los partidos ya anotaron. Listo.");
      break;
    }
    await dormir(30_000);
  }
  process.exit(0);
})();
