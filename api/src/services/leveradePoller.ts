/**
 * Tournament poller — auto-creates/updates live_matches rows for today's
 * games and broadcasts them over Socket.IO together with their event timeline.
 *
 * Data sources (all auth-free):
 *  - Match metadata: Leverade's public /tournaments endpoint
 *  - Score:          arusa.cl match results page (server-rendered HTML)
 *  - Event timeline: arusa.cl /change-tab "minute_by_minute" (session + CSRF)
 *
 * No manual scoring required — everything originates from arusa.
 */

import { db } from "../db";
import { liveMatches, liveEvents } from "../db/schema";
import { eq, and, lt, inArray, isNull } from "drizzle-orm";
import { getIo } from "../plugins/live";
import {
  type MatchMeta,
  type ArusaEvent,
  fetchAllMatchesMeta,
  scrapeArusaScore,
  scrapeArusaEvents,
  pointsForEventType,
  isArusaBlocked,
} from "../lib/leverade";

// Último scrape del TIMELINE de eventos por partido (para throttlear el scrape
// pesado a ~90s y no saturar arusa). El marcador se sigue refrescando cada tick.
const lastEventScrape = new Map<string, number>();

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
const HALFTIME_MIN = 10;   // break — the game clock pauses here
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
  if (wall >= FULL_TIME_MIN && arusaSaysNearEnd) return "FINISHED";
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
async function processMatch(m: MatchMeta): Promise<void> {
  const force = !m.finished; // refresh fresh while in progress
  // El marcador se refresca cada tick (petición liviana), pero el TIMELINE de
  // eventos (getCsrf + POST, pesado) sólo cada ~90s por partido — así bajamos
  // mucho la carga a arusa (era lo que nos hacía ganar 429). Entre medio se sirve
  // de la caché de eventos (scrapeArusaEvents sin force).
  const nowMs = Date.now();
  const lastEv = lastEventScrape.get(m.matchId) ?? 0;
  const eventsForce = force && nowMs - lastEv >= 90_000;
  if (eventsForce) lastEventScrape.set(m.matchId, nowMs);
  // Resiliencia: si arusa falla (429/timeout) NO abortamos el partido. Sin esto,
  // processMatch tiraba error, la fila no se actualizaba y quedaba "vieja" → el
  // auto-finalizado la marcaba FINISHED aunque siguiera jugándose, y el marcador
  // desaparecía. Ahora seguimos con lo de Leverade + lo último conocido, y
  // marcamos arusaOk=false para no fabricar un minuto por reloj de pared.
  let arusaOk = true;
  const [score, events] = await Promise.all([
    scrapeArusaScore(m.matchId, { force }).catch(() => {
      arusaOk = false;
      return {} as Awaited<ReturnType<typeof scrapeArusaScore>>;
    }),
    scrapeArusaEvents(m.matchId, { force: eventsForce }).catch(() => {
      arusaOk = false;
      return [] as ArusaEvent[];
    }),
  ]);
  if (isArusaBlocked()) arusaOk = false;

  const existing = await db.query.liveMatches.findFirst({
    where: eq(liveMatches.leveradeMatchId, m.matchId),
  });

  // Evidencia de que el partido realmente arrancó (marcador de arusa o el
  // fallback de Leverade, o algún evento). Sin esto no lo marcamos LIVE pasada
  // la ventana de gracia (ver statusFor) para no inventar un 0-0 en vivo.
  const totalScore =
    (score.homeScore ?? m.homeScore ?? 0) + (score.awayScore ?? m.awayScore ?? 0);
  const started = totalScore > 0 || events.length > 0;
  // Minuto real desde el timeline de arusa (último evento con puntaje). Se usa
  // tanto para el display como para que statusFor no finalice de más un partido
  // con el datetime de Leverade mal (ver statusFor).
  const eventMinute = liveMinuteFromEvents(events);
  const newStatus = statusFor(m, started, eventMinute);
  const homeTries = countTries(events, "home");
  const awayTries = countTries(events, "away");

  // Minuto a mostrar: eventos de arusa; si no hay, se estima (ver más abajo).
  // Guard: un scrape parcial/vacío puede calcular un minuto mucho menor — si
  // bajaría el reloj más de 20', mantenemos el anterior (una baja chica es un
  // ajuste de deriva legítimo).
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
    // arusa OK pero sin eventos (0-0) o recién arrancó: estimación por reloj.
    minute = gameClock(minutesSince(m.datetime)).minute;
  }
  if (existing && minute < prev && prev - minute > 20) minute = prev;
  minute = Math.max(0, Math.min(80, minute));

  let live;
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
        homeScore: score.homeScore ?? m.homeScore ?? existing.homeScore,
        awayScore: score.awayScore ?? m.awayScore ?? existing.awayScore,
        homeTries,
        awayTries,
        updatedAt: new Date(),
      })
      .where(eq(liveMatches.id, existing.id))
      .returning();
  }

  // arusa is the authoritative event log — wipe and rewrite. Carry the running
  // score per event and tag the half (arusa resets the clock at the break, so a
  // minute that drops back marks the start of the 2nd half).
  await db.delete(liveEvents).where(eq(liveEvents.matchId, live.id));
  if (events.length > 0) {
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

  const dbEvents = await db
    .select()
    .from(liveEvents)
    .where(eq(liveEvents.matchId, live.id));

  broadcastUpdate({ ...live, events: dbEvents });
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

    // Run sequentially to keep load on arusa modest. ~5–15 matches per day.
    for (const m of todays) {
      try {
        // Leverade/arusa marcó el partido como postergado o cancelado: no se
        // juega en su horario. Nunca debe salir "en vivo" — lo sacamos del feed
        // (borrando cualquier fila fantasma 0-0 que haya quedado) en vez de
        // procesarlo. Si más tarde se juega de verdad, deja de estar marcado y
        // el poller lo vuelve a crear con su marcador real.
        if (m.postponed || m.canceled) {
          await dropPhantomMatch(m);
          continue;
        }
        await processMatch(m);
      } catch (e) {
        console.error(`[poller] match ${m.matchId} failed:`, e);
      }
    }
  } catch (e) {
    console.error("[poller] error:", e);
  }
}
