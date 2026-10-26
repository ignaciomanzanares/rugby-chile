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
import { readCacheEntry, writeCache } from "./arusaCache";
import { USER_AGENT } from "../config";
import { robotsAllows } from "./robots";

const LEVERADE = "https://api.leverade.com";

/** Circuito de SEVEN ARUSA Adultos 2026 (manager 532872). */
export const SEVEN_TOURNAMENT_ID = "1344636";

/** El circuito cambia de a un sábado por vez: media hora de caché sobra. */
const TTL_MS = 30 * 60_000;
// La versión de la llave sube con CADA cambio de forma del objeto. Si no, lo
// guardado se sigue sirviendo hasta que venza el TTL y los campos nuevos no
// aparecen: pasó al agregar `clasificacion`.
const CACHE_KEY = `seven:v3:${SEVEN_TOURNAMENT_ID}`;

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
  tabla: SevenFila[];
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

export function construirTabla(partidos: SevenPartido[]): SevenFila[] {
  const acc = new Map<string, Omit<SevenFila, "pos" | "team" | "diff">>();
  const tocar = (t: string) =>
    acc.get(t) ?? acc.set(t, { pj: 0, pg: 0, pe: 0, pp: 0, pf: 0, pc: 0, pts: 0 }).get(t)!;

  for (const p of partidos) {
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
  if (!force && entrada && entrada.ageMs < TTL_MS) return entrada.data;

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

  // Una ETAPA es un día de competencia. Agrupar por fecha es lo robusto: los
  // grupos de Leverade se repiten de etapa en etapa con el mismo nombre
  // ("Grupo A" aparece cuatro veces) y no hay forma fiable de saber cuál es de
  // cuál hasta que tienen partidos con día.
  const dias = [...new Set(partidos.map((p) => p.fecha).filter((f): f is string => !!f))].sort();
  const etapas: SevenEtapa[] = dias.map((fecha, i) => {
    const delDia = partidos.filter((p) => p.fecha === fecha);
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
  const sinPuntos = partidos
    .filter((p) => p.homeScore != null && p.homePts === 0 && p.awayPts === 0)
    .map((p) => ({ fecha: p.fecha, home: p.home, away: p.away }));

  // Los nombres, del endpoint que NO está en el muro. Sólo los grupos de la
  // fase inicial: los de las copas devuelven la tabla vacía.
  const idsConStats = etapas.flatMap((e) => e.grupos.map((g) => g.grupoId)).filter(Boolean);
  const jugadores = juntarJugadores(
    await Promise.all(idsConStats.map((id) => statsDeGrupo(id).catch(() => []))),
  );

  const circuito: SevenCircuito = {
    tournamentId: SEVEN_TOURNAMENT_ID,
    nombre: doc.data?.attributes?.name ?? "Circuito de Seven",
    equipos,
    tabla: construirTabla(partidos),
    etapas,
    jugadores,
    sinPuntos,
    generadoEn: new Date().toISOString(),
  };
  void writeCache(CACHE_KEY, circuito);
  return circuito;
}
