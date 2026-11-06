/**
 * Los dos avisos del día de torneo: cuando arranca la etapa y cuando cierra.
 *
 * Por qué sólo dos. El seven no se parece al XV: en una etapa se juegan 21
 * partidos en un día, así que un aviso por partido sería spam. Y no se puede
 * avisar por anotación: los nombres salen de comparar dos fotos de las
 * estadísticas (ver `derivarEventos`), que es bueno para una bitácora pero no
 * para un push —llegan en tandas, con minutos de atraso y sin partido—.
 *
 * Los otros tres lugares que mandan push (el planillero en vivo, las finales,
 * el broadcast a mano) están atados al XV y a sus tres categorías. El seven es
 * una competencia aparte: no es Primera ni Intermedia ni Pre, así que no se
 * filtra por categoría y va a todas las suscripciones.
 *
 * La decisión vive en `decidirAvisos`, que es pura y se prueba sin red: recibe
 * el circuito, lo ya avisado y la hora.
 */
import { readCache, writeCache } from "../lib/arusaCache";
import { sendPushToAll, pushEnabled, type PushPayload } from "./push";
import { hoyEnChile, type SevenCircuito, type SevenEtapa } from "../lib/seven";

/** Qué etapas ya se avisaron, por fecha. La llave guarda esto. */
export interface AvisosGuardados {
  inicio: string[];
  cierre: string[];
}

const KEY = (torneo: string) => `seven:avisos:v1:${torneo}`;

/**
 * El instante real de un `fecha` + `hora` del circuito. Las horas que publica
 * la app ya están en hora de Chile (ver `aChile`), así que para volver a un
 * instante hay que sumar las tres horas que se le restaron.
 */
function instante(fecha: string, hora: string): number {
  return Date.parse(`${fecha}T${hora}:00Z`) + 3 * 60 * 60_000;
}

/** Todos los partidos del día: los de grupo y los de las copas. */
function partidosDe(etapa: SevenEtapa) {
  return [...etapa.grupos.flatMap((g) => g.partidos), ...etapa.copas.flatMap((c) => c.partidos)];
}

function cuerpoDelCierre(etapa: SevenEtapa): string {
  const oro = etapa.copas.find((c) => c.nombre === "Oro");
  if (!oro?.campeon) return "Ya están los resultados y la clasificación del día.";
  const { campeon, finalista, campeonScore, finalistaScore } = oro;
  const marcador =
    finalista && campeonScore != null && finalistaScore != null
      ? `, ${campeonScore}-${finalistaScore} a ${finalista}`
      : "";
  return `${campeon} se llevó la Copa de Oro${marcador}.`;
}

/**
 * Qué avisos corresponden ahora. Devuelve también lo que hay que guardar, para
 * que el llamador lo escriba ANTES de mandar: si el envío falla a mitad de
 * camino preferimos no avisar a avisar dos veces.
 */
export function decidirAvisos(
  circuito: SevenCircuito,
  guardado: AvisosGuardados,
  ahoraMs = Date.now(),
): { avisos: PushPayload[]; guardar: AvisosGuardados } {
  const guardar: AvisosGuardados = { inicio: [...guardado.inicio], cierre: [...guardado.cierre] };
  const hoy = hoyEnChile(ahoraMs);
  const etapa = circuito.etapas.find((e) => e.fecha === hoy);
  if (!etapa?.fecha) return { avisos: [], guardar: guardado };
  const fecha = etapa.fecha;
  const avisos: PushPayload[] = [];

  if (!guardar.inicio.includes(fecha)) {
    if (etapa.jugada) {
      // La etapa ya terminó y nunca avisamos el arranque: el servidor estuvo
      // caído o recién se enteró. Avisar "arrancó" ahora sería mentir, y
      // mandarlo pegado al cierre, peor. Se marca como avisado y se calla.
      guardar.inicio.push(fecha);
    } else {
      const horas = partidosDe(etapa)
        .map((p) => p.hora)
        .filter((h): h is string => !!h)
        .sort();
      // Sin horario no hay cómo saber si arrancó: mejor no avisar que avisar
      // a medianoche, cuando la etapa ya figura "de hoy" pero falta todo.
      if (horas[0] && ahoraMs >= instante(fecha, horas[0])) {
        avisos.push({
          title: `🏉 Seven · Arrancó la Etapa ${etapa.numero}`,
          body: "Cuatro grupos y después las copas. Los marcadores se actualizan solos.",
          url: "/seven",
          tag: `seven-inicio-${fecha}`,
        });
        guardar.inicio.push(fecha);
      }
    }
  }

  if (etapa.jugada && !guardar.cierre.includes(fecha)) {
    avisos.push({
      title: `🏉 Seven · Terminó la Etapa ${etapa.numero}`,
      body: cuerpoDelCierre(etapa),
      url: "/seven",
      tag: `seven-cierre-${fecha}`,
    });
    guardar.cierre.push(fecha);
  }

  return { avisos, guardar };
}

/** Lo de arriba, contra el caché y las suscripciones de verdad. */
export async function avisarDelSeven(circuito: SevenCircuito | null | undefined): Promise<void> {
  if (!circuito || !pushEnabled) return;
  const key = KEY(circuito.tournamentId);
  const guardado = (await readCache<AvisosGuardados>(key)) ?? { inicio: [], cierre: [] };
  const { avisos, guardar } = decidirAvisos(circuito, guardado);
  if (avisos.length === 0) return;
  await writeCache(key, guardar);
  for (const aviso of avisos) {
    const r = await sendPushToAll(aviso);
    console.log(`[sevenPush] "${aviso.title}" → ${r.sent}/${r.total} (${r.pruned} vencidas)`);
  }
}
