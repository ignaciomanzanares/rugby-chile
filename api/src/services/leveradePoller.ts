/**
 * Tournament poller — auto-creates/updates live_matches rows for today's
 * games and broadcasts them over Socket.IO together with their event timeline.
 *
 * Data sources (all auth-free):
 *  - Match metadata: Leverade's public /tournaments endpoint
 *  - Score:          Leverade (+ el acumulado del propio timeline de arusa)
 *  - Event timeline: arusa.cl /live-scoring (GET, con tope global de scrapes)
 *
 * A arusa se le pega SOLO por el timeline y con tope global por tick, para no
 * cruzar su rate-limit por IP (lo que nos baneaba y cortaba el minuto a minuto).
 */

import { db } from "../db";
import { liveMatches, liveEvents } from "../db/schema";
import { eq, and, lt, desc, inArray, isNull } from "drizzle-orm";
import { getIo } from "../plugins/live";
import { splitDelta, marcadorMasAdelantado, terminadoPorMarcadorQuieto } from "../lib/scoreDelta";
import { fetchLeveradeLineup } from "./leveradeLineups";
import {
  type MatchMeta,
  type ArusaEvent,
  fetchAllMatchesMeta,
  scrapeArusaEvents,
  pointsForEventType,
  isArusaBlocked,
  arusaDegradeLevel,
} from "../lib/leverade";

// Último scrape del TIMELINE de eventos por partido (para throttlear y repartir
// los scrapes a arusa con round-robin + tope global, y no ganarnos el ban por IP).
const lastEventScrape = new Map<string, number>();
// Cada partido refresca su timeline como mucho cada 1 min…
const EVENT_MIN_INTERVAL_MS = 60_000;
// …y en TOTAL (todos los partidos) le pegamos a arusa como mucho estas veces por
// tick. Con esto, aunque haya 8 partidos simultáneos, quedamos MUY por debajo del
// umbral de rate-limit de arusa (lo que reventó el minuto a minuto en la F12).
const GLOBAL_EVENT_SCRAPES_PER_TICK = 3;
// Orden en que las divisiones pierden el minuto a minuto cuando arusa nos corta
// (0 = la última en caer). Primera es la que mira todo el mundo.
const DIVISION_EVENT_PRIORITY: Record<string, number> = {
  PRIMERA: 0,
  INTERMEDIA: 1,
  PRE_INTERMEDIA: 2,
};

// Último marcador de Leverade con el que scrapeamos arusa, por partido. El
// marcador de Leverade es GRATIS (no banea) y refleja cada anotación; en rugby se
// anota ~10-20 veces por partido. Solo le pegamos a arusa cuando este marcador
// CAMBIÓ (hay un evento nuevo que buscar), la primera vez, o cada
// EVENT_SAFETY_REFRESH_MS como red (tarjetas/correcciones que no mueven el
// marcador). Así el volumen a arusa baja de ~90 a ~15-20 requests/partido, muy por
// debajo del umbral de ban — que es lo que hace sostenible el minuto a minuto en
// vivo sin quemar la IP residencial.
const lastScrapedScore = new Map<string, string>();
const EVENT_SAFETY_REFRESH_MS = 5 * 60_000;
// …pero ese refresco es el que MÁS gasta y el que menos aporta: existe solo para
// pescar tarjetas y correcciones que no mueven el marcador. Con un partido en
// vivo cada 5 min es barato; con 15 simultáneos son ~240 requests de puro
// refresco en la tarde, y ahí se nos va el presupuesto de la IP.
// Así que se estira según cuántos partidos haya en vivo: el gasto total de
// refrescos queda ~constante en vez de crecer con la cantidad de partidos. Los
// scrapes que SÍ valen (gatillados por cambio de marcador) no se tocan.
const SAFETY_REFRESH_CAP_MS = 20 * 60_000;
function safetyRefreshMs(liveCount: number): number {
  if (liveCount <= 3) return EVENT_SAFETY_REFRESH_MS;
  return Math.min(EVENT_SAFETY_REFRESH_MS * Math.ceil(liveCount / 3), SAFETY_REFRESH_CAP_MS);
}

function broadcastUpdate(match: any) {
  getIo()?.emit("match:update", match);
}

/** Kept for backwards compat; io is now sourced from plugins/live. */
export function setIo(_io: any) {}

function todayStr(): string {
  // arusa match datetimes are Chile-local dates, so compare against the local
  // date — not UTC (which rolls over to "tomorrow" after ~20:00 Chile and made
  // the poller skip today's live matches while picking up the next day's).
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Leverade da "YYYY-MM-DD HH:MM:SS" en UTC pero SIN marcador de zona. El
// display_timezone (America/Santiago) es solo metadato de cómo mostrarlo; el
// datetime en sí es UTC (verificado: un partido en vivo a las 11:53 Chile tenía
// datetime "14:30" = 10:30 Chile, o sea empezó ~83min antes → UTC). El espacio +
// la falta de "Z" harían que `new Date()` lo tome como hora local; forzamos UTC.
function parseMatchTime(datetime: string): number {
  return Date.parse(datetime.replace(" ", "T") + "Z");
}

function minutesSince(datetime: string | null): number {
  if (!datetime) return 0;
  const ms = Date.now() - parseMatchTime(datetime);
  return Math.floor(ms / 60000);
}

const HALF_MIN = 40;       // each half
const HALFTIME_MIN = 15;   // break — the game clock pauses here.
// 15, no 10: el `scoringcriterion` de Leverade declara duration=5.700.000ms =
// 95 min para este torneo, o sea 40+15+40. Con 10 el reloj del segundo tiempo
// iba 5 minutos adelantado.
// A rugby match runs 80' of play + halftime + stoppage ≈ 100–110' wall-clock.
// Leverade's `finished` flag often lags by hours, which left a match stuck on
// LIVE (minute 80) long after full time — e.g. Intermedia still "live" once
// Primera (the next division, 2h later) had kicked off. Past this many minutes
// from kickoff we consider it over even if Leverade hasn't flagged it yet.
const FULL_TIME_MIN = 120;
// Backstop DURO: pasadas tantas horas del kickoff, el partido terminó sí o sí,
// aunque arusa siga devolviendo un minuto bajo o el datetime de Leverade esté
// mal. Acota el peor caso sin cortar de más un partido mal-timeado.
const HARD_FULL_TIME_MIN = 170;

// El reloj estimado se ancla al datetime de Leverade, que en varios partidos
// viene hasta 1h ANTES del kickoff real → el marcador mostraba 77' con el
// partido en el primer tiempo. No podemos saber el kickoff exacto sin arusa,
// pero sí acotarlo: guardamos cuándo vimos el partido en vivo por primera vez y
// el minuto estimado no puede superar ese tiempo transcurrido + una gracia (lo
// que pudo haber corrido antes de que lo detectáramos). Así el error queda
// topado en minutos en vez de una hora.
const LIVE_CLOCK_GRACE_MIN = 15;
const firstSeenLiveAt = new Map<string, number>();

// Cuánto puede estar quieto el marcador, pasado el tiempo de un partido, antes
// de darlo por terminado. Sin arusa ésta es la única evidencia de que el partido
// acabó; 30' sin sumar un punto es mucho para un partido realmente en curso, y
// si el horario de Leverade viniera adelantado el marcador seguiría moviéndose
// y esto no se gatilla.
const STALE_SCORE_MIN = 30;
const lastScoreChangeAt = new Map<string, number>();

// Map wall-clock minutes since kickoff to the game minute + whether we're at the
// break. The match clock STOPS at halftime, so raw wall-clock overshoots — it
// would hit 80 (and stick there) well before full time. Subtracting the break
// keeps the displayed minute honest and shows "Descanso" during halftime.
function gameClock(wall: number): { minute: number; halftime: boolean } {
  if (wall <= HALF_MIN) return { minute: Math.max(0, wall), halftime: false };
  if (wall <= HALF_MIN + HALFTIME_MIN) return { minute: HALF_MIN, halftime: true };
  return { minute: Math.min(80, wall - HALFTIME_MIN), halftime: false };
}

/**
 * Current game minute reconstructed from arusa's scoring events.
 *
 * arusa reports per-half minutes (each half counts 0–40) and delivers events
 * out of order, so neither the raw max minute nor arusa's order is usable. But
 * the cumulative score only ever grows, so it gives a reliable chronology: sort
 * the SCORING events by total points, detect the halftime reset (the minute
 * drops back), and the last event's half + minute is the live minute — 2nd-half
 * minutes get +40 (a try at 2nd-half 30' is game minute 70'). Returns null when
 * there are no scoring events yet (caller falls back to the wall-clock estimate).
 */
function liveMinuteFromEvents(events: ArusaEvent[]): number | null {
  const scoring = events
    .filter((e) => e.homeScore + e.awayScore > 0)
    .sort((a, b) => a.homeScore + a.awayScore - (b.homeScore + b.awayScore));
  if (!scoring.length) return null;
  let half = 1;
  let runMax = -1;
  let total = 0;
  for (const e of scoring) {
    if (e.minute + 1 < runMax) half = 2; // minute dropped back → second half
    runMax = Math.max(runMax, e.minute);
    total = (half === 1 ? 0 : HALF_MIN) + e.minute;
  }
  return Math.min(80, total);
}

// Un partido AUTO (del poller) solo está "en vivo" cuando hay evidencia real de
// que arrancó: un marcador o al menos un evento. Derivar LIVE solo del reloj de
// Leverade (que viene ~1h antes en varios partidos) inventaba un partido fantasma
// 0-0 "EN VIVO" hasta una hora antes de arrancar de verdad.
function statusFor(
  m: MatchMeta,
  started: boolean,
  eventMinute: number | null,
  minutosSinCambio: number | null = null,
): "FINISHED" | "HT" | "LIVE" | "SCHEDULED" {
  if (m.finished) return "FINISHED";
  const wall = minutesSince(m.datetime);
  if (wall < 0) return "SCHEDULED";
  if (wall >= HARD_FULL_TIME_MIN) return "FINISHED"; // backstop duro
  // Backstop normal por reloj: SOLO finalizamos a los 120' de reloj si arusa
  // CONFIRMA que el partido está cerca del final (minuto real >= 72). Si NO
  // tenemos datos de arusa (eventMinute == null, p. ej. arusa nos bloquea con
  // 429), NO finalizamos — el reloj de pared con el datetime de Leverade viene
  // 1h antes y llegaba a 120' con el partido en el entretiempo, terminándolo de
  // más. Sin confirmación de arusa, esperamos al backstop duro (HARD_FULL_TIME)
  // o a que Leverade marque finished.
  const arusaSaysNearEnd = eventMinute != null && eventMinute >= 72;
  // Con arusa detrás del muro, eventMinute es SIEMPRE null y la regla de arriba
  // quedó muerta: todo terminaba por el backstop duro, o sea una hora larga
  // después del pitazo final (el 2026-09-12, Old Reds-Old Macks de Pre se quedó
  // "EN VIVO" hasta las 14:20 habiendo terminado a las 13:10). El marcador
  // quieto es la evidencia que sí tenemos: si no suma un punto en media hora y
  // ya pasó el tiempo de un partido, terminó. Y es seguro justo en el caso que
  // motivó el backstop —un datetime adelantado— porque ahí el partido sigue en
  // curso y el marcador se mueve.
  if (wall >= FULL_TIME_MIN && arusaSaysNearEnd) return "FINISHED";
  if (terminadoPorMarcadorQuieto(wall, started, minutosSinCambio, FULL_TIME_MIN, STALE_SCORE_MIN)) {
    return "FINISHED";
  }
  // NO marcamos en vivo un partido AUTO sin evidencia real (marcador o eventos).
  // El datetime de Leverade viene ~1h antes en varios partidos (Pre/DOBS), así
  // que confiar en el reloj de pared lo daba por "en vivo 0-0" hasta 1h antes de
  // arrancar de verdad. Ahora un partido del poller pasa a LIVE sólo cuando arusa
  // muestra un marcador o algún evento. (El narrador manual setea LIVE por su
  // cuenta vía socket y no pasa por acá, así que no se ve afectado.)
  if (!started) return "SCHEDULED";
  return gameClock(wall).halftime ? "HT" : "LIVE";
}

function countTries(events: ArusaEvent[], team: "home" | "away"): number {
  return events.filter((e) => e.team === team && e.type === "TRY").length;
}

/**
 * Process one match: sync metadata, score, and events from arusa, then
 * broadcast the full match payload (with its event timeline) over Socket.IO.
 */
// Exportada para el ensayo del en vivo (scripts/ensayoEnVivo.ts); el poller la usa igual.
export async function processMatch(m: MatchMeta, scrapeEvents: boolean): Promise<void> {
  // Resiliencia: si arusa falla (429/timeout) NO abortamos el partido. Seguimos
  // con lo de Leverade + lo último conocido, y marcamos arusaOk=false para no
  // fabricar un minuto por reloj de pared.
  let arusaOk = true;
  // arusa se toca SOLO para el TIMELINE de eventos, y con tope global (pollLeverade
  // decide `scrapeEvents`). Antes pedíamos ADEMÁS la página de marcador de arusa
  // CADA tick POR partido — con varios partidos simultáneos eso cruzaba el
  // rate-limit de arusa (~46 req) en minutos y nos ganaba un ban por IP que cortaba
  // TODO el minuto a minuto (pasó en la F12). El marcador ahora sale de Leverade +
  // del propio timeline, sin pegarle a arusa por el score.
  // `scrapeEvents` ya viene decidido por pollLeverade (incluye partidos recién
  // terminados para pescar correcciones tardías del planillero), así que forzamos
  // según eso — no lo condicionamos a !finished acá.
  const events = await scrapeArusaEvents(m.matchId, { force: scrapeEvents }).catch(() => {
    arusaOk = false;
    return [] as ArusaEvent[];
  });
  if (isArusaBlocked()) arusaOk = false;

  const existing = await db.query.liveMatches.findFirst({
    where: eq(liveMatches.leveradeMatchId, m.matchId),
  });

  // FUENTE ÚNICA para el tablero (marcador, tries, minuto): el MISMO timeline que
  // se muestra debajo. Si este tick trajo eventos frescos, ese es el timeline; si
  // vino vacío (no scrapeó este tick, o 429/timeout transitorio) usamos el ya
  // persistido — así el marcador SIEMPRE calza con la lista de eventos. Antes el
  // marcador salía de Leverade, que se adelanta al evento que aún no scrapeamos, y
  // el tablero quedaba adelantado respecto del minuto a minuto.
  let timeline: ArusaEvent[] = events;
  if (timeline.length === 0 && existing) {
    const persisted = await db
      .select()
      .from(liveEvents)
      .where(eq(liveEvents.matchId, existing.id));
    timeline = persisted.map((e) => ({
      minute: e.minute,
      second: 0,
      team: e.team as "home" | "away",
      type: e.type as ArusaEvent["type"],
      playerName: e.playerName ?? null,
      playerNumber: null,
      homeScore: e.homeScore ?? 0,
      awayScore: e.awayScore ?? 0,
    }));
  }

  // Marcador: gana el que va MÁS ADELANTE entre el timeline (último evento con
  // puntaje) y Leverade.
  //
  // No alcanza con el timeline: los eventos derivados de ESTA consulta se
  // agregan más abajo (appendDerivedEvents), así que acá el timeline todavía es
  // el de la consulta anterior. Mientras se juega eso se corrige sola en la
  // consulta siguiente, pero en la ÚLTIMA no hay siguiente: un try sobre la hora,
  // que llega junto con la marca de terminado, quedaba fuera del marcador final
  // para siempre (visto en el ensayo: 24-21 en vez de 24-24).
  //
  // Tampoco alcanza con Leverade solo: cuando arusa responde, su timeline puede
  // ir adelante. Por eso se elige el mayor.
  const lastScored = timeline
    .filter((e) => e.homeScore + e.awayScore > 0)
    .sort((a, b) => a.homeScore + a.awayScore - (b.homeScore + b.awayScore))
    .at(-1);
  const mayor = marcadorMasAdelantado(
    lastScored ? { h: lastScored.homeScore, a: lastScored.awayScore } : null,
    m.homeScore != null && m.awayScore != null ? { h: m.homeScore, a: m.awayScore } : null,
  );
  const score: { homeScore?: number; awayScore?: number } = mayor
    ? { homeScore: mayor.h, awayScore: mayor.a }
    : { homeScore: m.homeScore, awayScore: m.awayScore };

  // Evidencia de que el partido realmente arrancó. Sin esto no lo marcamos LIVE
  // pasada la ventana de gracia (ver statusFor) para no inventar un 0-0 en vivo.
  const totalScore =
    (score.homeScore ?? m.homeScore ?? 0) + (score.awayScore ?? m.awayScore ?? 0);
  const started = totalScore > 0 || timeline.length > 0;

  // Cuándo se movió por última vez el marcador. Vive en memoria a propósito: si
  // el proceso se reinicia, arrancamos el conteo de cero y a lo más tardamos un
  // poco más en cerrar el partido — nunca lo cerramos de más.
  const totalPrevio = (existing?.homeScore ?? 0) + (existing?.awayScore ?? 0);
  if (!lastScoreChangeAt.has(m.matchId) || totalScore !== totalPrevio) {
    lastScoreChangeAt.set(m.matchId, Date.now());
  }
  // Cada subida de marcador crea eventos, así que el createdAt del ÚLTIMO evento
  // es cuándo cambió por última vez — y sobrevive a los reinicios, que es donde
  // la memoria falla: cada despliegue reiniciaba el conteo y el partido se
  // quedaba media hora más "en vivo" de gusto. Con eventos manda el dato
  // persistido; sin eventos, la memoria es lo único que hay.
  let quieto = lastScoreChangeAt.get(m.matchId)!;
  if (existing) {
    const [ultimo] = await db
      .select({ ts: liveEvents.createdAt })
      .from(liveEvents)
      .where(eq(liveEvents.matchId, existing.id))
      .orderBy(desc(liveEvents.createdAt))
      .limit(1);
    if (ultimo?.ts) quieto = ultimo.ts.getTime();
  }
  const minutosSinCambio = started ? Math.floor((Date.now() - quieto) / 60_000) : null;

  // Minuto real + tries, ambos del MISMO timeline que el marcador (consistencia).
  const eventMinute = liveMinuteFromEvents(timeline);
  const newStatus = statusFor(m, started, eventMinute, minutosSinCambio);
  const homeTries = countTries(timeline, "home");
  const awayTries = countTries(timeline, "away");

  // Minuto a mostrar: eventos de arusa; si no hay, se estima (ver más abajo).
  // Guard: un scrape parcial/vacío puede calcular un minuto mucho menor — si
  // bajaría el reloj más de 20', mantenemos el anterior (una baja chica es un
  // ajuste de deriva legítimo).
  if ((newStatus === "LIVE" || newStatus === "HT") && !firstSeenLiveAt.has(m.matchId)) {
    firstSeenLiveAt.set(m.matchId, Date.now());
  }
  const prev = existing?.minute ?? 0;
  let minute: number;
  if (newStatus === "SCHEDULED") {
    minute = 0;
  } else if (eventMinute != null) {
    minute = eventMinute; // minuto real desde los eventos de arusa
  } else if (!arusaOk && prev > 0) {
    // arusa caído y ya teníamos un minuto real: lo congelamos en vez de saltar a
    // una estimación por reloj (eso era el "minuto falso"). Se retoma cuando
    // arusa vuelve con eventos.
    minute = prev;
  } else {
    // arusa OK pero sin eventos (0-0) o recién arrancó: estimación por reloj,
    // acotada por hace cuánto lo vimos en vivo (ver LIVE_CLOCK_GRACE_MIN).
    const byKickoff = gameClock(minutesSince(m.datetime)).minute;
    const seen = firstSeenLiveAt.get(m.matchId);
    const bySeen = seen == null
      ? Number.POSITIVE_INFINITY
      : Math.floor((Date.now() - seen) / 60000) + LIVE_CLOCK_GRACE_MIN;
    minute = Math.min(byKickoff, bySeen);
  }
  if (existing && minute < prev && prev - minute > 20) minute = prev;
  minute = Math.max(0, Math.min(80, minute));

  let live: typeof liveMatches.$inferSelect;
  if (!existing) {
    [live] = await db
      .insert(liveMatches)
      .values({
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        division: m.division,
        venue: "",
        status: newStatus,
        minute,
        // arusa score first; Leverade's own score (m.homeScore) is the fallback
        // when arusa is rate-limited/down, so the live card still shows a score.
        homeScore: score.homeScore ?? m.homeScore ?? 0,
        awayScore: score.awayScore ?? m.awayScore ?? 0,
        homeTries,
        awayTries,
        leveradeMatchId: m.matchId,
      })
      .returning();
    console.log(
      `[poller] Created live match: ${m.homeTeam} vs ${m.awayTeam} (${m.division})`,
    );
  } else {
    [live] = await db
      .update(liveMatches)
      .set({
        status: newStatus,
        minute,
        // score ya cae a Leverade cuando no hay timeline; no metemos Leverade acá
        // para no adelantar el tablero respecto de la lista de eventos.
        homeScore: score.homeScore ?? existing.homeScore,
        awayScore: score.awayScore ?? existing.awayScore,
        homeTries,
        awayTries,
        updatedAt: new Date(),
      })
      .where(eq(liveMatches.id, existing.id))
      .returning();
  }

  // arusa is the authoritative event log. IMPORTANTE: solo reescribimos cuando el
  // scrape trajo eventos. Un scrape vacío (429/timeout transitorio vía proxy) NO
  // significa que el partido perdió sus eventos — el timeline solo crece — así que
  // conservamos las filas existentes en vez de borrarlas. Antes esto hacía flapear
  // el minuto a minuto (ev13 → ev0 → ev13 según cada tick). Carry the running score
  // per event and tag the half (arusa resets the clock at the break).
  if (events.length > 0) {
    await db.delete(liveEvents).where(eq(liveEvents.matchId, live.id));
    let prevMinute = -1;
    let half = 1;
    await db.insert(liveEvents).values(
      events.map((e) => {
        if (prevMinute >= 0 && e.minute + 1 < prevMinute) half = 2;
        prevMinute = e.minute;
        return {
          matchId: live.id,
          team: e.team,
          type: e.type,
          minute: e.minute,
          playerName: e.playerName,
          points: pointsForEventType(e.type),
          homeScore: e.homeScore,
          awayScore: e.awayScore,
          half,
        };
      }),
    );
  }

  // Sin eventos de arusa, reconstruimos la línea de anotaciones desde el
  // marcador de Leverade (ver appendDerivedEvents). Es el piso que siempre está.
  if (events.length === 0 && (newStatus === "LIVE" || newStatus === "HT" || newStatus === "FINISHED")) {
    await appendDerivedEvents(live.id, m, minute).catch((e) =>
      console.warn("[poller] eventos derivados fallaron:", e?.message ?? e),
    );
  }

  // Partido terminado → guardar la nómina oficial una sola vez. Leverade la
  // publica antes del kickoff (mediana ~22h) y no cambia después, así que con
  // capturarla al final queda persistida para siempre. fetchLeveradeLineup lee
  // el caché primero, o sea esto es un no-op salvo la primera vez.
  if (newStatus === "FINISHED") {
    void fetchLeveradeLineup(m.matchId, m.homeTeam, m.awayTeam, true).catch(() => {});
  }

  const dbEvents = await db
    .select()
    .from(liveEvents)
    .where(eq(liveEvents.matchId, live.id));

  // Tries mostrados: si no hubo timeline de arusa, contamos los derivados.
  if (events.length === 0 && dbEvents.length > 0) {
    const t = (side: string) =>
      dbEvents.filter((e) => e.team === side && (e.type === "TRY" || e.type === "TRY_CONVERTED")).length;
    const [hT, aT] = [t("home"), t("away")];
    if (hT !== live.homeTries || aT !== live.awayTries) {
      [live] = await db.update(liveMatches)
        .set({ homeTries: hT, awayTries: aT, updatedAt: new Date() })
        .where(eq(liveMatches.id, live.id)).returning();
    }
  }

  broadcastUpdate({ ...live, events: dbEvents });
}

/**
 * Minuto a minuto DERIVADO de Leverade, sin tocar arusa.
 *
 * Leverade publica el marcador de cada equipo (~45s de resolución) pero NO el
 * minuto ni el detalle. En rugby, sin embargo, cada cambio de marcador ES un
 * evento y el delta dice cuál: 5 try, 2 conversión, 3 penal/drop, 7 try
 * convertido. Con eso se reconstruye la línea de tiempo de las anotaciones.
 *
 * Limitaciones, a la vista: el minuto lo ponemos NOSOTROS (es el reloj de
 * partido al detectar el cambio), así que tiene el error del intervalo de poll
 * más el del ancla de inicio — uno o dos minutos. No hay nombres de jugador ni
 * tarjetas: eso solo existe en arusa.
 *
 * arusa MANDA cuando está disponible: si el partido ya tiene eventos con nombre
 * de jugador, esto no toca nada. Es el piso que siempre está, no un reemplazo.
 */

async function appendDerivedEvents(
  liveId: string,
  m: MatchMeta,
  minute: number,
): Promise<boolean> {
  if (m.homeScore == null || m.awayScore == null) return false;

  const rows = await db.select().from(liveEvents).where(eq(liveEvents.matchId, liveId));
  // Si hay eventos con nombre de jugador, son de arusa y mandan ellos.
  if (rows.some((r) => r.playerName != null)) return false;

  // El marcador corriente sale del MÁXIMO de lo ya guardado, no del "último
  // evento". Varios eventos del mismo salto comparten minuto e instante de
  // inserción, así que "el último" es ambiguo: al guardar TRY(5-0) y
  // CONVERSION(7-0) juntos, tomar el TRY hacía creer que el marcador iba 5-0 y
  // en la consulta siguiente se inventaba una conversión de 2 para "cuadrar".
  // Como el marcador solo sube, el máximo es siempre el valor vigente y no
  // depende de ningún orden.
  const prevHome = rows.reduce((m, r) => Math.max(m, r.homeScore ?? 0), 0);
  const prevAway = rows.reduce((m, r) => Math.max(m, r.awayScore ?? 0), 0);
  const dHome = m.homeScore - prevHome;
  const dAway = m.awayScore - prevAway;
  if (dHome < 0 || dAway < 0) return false;   // corrección a la baja: no inventamos
  if (dHome === 0 && dAway === 0) return false;

  const plays = [
    ...splitDelta(dHome).map((p) => ({ ...p, team: "home" as const })),
    ...splitDelta(dAway).map((p) => ({ ...p, team: "away" as const })),
  ];
  if (plays.length === 0) return false;

  let runHome = prevHome, runAway = prevAway;
  const half = minute > HALF_MIN ? 2 : 1;
  const values = plays.map((p) => {
    if (p.team === "home") runHome += p.pts; else runAway += p.pts;
    return {
      matchId: liveId,
      team: p.team,
      type: p.type,
      minute,
      playerName: null,          // derivado: sin nombre, y así se distingue de arusa
      points: p.pts,
      homeScore: runHome,
      awayScore: runAway,
      half,
    };
  });
  await db.insert(liveEvents).values(values);
  console.info(`[poller] ${m.homeTeam}-${m.awayTeam}: ${values.length} evento(s) derivado(s) de Leverade al ${minute}'`);
  return true;
}

/**
 * Poll today's matches on a cron tick. Currently scheduled every minute on
 * Thu–Sun via api/src/index.ts.
 */
// The poller only touches TODAY's matches, so a match that's still LIVE/HT when
// the day rolls over (or that drops out of the meta feed) would otherwise stay
// "EN VIVO" forever. SOLO aplica a sesiones manuales del scorer (sin
// leveradeMatchId): esas se quedan LIVE si el scorer nunca marca "finalizar".
// Los partidos de Leverade NO se tocan acá — terminan por statusFor (bandera
// finished de Leverade o +120' del kickoff); marcarlos por "fila vieja" era el
// bug de "finalizado cuando aún faltaba" (pasaba cuando arusa daba 429 y la
// fila no se refrescaba). El scorer solo refresca updatedAt al anotar o cambiar
// estado (no manda heartbeat del reloj), así que un tramo sin puntos puede durar
// tanto como un medio tiempo completo (~40-50'). Con 45' el barrido podía cerrar
// un partido en vivo por error en un tiempo defensivo y transmitir "finalizado"
// a todos. Subido a 90' — mayor que cualquier medio scoreless real, y aún limpia
// las sesiones abandonadas (scorer que cierra sin "Finalizar") dentro de ~1.5h.
const STALE_LIVE_MIN = 90;

/** Marks abandoned manual LIVE/HT scorer sessions as FINISHED and broadcasts. */
export async function finalizeStaleMatches(): Promise<void> {
  // Durante un bloqueo de arusa la "vejez" es esperable (no llega data), no
  // significa que el partido terminó.
  if (isArusaBlocked()) return;
  const cutoff = new Date(Date.now() - STALE_LIVE_MIN * 60000);
  const stale = await db
    .select()
    .from(liveMatches)
    .where(and(
      inArray(liveMatches.status, ["LIVE", "HT"]),
      lt(liveMatches.updatedAt, cutoff),
      isNull(liveMatches.leveradeMatchId),
    ));
  for (const s of stale) {
    const [live] = await db
      .update(liveMatches)
      .set({ status: "FINISHED", updatedAt: new Date() })
      .where(eq(liveMatches.id, s.id))
      .returning();
    const dbEvents = await db.select().from(liveEvents).where(eq(liveEvents.matchId, s.id));
    broadcastUpdate({ ...live, events: dbEvents });
    console.log(`[poller] auto-finalizado (sin actualizar ${STALE_LIVE_MIN}'+): ${s.homeTeam} vs ${s.awayTeam} (${s.division})`);
  }
}

/**
 * Quita del feed en vivo un partido que Leverade marcó postergado/cancelado.
 * Borra la fila (los eventos caen por cascade) solo si no tiene marcador real
 * (0-0): un aplazado no se jugó. Si tuviera marcador lo dejamos, para no perder
 * datos ante un flag equivocado.
 */
async function dropPhantomMatch(m: MatchMeta): Promise<void> {
  const existing = await db.query.liveMatches.findFirst({
    where: eq(liveMatches.leveradeMatchId, m.matchId),
  });
  if (!existing) return;
  if ((existing.homeScore ?? 0) + (existing.awayScore ?? 0) > 0) return;
  await db.delete(liveMatches).where(eq(liveMatches.id, existing.id));
  console.log(
    `[poller] postergado/cancelado en Leverade, fuera del vivo: ${m.homeTeam} vs ${m.awayTeam} (${m.division})`,
  );
}

export async function pollLeverade(): Promise<void> {
  const today = todayStr();

  // Always sweep stale live matches first — even on days with no fixtures.
  await finalizeStaleMatches().catch((e) => console.error("[poller] finalize stale:", e));

  try {
    const all = await fetchAllMatchesMeta();
    // Solo procesamos los partidos en VENTANA ACTIVA: desde 20 min antes del
    // kickoff (hora de Leverade, en UTC) hasta 3 h después (cubre cualquier
    // partido en curso). Antes se scrapeaban los ~12 partidos del día en cada
    // tick, incluidos los de la tarde — esa carga extra a arusa nos hacía ganar
    // 429 (que corta el timeline: minuto real + eventos). Con la ventana, el
    // poller le pega a arusa solo por los partidos que importan ahora.
    const nowMs = Date.now();
    const todays = all.filter((m) => {
      if (!m.datetime?.startsWith(today)) return false;
      // Un partido que YA tiene marcador en Leverade (en vivo o recién terminado)
      // se procesa SIEMPRE, sin importar la ventana horaria. La hora de Leverade
      // tiene líos de zona horaria, y la ventana [-3h,+20min] hacía perder
      // partidos en curso (p. ej. uno con 7-0 real quedaba fuera y no salía en
      // vivo). El marcador de Leverade es la verdad de que está jugándose ahora.
      if (m.homeScore != null || m.awayScore != null) return true;
      // Sin marcador aún → usar la ventana horaria para los próximos a empezar.
      const k = parseMatchTime(m.datetime);
      return Number.isFinite(k) && k <= nowMs + 20 * 60_000 && k >= nowMs - 180 * 60_000;
    });
    if (todays.length === 0) return;

    // Tope GLOBAL de scrapes a arusa por tick. arusa banea por IP pasado cierto
    // volumen de requests (no sabemos el número exacto — ver arusaDegradeLevel),
    // así que en vez de pegarle por cada partido cada tick, elegimos
    // como mucho GLOBAL_EVENT_SCRAPES_PER_TICK partidos por tick: los que hace más
    // tiempo no refrescamos (round-robin) y que ya cumplieron EVENT_MIN_INTERVAL_MS.
    // El resto sirve el timeline del cache (sin red). Así, con N partidos
    // simultáneos, cada uno se refresca cada ~N/cap min y NUNCA cruzamos el límite.
    // El marcador no cuenta: sale de Leverade.
    const nowTick = Date.now();
    const scoreKey = (m: (typeof todays)[number]) => `${m.homeScore ?? ""}-${m.awayScore ?? ""}`;
    // Cuántos partidos están realmente en curso ahora → cuánto estiramos el
    // refresco de seguridad (ver safetyRefreshMs).
    const liveNow = todays.filter(
      (m) => !m.postponed && !m.canceled && (!m.finished || minutesSince(m.datetime) < 240),
    ).length;
    const safetyRefresh = safetyRefreshMs(liveNow);
    const grantees = new Set(
      todays
        // Seguimos scrapeando un partido hasta ~4h del kickoff aunque Leverade ya
        // lo marque finished: el planillero de arusa suele cargar/corregir eventos
        // (sobre todo del visitante) DESPUÉS del pitazo final, y si dejamos de
        // scrapear al terminar, el timeline queda pegado en el último estado en
        // vivo (incompleto). Re-scrapeando un rato más pescamos esas correcciones.
        .filter((m) => !m.postponed && !m.canceled && (!m.finished || minutesSince(m.datetime) < 240))
        .filter((m) => nowTick - (lastEventScrape.get(m.matchId) ?? 0) >= EVENT_MIN_INTERVAL_MS)
        // Gatillo por CAMBIO de marcador (ver lastScrapedScore arriba): solo vale la
        // pena pegarle a arusa si Leverade dice que el marcador cambió (alguien
        // anotó → hay evento nuevo), si es la primera vez, o cada
        // EVENT_SAFETY_REFRESH_MS como red para tarjetas/correcciones que no mueven
        // el marcador. Un tick sin cambios NO gasta cupo de arusa → de ~90 a ~15-20
        // requests por partido.
        .filter((m) => {
          const last = lastScrapedScore.get(m.matchId);
          if (last === undefined) return true; // nunca scrapeado
          if (last !== scoreKey(m)) return true; // anotaron → buscar el evento
          return nowTick - (lastEventScrape.get(m.matchId) ?? 0) >= safetyRefresh;
        })
        // Degradación por prioridad: si arusa ya nos tiró 429, dejamos de pedir el
        // minuto a minuto de las divisiones menos vistas para que a Primera no le
        // falte cupo. El marcador de las tres sigue saliendo de Leverade igual.
        .filter((m) => (DIVISION_EVENT_PRIORITY[m.division] ?? 9) <= 2 - arusaDegradeLevel())
        // Y dentro de lo permitido, Primera va primero en la cola.
        .sort((a, b) =>
          (DIVISION_EVENT_PRIORITY[a.division] ?? 9) - (DIVISION_EVENT_PRIORITY[b.division] ?? 9)
          || (lastEventScrape.get(a.matchId) ?? 0) - (lastEventScrape.get(b.matchId) ?? 0))
        .slice(0, GLOBAL_EVENT_SCRAPES_PER_TICK)
        .map((m) => m.matchId),
    );
    for (const id of grantees) {
      lastEventScrape.set(id, nowTick);
      const gm = todays.find((x) => x.matchId === id);
      if (gm) lastScrapedScore.set(id, scoreKey(gm));
    }

    // Run sequentially to keep load on arusa modest. ~5–15 matches per day.
    for (const m of todays) {
      try {
        // Postergado/cancelado: no se juega, nunca "en vivo" — lo sacamos del feed
        // (borrando cualquier fila fantasma 0-0 que haya quedado) en vez de procesarlo.
        if (m.postponed || m.canceled) {
          await dropPhantomMatch(m);
          continue;
        }
        await processMatch(m, grantees.has(m.matchId));
      } catch (e) {
        console.error(`[poller] match ${m.matchId} failed:`, e);
      }
    }
  } catch (e) {
    console.error("[poller] error:", e);
  }
}
