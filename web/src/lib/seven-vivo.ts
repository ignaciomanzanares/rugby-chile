import type { SevenPartido, SevenEtapa } from "./seven-api";

/**
 * Cuándo un partido de seven está EN VIVO.
 *
 * El XV tiene feed propio —el scrape de arusa manda minuto y estado por
 * socket—; el seven no tiene nada de eso: el muro tapa `/match/*` y lo único
 * que llega es la foto de Leverade, con el horario programado y un `finished`.
 * Así que "en vivo" acá se DEDUCE de la grilla, y se dice sólo cuando se puede
 * sostener:
 *
 *  - antes de la hora        → programado
 *  - pasada la hora y sin terminar, dentro de la ventana → en vivo
 *  - terminado               → final
 *  - pasada la ventana y todavía sin terminar → `demorado`: NO se afirma que
 *    esté en juego. Un partido de seven dura catorce minutos; si a los
 *    veinticinco sigue abierto, lo más probable es que el planillero no haya
 *    cerrado la planilla, no que siga jugándose.
 *
 * La ventana son 25 minutos porque la grilla pone un partido cada 20 y cada uno
 * dura 7+7 más el entretiempo.
 */
export const VENTANA_VIVO_MS = 25 * 60_000;

export type EstadoSeven = "programado" | "vivo" | "demorado" | "final" | "sin-hora";

/**
 * El kickoff en milisegundos. Chile está en UTC-3 (y la app entera asume eso:
 * el payload ya trae la hora de Chile, no UTC).
 */
export function kickoffMs(fecha: string | null, hora: string | null): number | null {
  if (!fecha || !hora) return null;
  const t = Date.parse(`${fecha}T${hora}:00.000Z`);
  return Number.isFinite(t) ? t + 3 * 60 * 60_000 : null;
}

/**
 * `ahora` en null = todavía no montó. Devuelve el estado sin mirar el reloj,
 * que leerlo durante el render haría que el HTML estático afirmara cosas
 * distintas a las del visitante.
 */
export function estadoDe(p: SevenPartido, ahora: number | null): EstadoSeven {
  if (p.finished) return "final";
  const k = kickoffMs(p.fecha, p.hora);
  if (k == null) return "sin-hora";
  if (ahora == null) return "programado";
  if (ahora < k) return "programado";
  return ahora < k + VENTANA_VIVO_MS ? "vivo" : "demorado";
}

/** Los partidos de una etapa que están en juego ahora mismo. */
export function enVivoDe(etapa: SevenEtapa | undefined, ahora: number | null): SevenPartido[] {
  if (!etapa || ahora == null) return [];
  return [...(etapa.grupos ?? []), ...(etapa.copas ?? [])]
    .flatMap((g) => g.partidos ?? [])
    .filter((p) => p.home && p.away && estadoDe(p, ahora) === "vivo")
    .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
}
