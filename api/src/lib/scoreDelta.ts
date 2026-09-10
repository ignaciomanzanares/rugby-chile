/**
 * De un salto de marcador a las jugadas que lo explican.
 *
 * En rugby cada cambio de marcador ES un evento y el delta dice cuál. Esto es lo
 * que permite reconstruir el minuto a minuto desde el marcador de Leverade, sin
 * depender de arusa (ver appendDerivedEvents en services/leveradePoller.ts).
 *
 * Vive aparte del poller a propósito: es lógica pura y así se puede testear sin
 * arrastrar la base de datos ni la config de la app.
 */
const DERIVED_UNITS: { pts: number; type: string }[] = [
  { pts: 5, type: "TRY" },
  { pts: 3, type: "PENALTY" },    // penal o drop: mismo valor, indistinguibles
  { pts: 2, type: "CONVERSION" },
];

/**
 * Descompone un salto de marcador en las jugadas que lo explican.
 *
 * Un try convertido se emite como DOS jugadas (try + conversión), que es como se
 * lee una cronología de verdad, aunque el marcador haya saltado los 7 puntos de
 * una entre dos consultas.
 *
 * Greedy no sirve: +8 son try+penal pero tomando el mayor primero uno se queda
 * colgado. Así que se enumeran todas las combinaciones y gana la más plausible:
 * menos jugadas, penalizando las conversiones que NO tienen un try que las
 * explique dentro del mismo salto (existen —el try entró en la consulta
 * anterior— pero son la excepción). Por eso +9 son tres penales y no
 * "try + dos conversiones".
 *
 * Si nada cuadra exacto, devolvemos vacío: mejor no mostrar nada que inventar.
 */
export function splitDelta(delta: number): { pts: number; type: string }[] {
  if (delta <= 0 || delta > 40) return [];
  type Jugada = { pts: number; type: string };
  let best: Jugada[] | null = null;
  let bestCost = Infinity;
  const cur: { pts: number; type: string }[] = [];
  const walk = (rest: number, from: number) => {
    if (rest === 0) {
      // Una conversión sin su try dentro del mismo salto es posible pero rara
      // (el try entró en la consulta anterior), así que se penaliza SOLO el
      // excedente: un try+conversión normal no paga nada.
      const convs = cur.filter((u) => u.type === "CONVERSION").length;
      const tries = cur.filter((u) => u.type === "TRY").length;
      const cost = cur.length + 2 * Math.max(0, convs - tries);
      if (cost < bestCost) { bestCost = cost; best = [...cur]; }
      return;
    }
    for (let i = from; i < DERIVED_UNITS.length; i++) {
      const u = DERIVED_UNITS[i];
      if (u.pts > rest) continue;
      cur.push(u);
      walk(rest - u.pts, i);   // i, no i+1: se puede repetir la misma jugada
      cur.pop();
    }
  };
  walk(delta, 0);
  // Try antes que su conversión: ordenar por puntos descendente deja
  // TRY(5) → PENALTY(3) → CONVERSION(2), que es el orden en que se juegan.
  // El tipo explícito hace falta: TypeScript solo ve `best` asignado dentro del
  // closure y en este punto lo estrecha a null, dejando el arreglo como never[].
  const jugadas: Jugada[] = best ?? [];
  return jugadas.sort((a, b) => b.pts - a.pts);
}
