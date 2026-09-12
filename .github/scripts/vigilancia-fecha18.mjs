// Vigilancia de una jornada, para correr sola en GitHub Actions.
//
// Nace de un sábado en que nadie iba a estar mirando: los tres horarios (11:30
// Pre, 13:30 Inter, 15:30 Primera) caían con el dueño de la app jugando. Hace
// dos cosas a la vez, muestreando cada 2 minutos:
//
//  1. EXPERIMENTO DEL ARRANQUE. Hoy un partido se marca "en vivo" recién con el
//     primer punto, porque el horario de Leverade viene mal cargado seguido y no
//     existe atributo de "en curso". Pero Leverade emite una fila `result` por
//     equipo y su `value` es null hasta que alguien abre la planilla: en cuanto
//     el planillero la abre pasa a 0. Si ese 0 llega antes del primer punto,
//     tenemos el pitazo inicial gratis. Esto lo mide, partido por partido.
//
//  2. VIGILANCIA. Compara lo que dice Leverade con lo que muestra nuestra API y
//     avisa cuando se separan: marcador atrasado, partido con puntos que sigue
//     SCHEDULED, o partido terminado que se quedó LIVE. Eso es exactamente lo
//     que arruinaría la jornada sin que nadie se entere.
//
// Sin base de datos, sin secretos y sin tocar arusa: sólo la API pública de
// Leverade y la nuestra.
//
//   MINUTOS=300 node .github/scripts/vigilancia-fecha18.mjs

const API = "https://rugby-chile-api.onrender.com/api/v1";
const TORNEO = "1328550";
const GRUPOS = { 3667033: "PRIMERA", 3667034: "INTERMEDIA", 3667035: "PRE_INTERMEDIA" };

const RONDA = Number(process.env.RONDA ?? 18);
const MINUTOS = Number(process.env.MINUTOS ?? 300);
const CADA_MS = Number(process.env.CADA_MS ?? 120_000);
// Cuánto tolera el desfase entre Leverade y nuestra API antes de ser una alerta.
// El poller corre cada 60s y la meta de Leverade se cachea 45s, así que un ciclo
// de atraso es normal; seis minutos ya no.
const TOLERANCIA_MS = 6 * 60_000;

const hora = (d = new Date()) =>
  d.toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour12: false });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const bitacora = [];
const anotar = (linea) => {
  const l = `[${hora()}] ${linea}`;
  console.log(l);
  bitacora.push(l);
};

const alertas = [];
const alertar = (linea) => {
  anotar(`⚠️  ${linea}`);
  alertas.push(`${hora()} · ${linea}`);
};

async function json(url, opciones = {}) {
  const res = await fetch(url, { ...opciones, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Leverade ────────────────────────────────────────────────────────────────
// Una sola petición trae el torneo entero con las filas de resultado de cada
// partido. Es la misma que usa la API en producción, así que vemos lo mismo
// que ve el poller.
async function leverade() {
  const d = await json(
    `https://api.leverade.com/tournaments/${TORNEO}?include=groups.rounds.matches.results`,
    { headers: { Accept: "application/vnd.api+json" } },
  );
  const inc = d.included ?? [];

  const rondaDePartido = new Map();
  const numeroDeRonda = new Map();
  const grupoDeRonda = new Map();
  for (const r of inc) {
    if (r.type !== "round") continue;
    const n = /Fecha\s+(\d+)/i.exec(r.attributes?.name ?? "");
    if (n) numeroDeRonda.set(String(r.id), Number(n[1]));
    const g = r.relationships?.group?.data?.id;
    if (g) grupoDeRonda.set(String(r.id), String(g));
  }

  const partidos = new Map();
  for (const m of inc) {
    if (m.type !== "match") continue;
    const rid = String(m.relationships?.round?.data?.id ?? "");
    if (numeroDeRonda.get(rid) !== RONDA) continue;
    rondaDePartido.set(String(m.id), rid);
    partidos.set(String(m.id), {
      id: String(m.id),
      division: GRUPOS[grupoDeRonda.get(rid)] ?? "?",
      finished: !!m.attributes?.finished,
      datetime: m.attributes?.datetime ?? null,
      // null = la planilla ni se ha abierto. Un número (aunque sea 0) = abierta.
      valores: [],
    });
  }

  for (const r of inc) {
    if (r.type !== "result") continue;
    const mid = String(r.relationships?.match?.data?.id ?? "");
    const p = partidos.get(mid);
    if (p) p.valores.push(r.attributes?.value ?? null);
  }
  return partidos;
}

// ── Nuestra API ─────────────────────────────────────────────────────────────
// `/live` deja de traer un partido apenas termina, así que hay que mirar las dos
// listas para ver la transición completa.
async function nuestra() {
  const [vivos, terminados] = await Promise.all([
    json(`${API}/live`).catch(() => null),
    json(`${API}/live/finished`).catch(() => null),
  ]);
  if (vivos == null && terminados == null) return null;
  const todos = [...(vivos ?? []), ...(terminados ?? [])];
  return new Map(todos.map((m) => [`${m.homeTeam}|${m.awayTeam}|${m.division}`, m]));
}

// ── Corrida ─────────────────────────────────────────────────────────────────
const nombres = await json(`${API}/leverade/results`).catch(() => ({}));
const nombrePorId = new Map(
  Object.values(nombres)
    .filter((m) => m.matchId)
    .map((m) => [String(m.matchId), m]),
);

const estado = new Map(); // matchId → hitos observados
const FIN = Date.now() + MINUTOS * 60_000;

console.log(`\nVigilancia de la fecha ${RONDA} · hasta las ${hora(new Date(FIN))} de Chile · muestreo cada ${CADA_MS / 1000}s\n`);

while (Date.now() < FIN) {
  let lev = null;
  try {
    lev = await leverade();
  } catch (e) {
    alertar(`Leverade no respondió: ${e.message}`);
  }

  const app = await nuestra();
  if (app == null) alertar("nuestra API no respondió ni /live ni /live/finished");

  if (lev) {
    for (const [id, p] of lev) {
      const info = nombrePorId.get(id);
      const nombre = info ? `${info.homeTeam} vs ${info.awayTeam}` : id;
      const etiqueta = `${p.division} · ${nombre}`;
      if (!estado.has(id)) {
        estado.set(id, { division: p.division, planilla: null, primerPunto: null, vistoVivo: null, vistoFinal: null, desfaseDesde: null });
      }
      const e = estado.get(id);

      // — hito 1: la planilla se abrió (hay filas con value numérico, aunque sea 0)
      const abiertos = p.valores.filter((v) => v != null);
      if (abiertos.length > 0 && !e.planilla) {
        e.planilla = new Date();
        anotar(`ARRANQUE · ${etiqueta}: la planilla se abrió (${abiertos.join("-")})`);
      }
      // — hito 2: el primer punto
      const total = abiertos.reduce((a, b) => a + Number(b), 0);
      if (total > 0 && !e.primerPunto) {
        e.primerPunto = new Date();
        const dif = e.planilla ? Math.round((e.primerPunto - e.planilla) / 60_000) : null;
        anotar(`ARRANQUE · ${etiqueta}: primer punto (${abiertos.join("-")})${dif != null ? ` · ${dif} min después de abrirse la planilla` : ""}`);
      }

      if (!info || !app) continue;
      const mio = app.get(`${info.homeTeam}|${info.awayTeam}|${p.division}`);
      if (!mio) {
        if (abiertos.length > 0) alertar(`${etiqueta}: Leverade ya tiene marcador y nuestra API no muestra el partido`);
        continue;
      }

      if (["LIVE", "HT"].includes(mio.status) && !e.vistoVivo) {
        e.vistoVivo = new Date();
        anotar(`APP · ${etiqueta}: pasó a ${mio.status}`);
      }
      if (mio.status === "FINISHED" && !e.vistoFinal) {
        e.vistoFinal = new Date();
        anotar(`APP · ${etiqueta}: FINAL ${mio.homeScore}-${mio.awayScore} · ${(mio.events ?? []).length} eventos`);
      }

      // — desfase: Leverade y nosotros discrepan. Se avisa una sola vez por
      //   partido, y sólo si se mantiene más que un par de ciclos del poller.
      const lh = abiertos.length === 2 ? Number(abiertos[0]) : null;
      const la = abiertos.length === 2 ? Number(abiertos[1]) : null;
      const marcadorDistinto =
        lh != null &&
        !(Math.min(lh, la) === Math.min(mio.homeScore, mio.awayScore) &&
          Math.max(lh, la) === Math.max(mio.homeScore, mio.awayScore));
      const pegado = total > 0 && mio.status === "SCHEDULED";
      const colgado = p.finished && ["LIVE", "HT"].includes(mio.status);
      const mal = marcadorDistinto || pegado || colgado;

      if (!mal) {
        e.desfaseDesde = null;
      } else if (!e.desfaseDesde) {
        e.desfaseDesde = Date.now();
      } else if (Date.now() - e.desfaseDesde > TOLERANCIA_MS && !e.avisado) {
        e.avisado = true;
        const que = pegado
          ? `sigue SCHEDULED con ${abiertos.join("-")} en Leverade`
          : colgado
            ? `terminó en Leverade y en la app sigue ${mio.status}`
            : `marcador: Leverade ${abiertos.join("-")} vs app ${mio.homeScore}-${mio.awayScore}`;
        alertar(`${etiqueta}: ${que} (hace más de ${TOLERANCIA_MS / 60_000} min)`);
      }
    }
  }

  await dormir(CADA_MS);
}

// ── Informe ─────────────────────────────────────────────────────────────────
const reloj = (d) => (d ? hora(d) : "—");
const filas = [...estado.entries()].map(([id, e]) => {
  const info = nombrePorId.get(id);
  const veredicto =
    e.planilla && e.primerPunto
      ? e.primerPunto - e.planilla > 60_000
        ? `la planilla se abrió ${Math.round((e.primerPunto - e.planilla) / 60_000)} min ANTES del primer punto`
        : "la planilla y el primer punto llegaron juntos"
      : "sin datos suficientes";
  return `| ${e.division} | ${info ? `${info.homeTeam} vs ${info.awayTeam}` : id} | ${reloj(e.planilla)} | ${reloj(e.primerPunto)} | ${reloj(e.vistoVivo)} | ${reloj(e.vistoFinal)} | ${veredicto} |`;
});

const informe = [
  `## Vigilancia fecha ${RONDA}`,
  "",
  alertas.length
    ? `### ⚠️ ${alertas.length} alerta(s)\n\n${alertas.map((a) => `- ${a}`).join("\n")}`
    : "### ✅ Sin alertas: Leverade y la app se mantuvieron de acuerdo toda la ventana.",
  "",
  "### Experimento del arranque",
  "",
  "| División | Partido | Planilla abierta | Primer punto | App en vivo | App final | Veredicto |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...filas,
  "",
  "<details><summary>Bitácora completa</summary>\n",
  "```",
  ...bitacora,
  "```",
  "\n</details>",
].join("\n");

console.log(`\n${informe}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, informe);
}

// Salir con error deja el workflow en rojo y GitHub manda el correo: es la única
// forma de enterarse de un problema sin estar mirando.
if (alertas.length) process.exit(1);
