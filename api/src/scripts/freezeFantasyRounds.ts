/**
 * Congela la alineación de las fechas ya puntuadas (una sola vez, para lo viejo).
 *
 * De acá en adelante lo hace solo el scorer y cualquier cambio de plantel, pero
 * las fechas que ya estaban puntuadas cuando se agregó el resguardo hay que
 * fijarlas a mano.
 *
 *   npx tsx --env-file=.env src/scripts/freezeFantasyRounds.ts
 */
import { freezeScoredRounds } from "../services/fantasyFreeze";

(async () => {
  for (const d of ["primera", "intermedia", "pre-intermedia"]) {
    console.log(`${d}: ${await freezeScoredRounds(d)} alineaciones congeladas`);
  }
  process.exit(0);
})();
