/**
 * Circuito de Seven de ARUSA, directo de Leverade.
 *
 * El seven NO es el XV con menos jugadores: es otro formato y por eso vive
 * aparte. Cada ETAPA se juega entera en un día —cuatro grupos de tres y después
 * tres copas, Oro, Plata y Bronce— y lo que define la temporada es la TABLA
 * ACUMULADA del circuito, no una fecha contra otra.
 *
 * Todo sale de la API de Leverade, que no tiene muro: resultados, los puntos de
 * liga oficiales de cada partido y hasta los logos de los clubes. Eso importa
 * porque el scrape de `/ranking/` de arusa —de donde salía la tabla del XV—
 * cayó detrás del proof-of-work y devuelve 429 (medido el 2026-10-26). Acá la
 * tabla se SUMA de los puntos que publica Leverade por partido, así que no
 * depende de que arusa nos deje entrar.
 */
import { readCache, readCacheEntry, writeCache } from "./arusaCache";
import { USER_AGENT } from "../config";
import { robotsAllows } from "./robots";

const LEVERADE = "https://api.leverade.com";

/** Circuito de SEVEN ARUSA Adultos 2026 (manager 532872). */
export const SEVEN_TOURNAMENT_ID = "1344636";

/**
 * Media hora de caché sobra ENTRE sábados. El día del torneo no: la etapa 2
 * tiene 21 partidos de 12:00 a 19:40, uno cada veinte minutos, así que servir
 * algo de hace media hora es ir toda la jornada atrasado.
 *
 * El TTL se decide con lo que YA está guardado, antes de salir a la red: si hay
 * una etapa fechada hoy a la que le quedan partidos sin terminar, se refresca
 * cada dos minutos. Fuera de eso vuelve a media hora, y queda acotado al día
 * del torneo porque la condición es la fecha de hoy.
 */
const TTL_TRANQUILO_MS = 30 * 60_000;
const TTL_EN_JUEGO_MS = 2 * 60_000;
// La versión de la llave sube con CADA cambio de forma del objeto. Si no, lo
// guardado se sigue sirviendo hasta que venza el TTL y los campos nuevos no
// aparecen: pasó al agregar `clasificacion`.
const CACHE_KEY = `seven:v6:${SEVEN_TOURNAMENT_ID}`;

export interface SevenPartido {
  id: string;
  /** ISO en hora de Chile ("2026-10-24"), o null si todavía no tiene día. */
  fecha: string | null;
  hora: string | null;
  grupo: string;
  ronda: string;
  home: string | null;
  away: string | null;
  homeScore: number | null;
  awayScore: number | null;
  /** Puntos de liga que Leverade le dio a cada lado (3+bonus / 1+bonus). */
  homePts: number | null;
  awayPts: number | null;
  finished: boolean;
}

export interface SevenCopa {
  /** "Oro" | "Plata" | "Bronce" */
  nombre: string;
  campeon: string | null;
  finalista: string | null;
  campeonScore: number | null;
  finalistaScore: number | null;
  partidos: SevenPartido[];
}

export interface SevenPuesto {
  pos: number;
  team: string;
  /** "Oro" | "Plata" | "Bronce" */
  copa: string;
  /** "Campeón" | "Finalista" | "Semifinal" */
  detalle: string;
  /** Por cuánto perdió la semifinal. Es lo que separa al 3º del 4º. */
  margen: number | null;
}

export interface SevenJugador {
  nombre: string;
  equipo: string;
  tries: number;
  puntos: number;
  amarillas: number;
  rojas: number;
  /**
   * El cuadro de ARUSA trae trece columnas, las mismas en el seven que en el
   * XV, y veníamos leyendo cuatro. Con estas, un evento derivado puede decir
   * "conversión" o "penal" en vez de "pateó 2 puntos": el dato viene en la
   * misma respuesta, no cuesta una petición más.
   */
  conversiones: number;
  penales: number;
  drops: number;
  penaltyTries: number;
}

/**
 * Un evento del partido, DERIVADO de la diferencia entre dos fotos de las
 * estadísticas acumuladas.
 *
 * Es la única vía que tenemos a los nombres en el día: el minuto a minuto de
 * arusa (`/match/*`) está detrás del proof-of-work, pero el cuadro de
 * estadísticas (`/en/ajax/table-page`) responde 200. Si entre una foto y la
 * siguiente a un jugador le aparece un try, ese try pasó en esa ventana.
 *
 * Lo que da y lo que no:
 *  - el nombre, el equipo y QUÉ hizo: sí.
 *  - a qué PARTIDO pertenece: NO por sí solo. En el XV bastaría el nombre del
 *    equipo —un club juega un partido por fecha—, pero en el seven cada club
 *    juega dos de grupo más las copas EL MISMO DÍA, así que el equipo no
 *    identifica el partido. Hay que cruzarlo con la hora programada, y eso es
 *    una atribución aproximada, no un dato. Por eso la pantalla lista los
 *    eventos del día sin adjudicarlos a un partido.
 *  - el minuto exacto: NO. Es la ventana entre fotos, y depende de cuándo el
 *    planillero lo carga, que puede ser en vivo o todo junto al final.
 */
export interface SevenEvento {
  jugador: string;
  equipo: string;
  /** "try" | "amarilla" | "roja" | "puntos" */
  tipo: string;
  cantidad: number;
  /** La ventana entre las dos fotos, en ISO. */
  desde: string;
  hasta: string;
}

export interface SevenEtapa {
  numero: number;
  fecha: string | null;
  grupos: { nombre: string; grupoId: string; partidos: SevenPartido[] }[];
  copas: SevenCopa[];
  /** Puesto 1 a 12 de la etapa. Ver clasificacionDeEtapa. */
  clasificacion: SevenPuesto[];
  jugada: boolean;
}

/**
 * Una fila de la tabla OFICIAL del circuito, la que publica ARUSA.
 *
 * No la calculamos nosotros: ARUSA la carga a mano en Leverade, en un grupo
 * aparte llamado "Tabla acumulada Circuito de Seven". Son partidos ficticios
 * 0-0 cuyo `score` lleva los puntos oficiales de cada equipo en esa etapa.
 */
export interface SevenOficial {
  pos: number;
  team: string;
  /** Puntos oficiales acumulados en el circuito. */
  pts: number;
  /** Desglose por jornada del grupo acumulado, en el orden en que viene. */
  porJornada: { ronda: string; fecha: string | null; pts: number }[];
}

export interface SevenFila {
  pos: number;
  team: string;
  pj: number; pg: number; pe: number; pp: number;
  pf: number; pc: number; diff: number; pts: number;
}

export interface SevenCircuito {
  tournamentId: string;
  nombre: string;
  equipos: { name: string; logo: string | null }[];
  /**
   * Nuestra cuenta del rendimiento en cancha: jugados, ganados, puntos a favor
   * y en contra. El `pts` de acá es la suma de los puntos de liga que Leverade
   * publica por partido y NO es la tabla del circuito — ver `oficial`.
   */
  tabla: SevenFila[];
  /** La tabla del circuito según ARUSA. Vacía si todavía no la cargó. */
  oficial: SevenOficial[];
  etapas: SevenEtapa[];
  /**
   * Quién anotó. Sale de `/en/ajax/table-page`, el endpoint de estadísticas de
   * arusa, que NO está detrás del proof-of-work: responde 200 con nuestro
   * User-Agent honesto. Es la única vía legítima que tenemos a los nombres.
   *
   * Cubre sólo la FASE DE GRUPOS: ARUSA no carga estadísticas de jugador en los
   * grupos de las copas (medido: devuelven la tabla vacía). Comprobado que lo
   * que sí carga está completo — los 456 puntos de los 12 partidos de grupos de
   * la etapa 1 cuadran exactos con la suma por jugador.
   */
  jugadores: SevenJugador[];
  /**
   * Lo que pasó desde la foto anterior, más reciente primero. Ver SevenEvento:
   * sale de los deltas de `jugadores`, no del muro.
   */
  eventos: SevenEvento[];
  /** Partidos cuyos puntos de liga Leverade dejó en 0 para AMBOS lados. */
  sinPuntos: { fecha: string | null; home: string | null; away: string | null }[];
  generadoEn: string;
}

const ARUSA_AJAX = "https://arusa.cl/en/ajax";

/** Una página del cuadro de estadísticas de un grupo. HTML dentro de un JSON. */
async function statsDeGrupo(grupoId: string): Promise<SevenJugador[]> {
  const qs = new URLSearchParams({
    input: "1", type: "11", id: grupoId, rows: "50", actual: "1", column: "jugador.asc",
  });
  let json: any;
  try {
    const res = await fetch(`${ARUSA_AJAX}/table-page?${qs}`, {
      headers: {
        "Accept-Language": "en",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    json = await res.json();
  } catch {
    return [];
  }
  const html: string = json?.code === 0 ? (json.content ?? "") : "";
  if (!html) return [];

  const sinTags = (x: string) =>
    x.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const cabeceras = [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)]
    .map((m) => sinTags(m[1])).filter(Boolean);
  const num = (v: string | undefined) => {
    const n = Number((v ?? "").replace(/[^\d-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const out: SevenJugador[] = [];
  for (const fila of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const celdas = [...fila[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map((m) => sinTags(m[1]).replace(/^Look\s+/, ""));
    // La primera celda es el número de orden, así que la columna N del
    // encabezado cae en la celda N+1.
    if (celdas.length < cabeceras.length) continue;
    const val = (col: string) => {
      const i = cabeceras.indexOf(col);
      return i < 0 ? "" : celdas[i + 1];
    };
    const nombre = celdas[1];
    const equipo = celdas[2];
    if (!nombre || !equipo) continue;
    out.push({
      nombre, equipo,
      tries: num(val("T")),
      puntos: num(val("TP")),
      amarillas: num(val("YC")),
      rojas: num(val("RC")),
      // Columnas exactas del cuadro: C conversiones, P penales, D drops,
      // PT penalty tries. Se buscan por nombre exacto, así que "T" no colisiona
      // con "TP" ni "PT" (verificado contra una fila real: 1 try × 5 = TP 5).
      conversiones: num(val("C")),
      penales: num(val("P")),
      drops: num(val("D")),
      penaltyTries: num(val("PT")),
    });
  }
  return out;
}

/** Suma los jugadores de varios grupos: un mismo jugador aparece en el suyo. */
export function juntarJugadores(listas: SevenJugador[][]): SevenJugador[] {
  const acc = new Map<string, SevenJugador>();
  for (const lista of listas) {
    for (const j of lista) {
      const k = `${j.nombre}|${j.equipo}`;
      const a = acc.get(k);
      if (!a) { acc.set(k, { ...j }); continue; }
      a.tries += j.tries; a.puntos += j.puntos;
      a.amarillas += j.amarillas; a.rojas += j.rojas;
      a.conversiones += j.conversiones; a.penales += j.penales;
      a.drops += j.drops; a.penaltyTries += j.penaltyTries;
    }
  }
  return [...acc.values()]
    .filter((j) => j.tries > 0 || j.puntos > 0 || j.amarillas > 0 || j.rojas > 0)
    .sort((a, b) => b.tries - a.tries || b.puntos - a.puntos || a.nombre.localeCompare(b.nombre));
}

async function leverade(path: string): Promise<any> {
  const url = `${LEVERADE}${path}`;
  if (!(await robotsAllows(url))) throw new Error(`Leverade ${path} → robots.txt`);
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.api+json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Leverade ${path} → ${res.status}`);
  return res.json();
}

/** "Semifinales Oro" / "PlayOFF Oro" → "Oro". null si el grupo no es una copa. */
export function copaDe(grupo: string): string | null {
  const m = /\b(oro|plata|bronce)\b/i.exec(grupo);
  if (!m) return null;
  return m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
}

/** El horario de Leverade viene en UTC; acá se juega en Chile (UTC-3). */
function aChile(datetime: string | null): { fecha: string | null; hora: string | null } {
  if (!datetime) return { fecha: null, hora: null };
  const t = Date.parse(datetime.replace(" ", "T") + "Z");
  if (!Number.isFinite(t)) return { fecha: null, hora: null };
  const d = new Date(t - 3 * 60 * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    fecha: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    hora: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  };
}

/**
 * El puesto 1 a 12 de una etapa.
 *
 * En un circuito de seven esto es la moneda real, más que cualquier suma de
 * puntos: la Copa de Oro reparte los puestos 1 a 4, la de Plata del 5 al 8 y
 * la de Bronce del 9 al 12.
 *
 * El desempate entre los dos semifinalistas de cada copa es el MARGEN de su
 * derrota, no la diferencia general del día. Importa la distinción: el 24-oct
 * COBS y Old Reds terminaron los dos en +31, así que la diferencia no los
 * separaba — lo que puso a COBS 3º y a Old Reds 4º fue perder por 5 en vez de
 * por 6.
 *
 * Es el criterio que reproduce lo que publicó ARUSA, pero ARUSA no publica la
 * regla: su tabla del circuito está detrás del muro y el grupo que la guardaría
 * en Leverade está vacío. Por eso la pantalla dice de dónde sale el orden.
 */
export function clasificacionDeEtapa(copas: SevenCopa[]): SevenPuesto[] {
  const out: SevenPuesto[] = [];
  for (const nombre of ["Oro", "Plata", "Bronce"]) {
    const copa = copas.find((c) => c.nombre === nombre);
    if (!copa) continue;
    if (copa.campeon) out.push({ pos: 0, team: copa.campeon, copa: nombre, detalle: "Campeón", margen: null });
    if (copa.finalista) out.push({ pos: 0, team: copa.finalista, copa: nombre, detalle: "Finalista", margen: null });

    const perdedores: { team: string; margen: number }[] = [];
    for (const p of copa.partidos) {
      if (!/semi/i.test(p.ronda)) continue;
      if (p.homeScore == null || p.awayScore == null || !p.home || !p.away) continue;
      const [team, margen] = p.homeScore < p.awayScore
        ? [p.home, p.awayScore - p.homeScore]
        : [p.away, p.homeScore - p.awayScore];
      perdedores.push({ team, margen });
    }
    for (const l of perdedores.sort((a, b) => a.margen - b.margen)) {
      out.push({ pos: 0, team: l.team, copa: nombre, detalle: "Semifinal", margen: l.margen });
    }
  }
  return out.map((p, i) => ({ ...p, pos: i + 1 }));
}

/**
 * El grupo donde ARUSA guarda su tabla oficial del circuito.
 *
 * No es un grupo de verdad: son seis partidos ficticios por jornada, todos
 * 0-0 y fechados a la misma hora, cuyo `score` lleva los puntos oficiales de
 * cada equipo. Hay que apartarlos de los partidos reales por las dos puntas
 * —no son resultados y no van en la cuenta de jugados— y leerlos aparte, que
 * es lo único que nos da la tabla del circuito sin pasar por el muro.
 */
export function esAcumulada(grupo: string): boolean {
  return /tabla\s+acumulada/i.test(grupo);
}

/**
 * La tabla oficial del circuito, leída del grupo acumulado.
 *
 * Comprobada contra nuestra `clasificacionDeEtapa` del 24-oct: los doce
 * puestos coinciden uno a uno, incluido el desempate por margen de semifinal
 * que pone a COBS 3º y a Old Reds 4º.
 */
export function tablaOficial(partidos: SevenPartido[]): SevenOficial[] {
  const acc = new Map<string, { pts: number; porJornada: SevenOficial["porJornada"] }>();
  for (const p of partidos) {
    if (!esAcumulada(p.grupo)) continue;
    for (const [team, pts] of [[p.home, p.homePts], [p.away, p.awayPts]] as const) {
      // Las jornadas que ARUSA todavía no cargó vienen sin equipos ni puntos.
      if (!team || pts == null) continue;
      const f = acc.get(team) ?? acc.set(team, { pts: 0, porJornada: [] }).get(team)!;
      f.pts += pts;
      f.porJornada.push({ ronda: p.ronda, fecha: p.fecha, pts });
    }
  }
  return [...acc.entries()]
    .map(([team, f]) => ({ team, pts: f.pts, porJornada: f.porJornada }))
    .sort((a, b) => b.pts - a.pts || a.team.localeCompare(b.team))
    .map((f, i) => ({ pos: i + 1, ...f }));
}

/** Cuántos eventos se guardan. Una etapa son 21 partidos: 300 sobra de lejos. */
const MAX_EVENTOS = 300;
/** Donde vive la foto anterior y la lista de eventos ya derivados. */
const EVENTOS_KEY = `seven:eventos:v2:${SEVEN_TOURNAMENT_ID}`;

interface Bitacora {
  /** La última foto de las estadísticas. */
  foto: SevenJugador[];
  tomadoEn: string;
  eventos: SevenEvento[];
}

/** La llave de un jugador. El nombre solo no basta: puede repetirse entre clubes. */
function claveJugador(j: { nombre: string; equipo: string }): string {
  return `${j.nombre}|${j.equipo}`;
}

/**
 * Completa los contadores que falten.
 *
 * Una foto guardada ANTES de que existieran `conversiones`, `penales`, `drops`
 * y `penaltyTries` los trae en `undefined`, y `Math.max(undefined, 0)` es NaN:
 * de ahí en adelante todos los deltas de ese jugador son NaN y no se emite ni
 * se descarta nada, en silencio. La llave del caché sube con cada cambio de
 * forma, así que no debería pasar — pero una foto malformada no puede costar
 * los nombres de toda una jornada.
 */
export function normalizarFoto(foto: SevenJugador[]): SevenJugador[] {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return (foto ?? []).map((j) => ({
    nombre: j?.nombre ?? "",
    equipo: j?.equipo ?? "",
    tries: n(j?.tries),
    puntos: n(j?.puntos),
    amarillas: n(j?.amarillas),
    rojas: n(j?.rojas),
    conversiones: n(j?.conversiones),
    penales: n(j?.penales),
    drops: n(j?.drops),
    penaltyTries: n(j?.penaltyTries),
  }));
}

/** Un jugador sin nada, para tratar a un debutante como un delta desde cero. */
const CERO: SevenJugador = {
  nombre: "", equipo: "", tries: 0, puntos: 0, amarillas: 0, rojas: 0,
  conversiones: 0, penales: 0, drops: 0, penaltyTries: 0,
};

/** Cuánto subió cada contador, con el nombre que se le muestra a la gente. */
const DELTAS = (a: SevenJugador, b: SevenJugador) => [
  ["try", b.tries - a.tries],
  ["try penal", b.penaltyTries - a.penaltyTries],
  ["conversión", b.conversiones - a.conversiones],
  ["penal", b.penales - a.penales],
  ["drop", b.drops - a.drops],
  ["amarilla", b.amarillas - a.amarillas],
  ["roja", b.rojas - a.rojas],
] as const;

/**
 * Cuántos de los puntos nuevos explican los contadores. Try y try penal 5,
 * conversión 2, penal y drop 3: el mismo valor en seven que en XV.
 */
function PUNTOS_EXPLICADOS(a: SevenJugador, b: SevenJugador): number {
  const d = (x: keyof SevenJugador) => Math.max(0, (b[x] as number) - (a[x] as number));
  return d("tries") * 5 + d("penaltyTries") * 5 + d("conversiones") * 2 +
    d("penales") * 3 + d("drops") * 3;
}

/**
 * Qué cambió entre dos fotos de las estadísticas.
 *
 * Solo mira hacia ARRIBA. Un contador que BAJA no es un evento negativo: es una
 * planilla corregida, o el cuadro que vino incompleto. Inventar un "-1 try" por
 * eso sería peor que no decir nada. Por el mismo motivo el que llama tiene que
 * descartar una foto vacía antes de pasarla acá (ver fotoUsable).
 */
export function derivarEventos(
  antes: SevenJugador[],
  ahora: SevenJugador[],
  desde: string,
  hasta: string,
): SevenEvento[] {
  const previo = new Map(antes.map((j) => [claveJugador(j), j]));
  const out: SevenEvento[] = [];
  for (const j of ahora) {
    const a = previo.get(claveJugador(j));
    // Un jugador que aparece por primera vez trae su acumulado entero. En la
    // primera foto del circuito eso serían 60 "eventos" falsos, así que la
    // primera vez no se deriva nada (ver fetchSeven) y de ahí en adelante un
    // debutante sí es alguien que acaba de anotar.
    if (!a) {
      for (const [tipo, n] of DELTAS(CERO, j)) {
        if (n > 0) out.push({ jugador: j.nombre, equipo: j.equipo, tipo, cantidad: n, desde, hasta });
      }
      continue;
    }
    for (const [tipo, n] of DELTAS(a, j)) {
      if (n > 0) out.push({ jugador: j.nombre, equipo: j.equipo, tipo, cantidad: n, desde, hasta });
    }
    // Lo que los contadores no explican. Antes acá caían las conversiones y los
    // penales enteros, porque el cuadro parecía no separarlos; sí los separa
    // (columnas C, P, D, PT) y ahora salen con su nombre arriba. Este resto
    // queda igual, para no PERDER puntos si ARUSA carga TP sin desglosar.
    const dp = j.puntos - a.puntos;
    const explicado = PUNTOS_EXPLICADOS(a, j);
    if (dp > explicado) {
      out.push({
        jugador: j.nombre, equipo: j.equipo, tipo: "puntos",
        cantidad: dp - explicado, desde, hasta,
      });
    }
  }
  return out;
}

/**
 * La foto nueva encima de la anterior, quedándose con el valor más alto.
 *
 * El cuadro se pide POR GRUPO —cuatro de cada etapa— y cada pedido falla por su
 * cuenta devolviendo []. Así que una foto puede venir INCOMPLETA en vez de
 * vacía, y `fotoUsable` sólo mira el caso vacío. Si se guardara tal cual, los
 * jugadores del grupo caído desaparecerían de la referencia y al volver el
 * grupo reaparecerían como DEBUTANTES: a un debutante se le emite su acumulado
 * entero, así que medio circuito habría "anotado" de golpe en mitad del
 * torneo. Está reproducido en sevenEventos.test.ts.
 *
 * Fusionar lo evita de raíz: nadie sale de la foto, así que nadie reaparece. Y
 * quedarse con el máximo es coherente con el resto —sólo se mira hacia arriba,
 * una planilla corregida hacia abajo no es un evento—.
 */
export function fusionarFotos(previa: SevenJugador[], nueva: SevenJugador[]): SevenJugador[] {
  const out = new Map(previa.map((j) => [claveJugador(j), j]));
  for (const j of nueva) {
    const a = out.get(claveJugador(j));
    out.set(claveJugador(j), a == null ? j : {
      nombre: j.nombre,
      equipo: j.equipo,
      tries: Math.max(a.tries, j.tries),
      puntos: Math.max(a.puntos, j.puntos),
      amarillas: Math.max(a.amarillas, j.amarillas),
      rojas: Math.max(a.rojas, j.rojas),
      conversiones: Math.max(a.conversiones, j.conversiones),
      penales: Math.max(a.penales, j.penales),
      drops: Math.max(a.drops, j.drops),
      penaltyTries: Math.max(a.penaltyTries, j.penaltyTries),
    });
  }
  return [...out.values()];
}

/**
 * ¿Sirve esta foto para comparar?
 *
 * El cuadro de estadísticas devuelve [] ante cualquier problema (los catch de
 * statsDeGrupo). Guardar ese [] como foto borraría la referencia y la siguiente
 * lectura inventaría un evento por cada jugador del circuito.
 */
export function fotoUsable(foto: SevenJugador[], previa: SevenJugador[]): boolean {
  if (foto.length > 0) return true;
  return previa.length === 0;
}

/** Hoy en Chile (UTC-3), como "2026-11-07". */
export function hoyEnChile(ahoraMs = Date.now()): string {
  const d = new Date(ahoraMs - 3 * 60 * 60_000);
  return d.toISOString().slice(0, 10);
}

/** Cuánto vale lo guardado. Ver TTL_EN_JUEGO_MS. */
export function ttlPara(data: SevenCircuito | null | undefined, hoy = hoyEnChile()): number {
  const etapa = (data?.etapas ?? []).find((e) => e.fecha === hoy);
  if (!etapa) return TTL_TRANQUILO_MS;
  return etapa.jugada ? TTL_TRANQUILO_MS : TTL_EN_JUEGO_MS;
}

export function construirTabla(partidos: SevenPartido[]): SevenFila[] {
  const acc = new Map<string, Omit<SevenFila, "pos" | "team" | "diff">>();
  const tocar = (t: string) =>
    acc.get(t) ?? acc.set(t, { pj: 0, pg: 0, pe: 0, pp: 0, pf: 0, pc: 0, pts: 0 }).get(t)!;

  for (const p of partidos) {
    if (esAcumulada(p.grupo)) continue;
    if (!p.home || !p.away || p.homeScore == null || p.awayScore == null) continue;
    for (const [yo, mio, suyo, pts] of [
      [p.home, p.homeScore, p.awayScore, p.homePts],
      [p.away, p.awayScore, p.homeScore, p.awayPts],
    ] as const) {
      const f = tocar(yo);
      f.pj += 1;
      f.pf += mio;
      f.pc += suyo;
      f.pts += pts ?? 0;
      if (mio > suyo) f.pg += 1;
      else if (mio < suyo) f.pp += 1;
      else f.pe += 1;
    }
  }

  return [...acc.entries()]
    .map(([team, f]) => ({ team, ...f, diff: f.pf - f.pc }))
    .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.pf - a.pf || a.team.localeCompare(b.team))
    .map((f, i) => ({ pos: i + 1, ...f }));
}

export async function fetchSeven(force = false): Promise<SevenCircuito | null> {
  const entrada = await readCacheEntry<SevenCircuito>(CACHE_KEY);
  if (!force && entrada && entrada.ageMs < ttlPara(entrada.data)) return entrada.data;

  let doc: any;
  try {
    doc = await leverade(
      `/tournaments/${SEVEN_TOURNAMENT_ID}?include=groups.rounds.matches.results,teams.club`,
    );
  } catch {
    // Mejor lo guardado que nada: el circuito no cambia entre sábados.
    return entrada?.data ?? null;
  }

  const inc: any[] = doc.included ?? [];
  const nombreEquipo = new Map<string, string>();
  const clubDeEquipo = new Map<string, string>();
  for (const t of inc) {
    if (t.type !== "team") continue;
    nombreEquipo.set(String(t.id), t.attributes?.name ?? "");
    const c = t.relationships?.club?.data?.id;
    if (c) clubDeEquipo.set(String(t.id), String(c));
  }
  const logoDeClub = new Map<string, string>();
  for (const c of inc) {
    if (c.type !== "club") continue;
    const img = c.links?.images?.image;
    if (img?.medium) logoDeClub.set(String(c.id), img.medium);
  }

  const nombreGrupo = new Map<string, string>();
  for (const g of inc) if (g.type === "group") nombreGrupo.set(String(g.id), g.attributes?.name ?? "");
  const grupoDeRonda = new Map<string, string>();
  const nombreRonda = new Map<string, string>();
  for (const r of inc) {
    if (r.type !== "round") continue;
    nombreRonda.set(String(r.id), r.attributes?.name ?? "");
    const g = r.relationships?.group?.data?.id;
    if (g) grupoDeRonda.set(String(r.id), String(g));
  }

  // value = marcador; score = puntos de liga. Las filas con período son los
  // parciales por tiempo y no cuentan (ver parseFullTimeScore en computeH2H).
  const porPartido = new Map<string, Map<string, { v: number | null; s: number | null }>>();
  for (const r of inc) {
    if (r.type !== "result" || r.relationships?.period?.data) continue;
    const mid = String(r.relationships?.match?.data?.id ?? "");
    const tid = String(r.relationships?.team?.data?.id ?? "");
    if (!mid || !tid) continue;
    const m = porPartido.get(mid) ?? porPartido.set(mid, new Map()).get(mid)!;
    const v = r.attributes?.value;
    const s = r.attributes?.score;
    m.set(tid, { v: v == null ? null : Number(v), s: s == null ? null : Number(s) });
  }

  const idDeGrupoPorNombre = new Map<string, string>();
  const partidos: SevenPartido[] = [];
  for (const m of inc) {
    if (m.type !== "match") continue;
    const rid = String(m.relationships?.round?.data?.id ?? "");
    const gid = grupoDeRonda.get(rid) ?? "";
    const homeId = String(m.meta?.home_team ?? "");
    const awayId = String(m.meta?.away_team ?? "");
    const sc = porPartido.get(String(m.id)) ?? new Map();
    const { fecha, hora } = aChile(m.attributes?.datetime ?? null);
    const nomGrupo = nombreGrupo.get(gid) ?? "";
    if (fecha && nomGrupo) idDeGrupoPorNombre.set(`${fecha}|${nomGrupo}`, gid);
    partidos.push({
      id: String(m.id),
      fecha, hora,
      grupo: nombreGrupo.get(gid) ?? "",
      ronda: nombreRonda.get(rid) ?? "",
      home: nombreEquipo.get(homeId) ?? null,
      away: nombreEquipo.get(awayId) ?? null,
      homeScore: sc.get(homeId)?.v ?? null,
      awayScore: sc.get(awayId)?.v ?? null,
      homePts: sc.get(homeId)?.s ?? null,
      awayPts: sc.get(awayId)?.s ?? null,
      finished: Boolean(m.attributes?.finished),
    });
  }

  // Los partidos de verdad. El grupo de la tabla acumulada queda afuera de todo
  // lo que se parezca a un resultado: sus seis 0-0 fechados a las 12:00 del
  // 24-oct entraban a la etapa 1 como un grupo más, le sumaban un jugado y un
  // empate a los doce equipos y duplicaban los puntos —la tabla mostraba 37
  // para Old Boys: nuestros 15 más los 22 oficiales.
  const reales = partidos.filter((p) => !esAcumulada(p.grupo));

  // Una ETAPA es un día de competencia. Agrupar por fecha es lo robusto: los
  // grupos de Leverade se repiten de etapa en etapa con el mismo nombre
  // ("Grupo A" aparece cuatro veces) y no hay forma fiable de saber cuál es de
  // cuál hasta que tienen partidos con día.
  const dias = [...new Set(reales.map((p) => p.fecha).filter((f): f is string => !!f))].sort();
  const etapas: SevenEtapa[] = dias.map((fecha, i) => {
    const delDia = reales.filter((p) => p.fecha === fecha);
    const grupos = [...new Set(delDia.filter((p) => !copaDe(p.grupo)).map((p) => p.grupo))]
      .sort()
      .map((nombre) => ({
        nombre,
        grupoId: idDeGrupoPorNombre.get(`${fecha}|${nombre}`) ?? "",
        partidos: delDia.filter((p) => p.grupo === nombre).sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? "")),
      }));
    const copas: SevenCopa[] = ["Oro", "Plata", "Bronce"].flatMap((nombre) => {
      const suyos = delDia.filter((p) => copaDe(p.grupo) === nombre)
        .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
      if (suyos.length === 0) return [];
      const fin = suyos.find((p) => /final/i.test(p.ronda) && !/semi/i.test(p.ronda));
      const gana = fin && fin.homeScore != null && fin.awayScore != null
        ? (fin.homeScore > fin.awayScore ? "home" : "away") : null;
      return [{
        nombre,
        campeon: gana ? (gana === "home" ? fin!.home : fin!.away) : null,
        finalista: gana ? (gana === "home" ? fin!.away : fin!.home) : null,
        campeonScore: gana ? (gana === "home" ? fin!.homeScore : fin!.awayScore) : null,
        finalistaScore: gana ? (gana === "home" ? fin!.awayScore : fin!.homeScore) : null,
        partidos: suyos,
      }];
    });
    return {
      numero: i + 1, fecha, grupos, copas,
      clasificacion: clasificacionDeEtapa(copas),
      jugada: delDia.every((p) => p.finished),
    };
  });

  const equipos = [...nombreEquipo.entries()]
    .map(([id, name]) => ({ name, logo: logoDeClub.get(clubDeEquipo.get(id) ?? "") ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Un partido jugado con 0 puntos para los DOS lados no es un empate sin bonus:
  // es que ARUSA no se los asignó. Pasó el 24-oct con UC-Old Georgians. Se
  // informa en vez de esconderlo, porque la tabla queda corta y se nota.
  const sinPuntos = reales
    .filter((p) => p.homeScore != null && p.homePts === 0 && p.awayPts === 0)
    .map((p) => ({ fecha: p.fecha, home: p.home, away: p.away }));

  // Los nombres, del endpoint que NO está en el muro. Sólo los grupos de la
  // fase inicial: los de las copas devuelven la tabla vacía.
  const idsConStats = etapas.flatMap((e) => e.grupos.map((g) => g.grupoId)).filter(Boolean);
  const jugadores = juntarJugadores(
    await Promise.all(idsConStats.map((id) => statsDeGrupo(id).catch(() => []))),
  );

  // La bitácora: cada refresco es una foto, y de la diferencia con la anterior
  // salen los eventos con nombre. El día del torneo el TTL baja a dos minutos,
  // así que las ventanas son de dos minutos sin pedirle nada extra a nadie.
  let eventos: SevenEvento[] = [];
  try {
    const guardada = (await readCache<Bitacora>(EVENTOS_KEY)) ?? null;
    const previa = normalizarFoto(guardada?.foto ?? []);
    const ahoraISO = new Date().toISOString();
    if (fotoUsable(jugadores, previa)) {
      // La PRIMERA foto no deriva nada: todo el acumulado del circuito se
      // leería como si acabara de pasar.
      const nuevos = guardada
        ? derivarEventos(previa, jugadores, guardada.tomadoEn, ahoraISO)
        : [];
      eventos = [...nuevos, ...(guardada?.eventos ?? [])].slice(0, MAX_EVENTOS);
      void writeCache(EVENTOS_KEY, {
        foto: fusionarFotos(previa, jugadores),
        tomadoEn: ahoraISO,
        eventos,
      });
    } else {
      // Foto inservible: se conserva la anterior como referencia.
      eventos = guardada?.eventos ?? [];
    }
  } catch { /* la bitácora es un extra: nunca puede voltear el circuito */ }

  const circuito: SevenCircuito = {
    tournamentId: SEVEN_TOURNAMENT_ID,
    nombre: doc.data?.attributes?.name ?? "Circuito de Seven",
    equipos,
    tabla: construirTabla(reales),
    oficial: tablaOficial(partidos),
    etapas,
    jugadores,
    eventos,
    sinPuntos,
    generadoEn: new Date().toISOString(),
  };
  void writeCache(CACHE_KEY, circuito);
  return circuito;
}
