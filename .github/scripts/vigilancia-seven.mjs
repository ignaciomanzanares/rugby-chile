// Vigilancia de una etapa del circuito de seven, para correr sola en Actions.
//
// Hermana de vigilancia-fecha18.mjs, pero aparte y no parametrizando aquélla:
// el XV se vigila contra /live y /live/finished, con claves por división y
// playoff y rondas numeradas "Fecha N". El seven no tiene nada de eso —se
// vigila contra /seven, su etapa se identifica por la FECHA y sus grupos se
// repiten de etapa en etapa con el mismo nombre—. Meter las dos formas en un
// script habría sido peor que tener dos.
//
// Una ventaja que el XV no tiene: el `id` de cada partido en nuestro payload ES
// el matchId de Leverade, así que el cruce es exacto y no hay que adivinar por
// nombres de equipo.
//
// Vigila cuatro cosas, muestreando cada 2 minutos:
//
//  1. EL CACHÉ CONGELADO. Es la falla que arruinaría el día sin que se note: el
//     TTL baja a 2 min cuando hay una etapa fechada hoy sin terminar, pero si
//     esa condición no se cumple (etapa mal fechada, `jugada` mal calculado) el
//     caché vuelve a media hora y la página va atrasada toda la jornada con los
//     datos "bien". Se mira `generadoEn`.
//  2. LOS MARCADORES. Leverade contra lo que muestra /seven.
//  3. LA BITÁCORA DE EVENTOS. Es el experimento del día: los nombres salen de
//     la diferencia entre dos fotos del cuadro de estadísticas, y eso sólo
//     funciona si el planillero carga DURANTE el torneo. Acá se mide: cuándo
//     llegó el primer evento de cada partido y cuánto después del primer punto.
//     Si al final del día no llegó ninguno, los planilleros cargan al final y
//     hay que decirlo en vez de suponerlo.
//  4. EL ARRANQUE. Las filas `result` de Leverade existen con `value: null`
//     antes del partido y pasan a 0 cuando se abre la planilla.
//
// Sin base de datos, sin secretos y sin tocar arusa: sólo la API pública de
// Leverade y la nuestra.
//
//   MINUTOS=300 node .github/scripts/vigilancia-seven.mjs
//   FECHA=2026-11-07 MINUTOS=1 node .github/scripts/vigilancia-seven.mjs   # ensayo
import { appendFileSync } from "node:fs";

const API = process.env.API ?? "https://rugby-chile-api.onrender.com/api/v1";
const TORNEO = "1344636";

// FECHA=auto (por defecto) = la etapa que se juega HOY en Chile. Se puede fijar
// para ensayar contra una etapa concreta sin esperar al sábado.
const FECHA_PEDIDA = process.env.FECHA ?? "auto";
const MINUTOS = Number(process.env.MINUTOS ?? 300);
const CADA_MS = Number(process.env.CADA_MS ?? 120_000);
// Cuánto se tolera un desacuerdo antes de que sea alerta. El caché del circuito
// dura 2 min el día del torneo, así que un ciclo de atraso es normal.
const TOLERANCIA_MS = Number(process.env.TOLERANCIA_MS ?? 6 * 60_000);
// Cuánto puede tener el payload antes de considerar el caché congelado. Con TTL
// de 2 min y muestreo de 2 min, 12 ya es que algo no está aplicando.
const EDAD_MAXIMA_MS = Number(process.env.EDAD_MAXIMA_MS ?? 12 * 60_000);
const CAIDAS_PARA_ALERTAR = 3;
let caidas = 0;

const enChile = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(d);
const hora = (d = new Date()) =>
  d.toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour12: false });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const diario = [];
const anotar = (linea) => {
  const l = `[${hora()}] ${linea}`;
  console.log(l);
  diario.push(l);
};

const alertas = [];
const alertar = (linea) => {
  anotar(`⚠️  ${linea}`);
  alertas.push(`${hora()} · ${linea}`);
};

/**
 * Un desacuerdo puntual es normal; sólo es noticia si se SOSTIENE. Se avisa una
 * vez por partido para no llenar el correo con la misma falla.
 */
function marcarDesfase(e, etiqueta, mal, describir) {
  if (!mal) { e.desfaseDesde = null; return; }
  if (!e.desfaseDesde) { e.desfaseDesde = Date.now(); return; }
  if (Date.now() - e.desfaseDesde > TOLERANCIA_MS && !e.avisado) {
    e.avisado = true;
    alertar(`${etiqueta}: ${describir()} (hace más de ${TOLERANCIA_MS / 60_000} min)`);
  }
}

/**
 * Los logs de Actions sólo se leen cuando el job TERMINA, así que un problema a
 * mitad de ventana se sabría horas después. Al primer desfase sostenido se
 * cierra el informe y se corta: el correo de GitHub llega en minutos, que es
 * cuando todavía se puede hacer algo.
 */
function cortarSiHayAlerta() {
  if (!alertas.length) return;
  console.log("\nCorto acá para que el aviso salga ahora y no al final de la ventana.");
  informar();
  process.exit(1);
}

async function json(url, opciones = {}) {
  const res = await fetch(url, { ...opciones, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Leverade ────────────────────────────────────────────────────────────────
/**
 * Los partidos del torneo con sus filas de resultado, por matchId.
 *
 * El grupo de la "Tabla acumulada" se descarta: son partidos ficticios 0-0 que
 * ARUSA usa para publicar su tabla, no resultados, y vigilarlos sería inventar
 * 6 desacuerdos por etapa. Se mira aparte, en tablaOficial().
 */
async function leverade() {
  const d = await json(
    `https://api.leverade.com/tournaments/${TORNEO}?include=groups.rounds.matches.results,teams`,
    { headers: { Accept: "application/vnd.api+json" } },
  );
  const inc = d.included ?? [];
  const equipo = new Map(
    inc.filter((x) => x.type === "team").map((x) => [String(x.id), x.attributes?.name]),
  );
  const nombreGrupo = new Map(
    inc.filter((x) => x.type === "group").map((x) => [String(x.id), x.attributes?.name ?? ""]),
  );
  const grupoDeRonda = new Map();
  for (const r of inc) {
    if (r.type !== "round") continue;
    const g = r.relationships?.group?.data?.id;
    if (g) grupoDeRonda.set(String(r.id), String(g));
  }

  const partidos = new Map();
  for (const m of inc) {
    if (m.type !== "match") continue;
    const rid = String(m.relationships?.round?.data?.id ?? "");
    const grupo = nombreGrupo.get(grupoDeRonda.get(rid)) ?? "";
    if (/tabla\s+acumulada/i.test(grupo)) continue;
    const dt = m.attributes?.datetime ?? null;
    partidos.set(String(m.id), {
      id: String(m.id),
      grupo,
      home: equipo.get(String(m.meta?.home_team ?? "")) ?? null,
      away: equipo.get(String(m.meta?.away_team ?? "")) ?? null,
      finished: !!m.attributes?.finished,
      datetime: dt,
      fecha: dt ? enChile(new Date(Date.parse(dt.replace(" ", "T") + "Z"))) : null,
      // null = la planilla ni se abrió. Un número (aunque sea 0) = abierta.
      valores: [],
    });
  }
  for (const r of inc) {
    if (r.type !== "result" || r.relationships?.period?.data) continue;
    const p = partidos.get(String(r.relationships?.match?.data?.id ?? ""));
    if (p) p.valores.push(r.attributes?.value ?? null);
  }
  return partidos;
}

/**
 * De los partidos que un club juega en la etapa, el que estaba en curso en un
 * momento dado: el de hora programada más reciente que ya había empezado.
 *
 * Hace falta porque en el seven un club juega VARIOS partidos el mismo día
 * —dos de grupo más las copas—, así que el nombre del equipo no identifica el
 * partido. Se decide con la hora programada de Leverade y el momento del
 * evento, NO con el reloj de quien mira: así da lo mismo en vivo que en un
 * ensayo contra una etapa ya jugada.
 */
function partidoEnCurso(partidos, club, momentoMs) {
  let elegido = null;
  for (const o of partidos) {
    if (o.home !== club && o.away !== club) continue;
    const t = o.datetime ? Date.parse(o.datetime.replace(" ", "T") + "Z") : null;
    if (t == null || t > momentoMs) continue;
    if (!elegido || t > elegido.t) elegido = { id: o.id, t };
  }
  return elegido?.id ?? null;
}

/** Cuántas filas tiene cargada la tabla oficial del circuito. */
async function tablaOficialFilas() {
  const d = await json(`${API}/seven`).catch(() => null);
  return (d?.oficial ?? []).length;
}

// ── Nuestra API ─────────────────────────────────────────────────────────────
/**
 * El circuito como lo muestra la app: los partidos por matchId, cuándo se
 * generó el payload y los eventos derivados.
 */
async function nuestra() {
  const d = await json(`${API}/seven`).catch(() => null);
  if (!d) return null;
  const partidos = new Map();
  for (const e of d.etapas ?? []) {
    for (const g of [...(e.grupos ?? []), ...(e.copas ?? [])]) {
      for (const p of g.partidos ?? []) partidos.set(String(p.id), p);
    }
  }
  return {
    partidos,
    generadoEn: d.generadoEn ? Date.parse(d.generadoEn) : null,
    eventos: d.eventos ?? [],
    oficial: (d.oficial ?? []).length,
  };
}

// ── Corrida ─────────────────────────────────────────────────────────────────
const estado = new Map(); // matchId → hitos observados
const FIN = Date.now() + MINUTOS * 60_000;

let lev = await leverade().catch((e) => {
  console.log(`Leverade no respondió (${e.message}). Sin eso no hay nada que vigilar.`);
  return null;
});
if (!lev) process.exit(0);

// El cron es semanal pero las etapas no: sin partidos hoy no vale la pena
// gastar cinco horas de runner.
const FECHA = FECHA_PEDIDA === "auto" ? enChile(new Date()) : FECHA_PEDIDA;
let delDia = [...lev.values()].filter((p) => p.fecha === FECHA);
if (delDia.length === 0) {
  console.log(`Hoy (${FECHA}) no hay etapa del circuito. No hay nada que vigilar.`);
  process.exit(0);
}

const oficialAlEmpezar = await tablaOficialFilas();
console.log(
  `\nVigilancia del circuito de seven · etapa del ${FECHA} · ${delDia.length} partidos ` +
  `· hasta las ${hora(new Date(FIN))} de Chile · muestreo cada ${CADA_MS / 1000}s`,
);
console.log(`Tabla oficial al empezar: ${oficialAlEmpezar} filas\n`);

let eventosVistos = 0;
let oficialAhora = oficialAlEmpezar;
let avisadoCache = false;
// Para avisar una sola vez cuando se empieza y se deja de vigilar la edad.
let vigilandoEdad = null;
// El TTL corto SÓLO se activa cuando la etapa es la de hoy, así que mirar la
// edad del payload cualquier otro día es un falso positivo garantizado: media
// hora de caché es lo correcto fuera del día del torneo. Lo descubrí ensayando
// con FECHA fijada, que es justamente el caso.
const VIGILAR_CACHE = FECHA === enChile(new Date());
if (!VIGILAR_CACHE) {
  console.log(`(la etapa del ${FECHA} no es hoy: no se vigila la edad del caché)`);
}

while (Date.now() < FIN) {
  try {
    lev = await leverade();
    delDia = [...lev.values()].filter((p) => p.fecha === FECHA);
  } catch (e) {
    alertar(`Leverade no respondió: ${e.message}`);
  }

  // Un fallo suelto no es noticia: cada push redespliega la API y en plan Free
  // hay arranque en frío. Molesta si se repite en ciclos seguidos.
  const app = await nuestra();
  if (app == null) {
    caidas += 1;
    if (caidas === CAIDAS_PARA_ALERTAR) alertar(`nuestra API no responde hace ${caidas} ciclos`);
    else anotar(`(la API no respondió; van ${caidas} de ${CAIDAS_PARA_ALERTAR})`);
    await dormir(CADA_MS);
    continue;
  }
  caidas = 0;

  // — 1. el caché congelado
  //
  // El TTL corto aplica mientras la etapa NO está jugada; en cuanto termina el
  // último partido, `ttlPara` vuelve a media hora A PROPÓSITO. Así que mirar la
  // edad después de eso es un falso positivo garantizado, y acá no es un aviso
  // de más: `cortarSiHayAlerta` cierra la ventana al primer aviso. El 7-nov eso
  // costó las dos corridas —la de la mañana se cortó a las 17:22, y la de la
  // tarde murió en 10 segundos, con el torneo todavía sin tabla oficial—.
  // Es la MISMA condición que usa ttlPara, no una parecida: algún partido del
  // día sin terminar.
  const enJuego = delDia.some((p) => !p.finished);
  if (enJuego !== vigilandoEdad) {
    vigilandoEdad = enJuego;
    console.log(
      enJuego
        ? "(la etapa está en juego: se vigila la edad del caché)"
        : "(la etapa terminó: el TTL vuelve a media hora, dejo de vigilar la edad)",
    );
    if (!enJuego) avisadoCache = false;
  }
  if (VIGILAR_CACHE && enJuego && app.generadoEn != null) {
    const edad = Date.now() - app.generadoEn;
    if (edad > EDAD_MAXIMA_MS && !avisadoCache) {
      avisadoCache = true;
      alertar(
        `el payload del circuito tiene ${Math.round(edad / 60_000)} min: ` +
        `el TTL corto del día de torneo no está aplicando y la página va atrasada`,
      );
    } else if (edad <= EDAD_MAXIMA_MS) {
      avisadoCache = false;
    }
  }

  // — 3. la bitácora: cuántos eventos nuevos y de quién
  if (app.eventos.length > eventosVistos) {
    for (const ev of app.eventos.slice(0, app.eventos.length - eventosVistos)) {
      anotar(`EVENTO · ${ev.jugador} (${ev.equipo}): ${ev.tipo}${ev.cantidad > 1 ? ` ×${ev.cantidad}` : ""}`);
    }
    eventosVistos = app.eventos.length;
  }

  // — la tabla oficial de la etapa
  if (app.oficial !== oficialAhora) {
    anotar(`TABLA OFICIAL · pasó de ${oficialAhora} a ${app.oficial} filas`);
    oficialAhora = app.oficial;
  }

  for (const p of delDia) {
    const nombre = p.home && p.away ? `${p.home} vs ${p.away}` : `(cruce por definir)`;
    const etiqueta = `${p.grupo} · ${nombre}`;
    if (!estado.has(p.id)) {
      estado.set(p.id, {
        grupo: p.grupo, nombre, planilla: null, primerPunto: null,
        vistoApp: null, primerEvento: null, desfaseDesde: null, avisado: false,
      });
    }
    const e = estado.get(p.id);
    if (p.home && p.away) e.nombre = nombre;

    const abiertos = p.valores.filter((v) => v != null);
    const total = abiertos.reduce((a, b) => a + Number(b), 0);

    // — 4. el arranque
    if (abiertos.length > 0 && !e.planilla) {
      e.planilla = new Date();
      anotar(`ARRANQUE · ${etiqueta}: la planilla se abrió (${abiertos.join("-")})`);
    }
    if (total > 0 && !e.primerPunto) {
      e.primerPunto = new Date();
      const dif = e.planilla ? Math.round((e.primerPunto - e.planilla) / 60_000) : null;
      anotar(
        `ARRANQUE · ${etiqueta}: primer punto (${abiertos.join("-")})` +
        (dif != null ? ` · ${dif} min después de abrirse la planilla` : ""),
      );
    }

    // — el primer evento con nombre de este partido, para medir el retraso del
    //   planillero.
    //
    //   OJO con el cruce. En el XV un club juega UN partido por fecha, así que
    //   el nombre del equipo basta para identificar el partido. En el seven NO:
    //   cada club juega dos de grupo más las copas el mismo día. Cruzar sólo
    //   por equipo le adjudicaba el mismo evento a todos los partidos del club
    //   —lo vi en el ensayo: una amarilla de COBS aparecía en COBS-CDA y en
    //   COBS-DOBS, uno de ellos sin empezar— e inflaba el veredicto del
    //   informe. Así que sólo cuenta para el partido del club que está EN
    //   CURSO: el último cuyo primer punto ya vimos.
    if (!e.primerEvento && p.home && p.away) {
      const suyo = app.eventos.find((ev) => {
        if (ev.equipo !== p.home && ev.equipo !== p.away) return false;
        const cuando = Date.parse(ev.hasta);
        if (!Number.isFinite(cuando)) return false;
        return partidoEnCurso(delDia, ev.equipo, cuando) === p.id;
      });
      if (suyo) {
        e.primerEvento = new Date();
        const dif = e.primerPunto ? Math.round((e.primerEvento - e.primerPunto) / 60_000) : null;
        anotar(
          `NOMBRES · ${etiqueta}: primer evento con nombre (${suyo.jugador})` +
          (dif != null ? ` · ${dif} min después del primer punto` : ""),
        );
      }
    }

    // — 2. los marcadores
    const mio = app.partidos.get(p.id);
    const ausente = !mio && total > 0;
    if (!mio) {
      marcarDesfase(e, etiqueta, ausente, () =>
        `Leverade tiene ${abiertos.join("-")} y nuestra API no trae el partido`);
      continue;
    }
    if (mio.homeScore != null && !e.vistoApp) {
      e.vistoApp = new Date();
      anotar(`APP · ${etiqueta}: ${mio.homeScore}-${mio.awayScore}`);
    }

    // Se comparan TOTALES ordenados, no lados: el orden de las filas `result`
    // de Leverade no distingue local de visita.
    const lh = abiertos.length === 2 ? Number(abiertos[0]) : null;
    const la = abiertos.length === 2 ? Number(abiertos[1]) : null;
    const marcadorDistinto =
      lh != null && mio.homeScore != null &&
      !(Math.min(lh, la) === Math.min(mio.homeScore, mio.awayScore) &&
        Math.max(lh, la) === Math.max(mio.homeScore, mio.awayScore));
    const pegado = total > 0 && mio.homeScore == null;

    marcarDesfase(e, etiqueta, marcadorDistinto || pegado, () =>
      pegado
        ? `Leverade tiene ${abiertos.join("-")} y la app sigue sin marcador`
        : `marcador: Leverade ${abiertos.join("-")} vs app ${mio.homeScore}-${mio.awayScore}`);
  }

  cortarSiHayAlerta();
  await dormir(CADA_MS);
}

// ── Informe ─────────────────────────────────────────────────────────────────
function reloj(d) { return d ? hora(d) : "—"; }

function informar() {
  const filas = [...estado.values()].map((e) => {
    const veredicto = !e.primerPunto
      ? "no arrancó en la ventana"
      : e.primerEvento
        ? `nombres ${Math.round((e.primerEvento - e.primerPunto) / 60_000)} min después del primer punto`
        : "marcador sí, nombres NO";
    return `| ${e.grupo} | ${e.nombre} | ${reloj(e.planilla)} | ${reloj(e.primerPunto)} | ${reloj(e.vistoApp)} | ${reloj(e.primerEvento)} | ${veredicto} |`;
  });

  // La pregunta que abre este experimento: ¿los planilleros cargan DURANTE el
  // torneo? De eso depende que los nombres lleguen en el día o todos al final.
  const conNombres = [...estado.values()].filter((e) => e.primerEvento).length;
  const arrancados = [...estado.values()].filter((e) => e.primerPunto).length;
  const veredictoGlobal =
    arrancados === 0
      ? "Ningún partido arrancó dentro de la ventana."
      : conNombres === 0
        ? `**Los nombres NO llegaron en el día.** ${arrancados} partidos con marcador y 0 con evento ` +
          "derivado: los planilleros cargan las planillas después, así que el desglose por partido " +
          "queda para el cierre y en vivo sólo hay marcador."
        : `**Los nombres sí llegaron**: ${conNombres} de ${arrancados} partidos arrancados tuvieron ` +
          "evento con nombre durante la jornada. El mecanismo de fotos sirve en vivo.";

  const informe = [
    `## Vigilancia del seven · etapa del ${FECHA}`,
    "",
    alertas.length
      ? `### ⚠️ ${alertas.length} alerta(s)\n\n${alertas.map((a) => `- ${a}`).join("\n")}`
      : "### ✅ Sin alertas: Leverade y la app se mantuvieron de acuerdo toda la ventana.",
    "",
    "### ¿Llegaron los nombres?",
    "",
    veredictoGlobal,
    "",
    `Eventos derivados en total: **${eventosVistos}**. Tabla oficial: ${oficialAlEmpezar} → ${oficialAhora} filas.`,
    "",
    "### Partido por partido",
    "",
    "| Grupo | Partido | Planilla | Primer punto | App con marcador | Primer nombre | Veredicto |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...filas,
    "",
    "<details><summary>Bitácora completa</summary>\n",
    "```",
    ...diario,
    "```",
    "\n</details>",
  ].join("\n");

  console.log(`\n${informe}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, informe);
  }
}

informar();
// Salir con error deja el workflow en rojo y GitHub manda el correo: es la única
// forma de enterarse de un problema sin estar mirando.
if (alertas.length) process.exit(1);
