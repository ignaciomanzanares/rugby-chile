/**
 * Refresca el circuito de seven por su cuenta el día del torneo.
 *
 * Por qué hace falta. El caché del circuito es PASIVO: se recalcula cuando
 * alguien pide `/api/v1/seven` y el TTL venció. Para la tabla y los marcadores
 * da igual —el que mira, refresca—, pero los NOMBRES no: salen de comparar dos
 * fotos consecutivas del cuadro de estadísticas, así que la precisión de la
 * ventana es exactamente cada cuánto se pide el endpoint. Sin nadie pidiendo
 * entre las 09:00 y las 09:20, los tries de esos veinte minutos caen todos en
 * una sola ventana de veinte minutos.
 *
 * Y de quién dependía: de que hubiera visitantes, o de que el workflow de
 * vigilancia estuviera corriendo —y los cron de GitHub se retrasan 10-30 min en
 * runners gratuitos, que es justo cuando no sirve—. El keepwarm no cuenta:
 * golpea `/health`, que no toca el circuito.
 *
 * Así que el servidor se lo pide a sí mismo, cada dos minutos, SÓLO mientras
 * haya una etapa fechada hoy con partidos sin terminar. Es la misma condición
 * que decide el TTL corto (ver `ttlPara`), así que las dos cosas se encienden y
 * se apagan juntas. Fuera de eso no hace una sola petición.
 */
import { fetchSeven, ttlPara } from "../lib/seven";

/** Igual que el TTL del día de torneo: una foto cada dos minutos. */
const CADA_MS = 2 * 60_000;
/** Con qué frecuencia se pregunta si hoy hay torneo, cuando no lo hay. */
const SONDEO_MS = 15 * 60_000;

let temporizador: NodeJS.Timeout | null = null;

/**
 * ¿Hay etapa hoy con partidos pendientes? Se responde con lo que ya está
 * cacheado, sin salir a la red: `ttlPara` devuelve el TTL corto exactamente en
 * ese caso, así que se reutiliza en vez de duplicar la regla.
 */
async function hayTorneoAhora(): Promise<boolean> {
  const circuito = await fetchSeven().catch(() => null);
  return circuito != null && ttlPara(circuito) < 10 * 60_000;
}

async function tic(): Promise<void> {
  let proximo = SONDEO_MS;
  try {
    // fetchSeven respeta su propio TTL, así que esto no fuerza nada: el día del
    // torneo el TTL es de 2 min y la llamada recalcula —tomando la foto—; el
    // resto del tiempo devuelve lo guardado y no cuesta una petición.
    await fetchSeven();
    if (await hayTorneoAhora()) proximo = CADA_MS;
  } catch {
    /* Si falla, se vuelve a intentar en el sondeo largo. */
  }
  temporizador = setTimeout(() => void tic(), proximo);
  // Que un temporizador pendiente no impida que el proceso cierre.
  temporizador.unref?.();
}

export function startSevenPoller(): void {
  if (temporizador) return;
  // Un minuto de gracia para no pelear con el resto del arranque.
  temporizador = setTimeout(() => void tic(), 60_000);
  temporizador.unref?.();
}

/** Para los tests. */
export function stopSevenPoller(): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
}
