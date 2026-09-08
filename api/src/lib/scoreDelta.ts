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
  { pts: 7, type: "TRY_CONVERTED" }, // try + conversión juntos entre dos polls
  { pts: 5, type: "TRY" },
  { pts: 3, type: "PENALTY" },       // penal o drop: mismo valor, indistinguibles
  { pts: 2, type: "CONVERSION" },    // conversión cuyo try entró en un poll previo
];

/**
 * Descompone un salto de marcador en las jugadas que lo explican.
 *
 * Greedy NO sirve: +8 son try+penal pero greedy toma 7 y se queda colgado, y +9
 * lo resolvía como "try convertido + conversión", que es imposible (una
 * conversión necesita su try). Así que se enumeran todas las combinaciones y se
 * elige la más plausible: menos jugadas, penalizando las conversiones sueltas
 * (existen —el try entró en el poll anterior— pero son la excepción).
 * Si nada cuadra exacto, devolvemos vacío: mejor no mostrar nada que inventar.
 */
export function splitDelta(delta: number): { pts: number; type: string }[] {
  if (delta <= 0 || delta > 40) return [];
  let best: { pts: number; type: string }[] | null = null;
  let bestCost = Infinity;
  const cur: { pts: number; type: string }[] = [];
  const walk = (rest: number, from: number) => {
    if (rest === 0) {
      const loose = cur.filter((u) => u.type === "CONVERSION").length;
      const cost = cur.length + 2 * loose;
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
  return best ?? [];
}
