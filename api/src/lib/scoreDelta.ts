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

export type Marcador = { h: number; a: number } | null;

/**
 * De los dos marcadores que maneja el poller —el del timeline guardado y el que
 * publica Leverade— gana el que suma más.
 *
 * Vive acá, con el resto de la lógica pura, para poder testearlo sin arrastrar
 * la base ni la config de la app. El porqué está en processMatch: los eventos de
 * la consulta en curso se agregan DESPUÉS, así que el timeline siempre viene un
 * paso atrás, y en la última consulta no hay una siguiente que lo alcance.
 */
export function marcadorMasAdelantado(timeline: Marcador, leverade: Marcador): Marcador {
  if (!timeline) return leverade;
  if (!leverade) return timeline;
  return leverade.h + leverade.a >= timeline.h + timeline.a ? leverade : timeline;
}

/**
 * ¿Se puede dar por terminado un partido porque el marcador dejó de moverse?
 *
 * Sin arusa no tenemos minuto real, y la regla que cerraba a los 120' exigía
 * justamente esa confirmación, así que quedó muerta: todo terminaba por el
 * backstop duro, más de una hora después del pitazo final. El 2026-09-12,
 * Old Reds-Old Macks de Pre terminó 13:10 y la app lo mostró "EN VIVO" hasta
 * las 14:20.
 *
 * El marcador quieto es la evidencia que sí tenemos, y es segura justo en el
 * caso que motivó el backstop: cuando el `datetime` de Leverade viene
 * adelantado (pasa hasta en 1h), a los 120' de reloj el partido sigue en curso
 * y el marcador se mueve, así que esto no se gatilla.
 *
 * `started` evita cerrar un 0-0 que nunca arrancó, donde el marcador está
 * quieto por falta de datos y no por el pitazo final.
 */
export function terminadoPorMarcadorQuieto(
  wall: number,
  started: boolean,
  minutosSinCambio: number | null,
  fullTimeMin: number,
  staleMin: number,
): boolean {
  if (!started || minutosSinCambio == null) return false;
  return wall >= fullTimeMin && minutosSinCambio >= staleMin;
}

/**
 * Minuto aproximado de cada jugada de un lote.
 *
 * Cuando el planillero carga varias jugadas de una sola vez, no existe en
 * ninguna fuente el minuto real de cada una: Leverade sólo guarda el marcador
 * acumulado. Lo único que sabemos es que ocurrieron entre la última jugada
 * conocida (`desde`) y el minuto actual (`hasta`), así que se reparten parejas
 * en ese tramo. Es una estimación declarada, no un dato — pero respeta el orden
 * y da una separación creíble, en vez de amontonar catorce jugadas en el mismo
 * minuto como pasaba el 2026-09-12.
 *
 * Con una sola jugada, o sin tramo donde repartir, todas van al minuto actual:
 * es el caso normal del planillero que anota en vivo, donde `hasta` ya es el
 * minuto bueno.
 */
export function repartirMinutos(desde: number, hasta: number, n: number): number[] {
  const tramo = Math.max(0, hasta - desde);
  if (n <= 1 || tramo === 0) return Array.from({ length: Math.max(0, n) }, () => hasta);
  return Array.from({ length: n }, (_, i) => Math.round(desde + (tramo * (i + 1)) / n));
}

/**
 * Ordena las jugadas de un salto que tocó a los DOS equipos.
 *
 * Antes se emitía todo lo del local y después todo lo del visitante, así que un
 * volcado del planillero producía una narración falsa: el 2026-09-12, en
 * Old Reds-Old Macks de Primera la app mostraba "Old Reds 27-0" cuando en la
 * realidad los equipos se fueron alternando. El marcador final estaba bien; la
 * secuencia era inventada, y se leía como una paliza que no ocurrió.
 *
 * No hay forma de saber el orden real —Leverade sólo guarda acumulados, no
 * jugadas—, así que se reparte: en cada paso avanza el equipo que va MÁS
 * ATRASADO en proporción a lo que le falta anotar. Sigue siendo una estimación,
 * pero no puede inventar una racha larga de un solo lado, que es el error que de
 * verdad engaña al que lee.
 *
 * Con un solo equipo anotando (lo habitual) devuelve exactamente el mismo orden
 * que antes: si uno de los dos lados va vacío, no hay nada que entrelazar.
 */
export function entrelazarJugadas<T>(local: T[], visita: T[], puntos: (j: T) => number): Array<{ jugada: T; team: "home" | "away" }> {
  const totalLocal = local.reduce((s, j) => s + puntos(j), 0);
  const totalVisita = visita.reduce((s, j) => s + puntos(j), 0);
  const salida: Array<{ jugada: T; team: "home" | "away" }> = [];
  let i = 0, k = 0, accLocal = 0, accVisita = 0;

  while (i < local.length || k < visita.length) {
    // Fracción ya anotada por cada lado. El que va más atrás juega ahora.
    const fracLocal = i < local.length ? (totalLocal ? accLocal / totalLocal : 1) : Infinity;
    const fracVisita = k < visita.length ? (totalVisita ? accVisita / totalVisita : 1) : Infinity;
    if (fracLocal <= fracVisita) {
      accLocal += puntos(local[i]);
      salida.push({ jugada: local[i++], team: "home" });
    } else {
      accVisita += puntos(visita[k]);
      salida.push({ jugada: visita[k++], team: "away" });
    }
  }
  return salida;
}

/**
 * ¿Este salto pide una conversión que ningún try explica?
 *
 * En rugby no existe un +2 suelto: la conversión sigue SIEMPRE a un try. Cuando
 * el planillero carga las dos jugadas al revés, el salto aislado llega como +2 y
 * `splitDelta` no tiene más remedio que llamarlo "Conversión" — y la cronología
 * muestra algo que no puede haber pasado. Ocurrió el 2026-09-27 en Old Macks-COBS
 * de Pre: el marcador de COBS fue 0 → 2 → 7.
 *
 * `triesPendientes` son los tries de ese equipo que todavía no tienen conversión
 * en la cronología ya guardada: con uno pendiente el +2 SÍ se explica (el try
 * entró en una consulta anterior) y no hay nada raro que reportar.
 */
export function conversionSinTry(delta: number, triesPendientes: number): boolean {
  const jugadas = splitDelta(delta);
  const convs = jugadas.filter((u) => u.type === "CONVERSION").length;
  const tries = jugadas.filter((u) => u.type === "TRY").length;
  return convs - tries > Math.max(0, triesPendientes);
}

/**
 * ¿La cronología ya guardada tiene una conversión imposible?
 *
 * Sirve para REPARAR lo que se escribió antes de que existiera la prevención de
 * arriba: recorre las jugadas de cada equipo en orden y marca si alguna
 * conversión llega sin un try suyo por delante.
 *
 * El segundo filtro evita un bucle de reconstrucción: sólo vale rehacer si el
 * total del equipo se explica sin huérfanas. Un equipo con exactamente 2 puntos
 * no se puede arreglar rehaciendo —volvería a salir la misma conversión sola—,
 * así que ahí se deja como está.
 */
export function conversionHuerfana(
  eventos: Array<{ team: string; type: string }>,
  totales: { home: number; away: number },
): boolean {
  for (const team of ["home", "away"] as const) {
    let pendientes = 0;
    let huerfana = false;
    for (const e of eventos) {
      if (e.team !== team) continue;
      if (e.type === "TRY") pendientes++;
      else if (e.type === "CONVERSION" && --pendientes < 0) huerfana = true;
    }
    if (!huerfana) continue;
    const jugadas = splitDelta(totales[team]);
    const convs = jugadas.filter((u) => u.type === "CONVERSION").length;
    const tries = jugadas.filter((u) => u.type === "TRY").length;
    if (convs <= tries) return true;
  }
  return false;
}
