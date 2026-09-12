/**
 * Ensayo del EN VIVO con partidos simulados, contra una base DESECHABLE.
 *
 * Levanta la API completa en este mismo proceso (servidor, Socket.IO y crons) y
 * le pasa al poller real (processMatch) los partidos reales de la fecha 18 de
 * Primera, pero con los marcadores de un guion INVENTADO, consulta por consulta.
 * Es la misma cadena del sábado: poller → base → socket → web. Sirve para mirar
 * en el navegador que se muevan el marcador, el minuto a minuto armado desde el
 * marcador y la tabla en vivo (con bonus, empates y desempate).
 *
 * NUNCA contra producción: se niega a correr si DATABASE_URL no es localhost.
 *
 *   docker run -d --name ensayo-pg -e POSTGRES_PASSWORD=ensayo -e POSTGRES_DB=ensayo -p 5433:5432 postgres:16-alpine
 *   DOTENV_CONFIG_PATH=/nonexistent DATABASE_URL=postgres://postgres:ensayo@localhost:5433/ensayo npx drizzle-kit push --force
 *   DOTENV_CONFIG_PATH=/nonexistent npx tsx --env-file=<env del ensayo> src/scripts/ensayoEnVivo.ts
 *
 * Límite conocido: el tiempo va comprimido (una consulta cada TICK_MS), así que
 * el MINUTO que se muestra queda atrás — el poller lo topa desde la primera vez
 * que vio el partido en vivo, justamente para no mostrar "77'" con horarios mal
 * cargados. Marcadores, eventos, entretiempo por marcador y tabla no dependen
 * de eso.
 */
import type { MatchMeta } from "../lib/leverade";

// Minuto "de pared" desde el kickoff (el segundo tiempo va corrido 15 por el
// entretiempo: pared 47 = entretiempo, pared 70 = minuto 55 de juego) y marcador.
type Paso = { pared: number; h: number; a: number };

// Guion inventado, NO una predicción. Está armado para que la tabla se mueva:
// termina en triple empate a 52 entre Old Reds, Old Macks y PWCC (desempate por
// enfrentamiento directo en vivo), con un empate, bonus ofensivos y defensivos,
// y un salto de +8 (try + penal entre dos consultas).
const GUION: Record<string, Paso[]> = {
  // 20-24: Old Macks 4 tries (bonus ofensivo), Old Reds pierde por 4 (bonus defensivo).
  "Old Reds|Old Macks": [
    { pared: 2, h: 0, a: 0 }, { pared: 9, h: 7, a: 0 }, { pared: 16, h: 7, a: 5 },
    { pared: 24, h: 10, a: 5 }, { pared: 33, h: 10, a: 12 }, { pared: 47, h: 10, a: 12 },
    { pared: 62, h: 13, a: 12 }, { pared: 70, h: 13, a: 19 }, { pared: 78, h: 20, a: 19 },
    { pared: 88, h: 20, a: 24 }, { pared: 95, h: 20, a: 24 },
  ],
  // 31-17: PWCC 5 tries (bonus), Old Boys pierde por 14 (sin bonus).
  "PWCC|Old Boys": [
    { pared: 2, h: 0, a: 0 }, { pared: 9, h: 0, a: 7 }, { pared: 16, h: 7, a: 7 },
    { pared: 24, h: 12, a: 7 }, { pared: 33, h: 12, a: 10 }, { pared: 47, h: 12, a: 10 },
    { pared: 62, h: 19, a: 10 }, { pared: 70, h: 19, a: 17 }, { pared: 78, h: 26, a: 17 },
    { pared: 88, h: 31, a: 17 }, { pared: 95, h: 31, a: 17 },
  ],
  // 3-34: Stade 5 tries (bonus); incluye un +8 (try + penal en la misma consulta).
  "Sporting RC|Stade Francais": [
    { pared: 2, h: 0, a: 0 }, { pared: 9, h: 0, a: 7 }, { pared: 16, h: 3, a: 7 },
    { pared: 24, h: 3, a: 14 }, { pared: 33, h: 3, a: 19 }, { pared: 47, h: 3, a: 19 },
    { pared: 62, h: 3, a: 19 }, { pared: 70, h: 3, a: 27 }, { pared: 78, h: 3, a: 27 },
    { pared: 88, h: 3, a: 34 }, { pared: 95, h: 3, a: 34 },
  ],
  // 24-24: empate, 2 puntos cada uno.
  "Old Johns|DOBS": [
    { pared: 2, h: 0, a: 0 }, { pared: 9, h: 7, a: 0 }, { pared: 16, h: 7, a: 7 },
    { pared: 24, h: 10, a: 7 }, { pared: 33, h: 10, a: 7 }, { pared: 47, h: 10, a: 7 },
    { pared: 62, h: 10, a: 14 }, { pared: 70, h: 17, a: 14 }, { pared: 78, h: 17, a: 21 },
    { pared: 88, h: 24, a: 21 }, { pared: 95, h: 24, a: 24 },
  ],
  // 12-45: COBS 7 tries (bonus).
  "UC|COBS": [
    { pared: 2, h: 0, a: 0 }, { pared: 9, h: 0, a: 7 }, { pared: 16, h: 0, a: 14 },
    { pared: 24, h: 5, a: 14 }, { pared: 33, h: 5, a: 21 }, { pared: 47, h: 5, a: 21 },
    { pared: 62, h: 12, a: 21 }, { pared: 70, h: 12, a: 28 }, { pared: 78, h: 12, a: 35 },
    { pared: 88, h: 12, a: 40 }, { pared: 95, h: 12, a: 45 },
  ],
};

const TICK_MS = Number(process.env.ENSAYO_TICK_MS ?? 15_000);

// Leverade guarda la hora en UTC con este formato.
const utc = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("localhost")) {
    console.error("El ensayo solo corre contra una base local (DATABASE_URL con localhost). Nada que hacer.");
    process.exit(1);
  }

  // Import dinámico A PROPÓSITO: con un import estático, la API arrancaría
  // (y tocaría la base) antes de que el chequeo de arriba pudiera frenarla.
  await import("../index");
  const { processMatch } = await import("../services/leveradePoller");
  const { fetchAllMatchesMeta } = await import("../lib/leverade");

  const meta = await fetchAllMatchesMeta();
  // ENSAYO_TODAS=1 corre las tres divisiones a la vez (15 partidos), que es lo
  // que pasa el sábado a las 15:30 cuando se superponen. Inter y Pre reusan los
  // guiones de Primera por cruce, que son los mismos equipos.
  const todas = process.env.ENSAYO_TODAS === "1";
  const partidos = meta.filter((m) =>
    m.round === 18 && (todas || m.division === "PRIMERA") && GUION[`${m.homeTeam}|${m.awayTeam}`]);
  const esperados = Object.keys(GUION).length * (todas ? 3 : 1);
  if (partidos.length !== esperados) {
    console.error(`Esperaba ${esperados} partidos de la fecha 18, encontré ${partidos.length}.`);
    process.exit(1);
  }

  console.log(`\n[ensayo] ${partidos.length} partidos, una consulta cada ${TICK_MS / 1000}s. Abrí http://localhost:3000/live\n`);
  await dormir(8_000); // que el servidor termine de levantar

  const pasos = Math.max(...Object.values(GUION).map((p) => p.length));
  for (let i = 0; i < pasos; i++) {
    const linea: string[] = [];
    for (const m of partidos) {
      const guion = GUION[`${m.homeTeam}|${m.awayTeam}`];
      const p = guion[Math.min(i, guion.length - 1)];
      const ultimo = i >= guion.length - 1;
      const sim: MatchMeta = {
        ...m,
        datetime: utc(new Date(Date.now() - p.pared * 60_000)),
        homeScore: p.h,
        awayScore: p.a,
        finished: ultimo,
        // Los puntos de liga oficiales no existen todavía: que la tabla los saque
        // del marcador, como el sábado mientras se juega.
        homeLeaguePts: undefined,
        awayLeaguePts: undefined,
      };
      await processMatch(sim, false);
      if (m.division === "PRIMERA") linea.push(`${m.homeTeam} ${p.h}-${p.a} ${m.awayTeam}${ultimo ? " (final)" : ""}`);
    }
    console.log(`[ensayo] consulta ${i + 1}/${pasos}: ${linea.join(" · ")}`);
    if (i < pasos - 1) await dormir(TICK_MS);
  }
  console.log("\n[ensayo] Terminado. La API sigue arriba para mirar el resultado; cortá con Ctrl+C.\n");
})().catch((e) => { console.error(e); process.exit(1); });
