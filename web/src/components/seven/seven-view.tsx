"use client";

import { useEffect, useState } from "react";
import { Trophy, Medal, Calendar, Info } from "lucide-react";
import { fetchSeven, type SevenCircuito, type SevenPartido, type SevenEtapa } from "@/lib/seven-api";

/**
 * El circuito de seven.
 *
 * Vive aparte del XV porque es otro deporte en la práctica: una ETAPA entera se
 * juega en un día —cuatro grupos de tres y después tres copas— y lo que define
 * la temporada es la tabla acumulada, no una fecha contra otra. Meterlo en el
 * navegador de 18 fechas del Top 10 habría sido forzarlo.
 *
 * Son DOCE equipos, no los diez del Top 10: entran CDA, Gauchos RC, Old
 * Georgians y Old Newlanders, y no juegan Sporting RC ni Old Johns. Por eso los
 * escudos salen del propio circuito (Leverade los publica) en vez del mapa de
 * clubes de la app, que sólo conoce los diez del XV.
 */
const ORO = "Oro", PLATA = "Plata";

function colorCopa(nombre: string) {
  if (nombre === ORO) return { anillo: "ring-amber-400/60", texto: "text-amber-500", fondo: "bg-amber-400/5" };
  if (nombre === PLATA) return { anillo: "ring-slate-400/60", texto: "text-slate-400", fondo: "bg-slate-400/5" };
  return { anillo: "ring-orange-700/50", texto: "text-orange-600", fondo: "bg-orange-700/5" };
}

/** "2026-10-24" → "Sáb 24 Oct". A mano para que no lo corra la zona horaria. */
function dia(iso: string | null): string {
  if (!iso) return "Día por confirmar";
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  const nd = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][f.getDay()];
  const nm = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m - 1];
  return `${nd} ${d} ${nm}`;
}

/**
 * Hoy en Chile, pero recién DESPUÉS de montar.
 *
 * Leer el reloj durante el render rompe la hidratación: /seven es estática y su
 * HTML se genera cuando Next revalida, así que el "hoy" del servidor y el del
 * visitante pueden ser días distintos —y el visitante puede estar en otra zona.
 * Mientras no monta devuelve null y la pantalla no afirma nada sobre hoy.
 */
function useHoyEnChile(): string | null {
  const [hoy, setHoy] = useState<string | null>(null);
  useEffect(() => {
    setHoy(new Date(Date.now() - 3 * 60 * 60_000).toISOString().slice(0, 10));
  }, []);
  return hoy;
}

/** ISO → "13:02" en hora de Chile. */
function horaChile(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t - 3 * 60 * 60_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** ISO → "2026-11-07" en hora de Chile, para saber de qué etapa es un evento. */
function fechaChile(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t - 3 * 60 * 60_000).toISOString().slice(0, 10);
}

/**
 * Cómo se nombra cada evento. "puntos" son los que NO vienen del try propio
 * —conversión o penal—: el cuadro de ARUSA no los separa, así que se dice
 * "pateó" y la cantidad en puntos, sin adivinar de qué fue cada uno.
 */
const NOMBRE_EVENTO: Record<string, string> = {
  try: "Try", "try penal": "Try penal", conversión: "Conversión",
  penal: "Penal", drop: "Drop", amarilla: "Amarilla", roja: "Roja",
  // Red de seguridad: lo que los contadores de ARUSA no explican. Antes acá
  // caían TODAS las patadas, porque leíamos cuatro de las trece columnas.
  puntos: "Pateó",
};

/** Lo que suma puntos se destaca; las tarjetas y el resto van apagados. */
const COLOR_EVENTO = (tipo: string) =>
  tipo === "try" || tipo === "try penal"
    ? "text-emerald-500"
    : tipo === "conversión" || tipo === "penal" || tipo === "drop"
      ? "text-sky-500"
      : "text-muted-foreground";

function Escudo({ nombre, logos, size = 28 }: { nombre: string | null; logos: Map<string, string>; size?: number }) {
  const src = nombre ? logos.get(nombre) : undefined;
  if (!src) {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-muted inline-flex items-center justify-center text-[9px] font-bold text-foreground/70 flex-shrink-0"
      >
        {(nombre ?? "?").slice(0, 2).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={nombre ?? ""} width={size} height={size} className="rounded-full object-cover ring-1 ring-border flex-shrink-0" />;
}

function Fila({ p, logos }: { p: SevenPartido; logos: Map<string, string> }) {
  const jugado = p.homeScore != null && p.awayScore != null;
  const ganaLocal = jugado && p.homeScore! > p.awayScore!;
  const ganaVisita = jugado && p.awayScore! > p.homeScore!;
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm">
      {p.hora && <span className="text-[10px] tabular-nums text-muted-foreground/60 w-9 flex-shrink-0">{p.hora}</span>}
      <span className="flex items-center gap-1.5 flex-1 min-w-0 justify-end text-right">
        <span className={`truncate ${ganaLocal ? "font-bold" : ""}`}>{p.home ?? "—"}</span>
        <Escudo nombre={p.home} logos={logos} size={22} />
      </span>
      <span className="flex items-center gap-1.5 tabular-nums font-black flex-shrink-0 w-14 justify-center">
        {jugado ? (
          <>
            <span className={ganaLocal ? "" : "text-muted-foreground"}>{p.homeScore}</span>
            <span className="text-muted-foreground/40 font-normal">-</span>
            <span className={ganaVisita ? "" : "text-muted-foreground"}>{p.awayScore}</span>
          </>
        ) : (
          <span className="text-muted-foreground/60 text-[10px] font-bold tracking-widest">VS</span>
        )}
      </span>
      <span className="flex items-center gap-1.5 flex-1 min-w-0">
        <Escudo nombre={p.away} logos={logos} size={22} />
        <span className={`truncate ${ganaVisita ? "font-bold" : ""}`}>{p.away ?? "—"}</span>
      </span>
    </div>
  );
}

/**
 * Todos los partidos de una etapa ordenados por hora, grupos y copas juntos.
 *
 * Los cruces de las copas se sortean recién con los grupos jugados, así que
 * hasta entonces vienen sin equipos: esos no se muestran, porque un "— vs —"
 * no le dice nada a nadie.
 */
function partidosDelDia(e: SevenEtapa): SevenPartido[] {
  return [...(e.grupos ?? []), ...(e.copas ?? [])]
    .flatMap((g) => g.partidos ?? [])
    .filter((p) => p.home && p.away)
    .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
}

export function SevenView({ initial }: { initial: SevenCircuito | null }) {
  const [data, setData] = useState<SevenCircuito | null>(initial);
  const [cargando, setCargando] = useState(!initial);
  const hoy = useHoyEnChile();

  // Reintenta desde el cliente: el shell se genera cada 5 min y la API duerme
  // en el plan Free de Render, así que un fallo del servidor no puede dejar la
  // página vacía para siempre.
  useEffect(() => {
    if (initial) return;
    let vivo = true;
    fetchSeven({ cache: "no-store" })
      .then((d) => { if (vivo) { setData(d); setCargando(false); } })
      .catch(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [initial]);

  // El día del torneo, refrescar solo. La página es estática con revalidate de
  // 5 min, así que una pestaña abierta se quedaba congelada toda la jornada: el
  // sábado hay un partido cada veinte minutos. Se enciende únicamente si hay
  // una etapa fechada hoy a la que le faltan partidos, y se apaga al terminar.
  const hayTorneoHoy = !!hoy && (data?.etapas ?? []).some((e) => e.fecha === hoy && !e.jugada);
  useEffect(() => {
    if (!hayTorneoHoy) return;
    const t = setInterval(() => {
      fetchSeven({ cache: "no-store" }).then((d) => { if (d) setData(d); }).catch(() => {});
    }, 60_000);
    return () => clearInterval(t);
  }, [hayTorneoHoy]);

  const logos = new Map((data?.equipos ?? []).filter((e) => e.logo).map((e) => [e.name, e.logo!]));

  if (cargando) {
    return <p className="text-center py-16 text-sm text-muted-foreground animate-pulse">Cargando el circuito…</p>;
  }
  if (!data || !data.tabla) {
    return (
      <p className="text-center py-16 text-sm text-muted-foreground">
        No pudimos cargar el circuito de seven. Probá recargar en un momento.
      </p>
    );
  }

  // La API y la web se despliegan por separado, así que la web PUEDE recibir un
  // payload más viejo que ella —y lo hizo: el build de Vercel reventó
  // prerenderizando /seven contra una API que aún no tenía `clasificacion`.
  // Todo campo nuevo se lee con su valor por defecto.
  const etapas = data.etapas ?? [];
  const jugadores = data.jugadores ?? [];
  const sinPuntos = data.sinPuntos ?? [];
  // La última etapa JUGADA es la que tiene copas y clasificación que mostrar.
  // Antes se tomaba la última a secas y, con la etapa 2 ya cargada en Leverade
  // pero sin jugarse, la página encabezaba con tres copas vacías y escondía la
  // clasificación del 24-oct, que era lo único que había pasado.
  const ultimaJugada = [...etapas].reverse().find((e) => e.jugada);
  const clasificacion = ultimaJugada?.clasificacion ?? [];
  // La etapa en juego o la que viene. A propósito NO se compara con la fecha de
  // hoy: eso obligaría a leer el reloj en el render y el HTML estático quedaría
  // afirmando un día distinto al del visitante. "La primera sin jugar" da el
  // mismo resultado en el servidor y en el navegador.
  const enCancha = etapas.find((e) => !e.jugada);
  const esHoy = !!enCancha && enCancha.fecha === hoy;
  const delDia = enCancha ? partidosDelDia(enCancha) : [];
  const porJugar = delDia.filter((p) => p.homeScore == null);
  // Lo que pasó, con nombres: los eventos cuya ventana cae en el día de la
  // etapa que manda. Se compara contra la fecha de la ETAPA, no contra el reloj
  // del visitante.
  //
  // Si no hay etapa en curso se usa la última JUGADA: filtrando sólo por
  // `enCancha`, el domingo siguiente al torneo la sección desaparecía entera y
  // se perdía el registro de quién anotó —que es el dato más nuevo que tiene la
  // app— hasta que ARUSA fechara la etapa siguiente.
  const fechaEventos = enCancha?.fecha ?? ultimaJugada?.fecha ?? null;
  const eventos = (data.eventos ?? []).filter(
    (e) => !!fechaEventos && fechaChile(e.hasta) === fechaEventos,
  );
  const eventosEnVivo = !!enCancha && fechaEventos === enCancha.fecha;

  return (
    <div className="space-y-10">
      {/* La etapa en juego o la que viene. Encabeza la página porque el sábado
          del torneo lo que uno busca es a qué hora juega su club, no la tabla.
          Grupos y copas van en una sola lista por hora: así se lee como el
          programa del día, que es lo que es. */}
      {enCancha && delDia.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            {esHoy
              ? <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse flex-shrink-0" />
              : <Calendar className="h-4 w-4 text-primary" />}
            <h2 className="font-bold uppercase tracking-widest text-sm">
              Etapa {enCancha.numero} · {dia(enCancha.fecha)}
            </h2>
            <span className={`text-[10px] font-bold tracking-widest uppercase ${esHoy ? "text-red-500" : "text-muted-foreground"}`}>
              {esHoy ? "Hoy" : "Próxima"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-4">
            {porJugar.length > 0
              ? `${porJugar.length} de ${delDia.length} por jugar · desde las ${porJugar[0].hora}. `
              : `${delDia.length} partidos jugados. `}
            Los cruces de las copas se sortean con los grupos ya jugados, así que aparecen
            cuando ARUSA los carga.
          </p>
          <div className="rounded-xl border border-border bg-card/50 overflow-hidden divide-y divide-border/40">
            {delDia.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="pl-3 text-[9px] font-bold tracking-widest uppercase text-muted-foreground/50 w-16 flex-shrink-0 truncate">
                  {p.grupo.replace(/^(PlayOFF|Semifinales)\s+/i, "")}
                </span>
                <span className="flex-1 min-w-0"><Fila p={p} logos={logos} /></span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lo que va pasando, CON NOMBRES.
          El minuto a minuto de arusa (/match/*) está detrás del proof-of-work,
          pero su cuadro de estadísticas responde 200. Cada refresco del
          circuito es una foto de ese cuadro, y de la diferencia con la anterior
          sale quién anotó. El minuto es la ventana entre fotos —dos minutos el
          día del torneo—, no el reloj del partido: se dice así y no se finge
          una precisión que no tenemos. */}
      {eventos.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Medal className="h-4 w-4 text-primary" />
            <h2 className="font-bold uppercase tracking-widest text-sm">
              {eventosEnVivo ? "Lo que va pasando" : `Quién anotó · Etapa ${ultimaJugada?.numero ?? ""}`}
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground mb-4">
            Quién anotó, de las planillas de ARUSA. La hora es cuándo lo vimos cargado,
            no el minuto del partido.
          </p>
          <ol className="rounded-xl border border-border bg-card/50 overflow-hidden divide-y divide-border/40">
            {eventos.slice(0, 15).map((e, i) => (
              <li key={`${e.hasta}|${e.jugador}|${e.tipo}|${i}`} className="flex items-center gap-2.5 px-3 py-2">
                <span className="text-[10px] tabular-nums text-muted-foreground/60 w-9 flex-shrink-0">
                  {horaChile(e.hasta)}
                </span>
                <Escudo nombre={e.equipo} logos={logos} size={22} />
                <span className="text-sm truncate flex-1 min-w-0">{e.jugador}</span>
                {e.tipo === "amarilla" && <span className="w-3 h-4 rounded-[2px] bg-yellow-400 flex-shrink-0" />}
                {e.tipo === "roja" && <span className="w-3 h-4 rounded-[2px] bg-red-600 flex-shrink-0" />}
                <span className={`text-[10px] font-bold tracking-widest uppercase flex-shrink-0 ${COLOR_EVENTO(e.tipo)}`}>
                  {NOMBRE_EVENTO[e.tipo] ?? e.tipo}
                  {e.tipo === "puntos"
                    ? ` ${e.cantidad} pts`
                    : e.cantidad > 1 && ` ×${e.cantidad}`}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Las copas de la última etapa JUGADA: es lo primero que uno quiere
          saber de un día de seven, más que cualquier tabla. */}
      {ultimaJugada && (ultimaJugada.copas ?? []).length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="font-bold uppercase tracking-widest text-sm">
              Etapa {ultimaJugada.numero} · {dia(ultimaJugada.fecha)}
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {(ultimaJugada.copas ?? []).map((c) => {
              const col = colorCopa(c.nombre);
              return (
                <div key={c.nombre} className={`rounded-xl border border-border ${col.fondo} p-4`}>
                  <span className={`flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase ${col.texto} mb-3`}>
                    <Medal className="h-3.5 w-3.5" />Copa de {c.nombre}
                  </span>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Escudo nombre={c.campeon} logos={logos} size={34} />
                    <span className="min-w-0">
                      <span className="block font-bold text-sm truncate">{c.campeon ?? "—"}</span>
                      <span className="block text-[10px] text-muted-foreground">Campeón</span>
                    </span>
                    <span className="ml-auto text-lg font-black tabular-nums">{c.campeonScore}</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-70">
                    <Escudo nombre={c.finalista} logos={logos} size={22} />
                    <span className="text-xs truncate">{c.finalista ?? "—"}</span>
                    <span className="ml-auto text-sm font-bold tabular-nums text-muted-foreground">{c.finalistaScore}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* La CLASIFICACIÓN de la etapa: en un circuito de seven es la moneda
          real, más que cualquier suma de puntos. */}
      {clasificacion.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="h-4 w-4 text-primary" />
            <h2 className="font-bold uppercase tracking-widest text-sm">
              Clasificación · Etapa {ultimaJugada!.numero}
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground mb-4">
            La Copa de Oro reparte los puestos 1 a 4, la de Plata del 5 al 8 y la de Bronce del 9 al 12.
          </p>
          <ol className="rounded-xl border border-border overflow-hidden divide-y divide-border/50">
            {clasificacion.map((p) => (
              <li key={p.team} className="flex items-center gap-3 px-3 py-2">
                <span className={`w-6 text-center text-xs font-black tabular-nums flex-shrink-0 ${p.pos <= 4 ? "text-amber-500" : p.pos <= 8 ? "text-slate-400" : "text-orange-600"}`}>
                  {p.pos}
                </span>
                <Escudo nombre={p.team} logos={logos} size={24} />
                <span className="font-medium text-sm truncate flex-1 min-w-0">{p.team}</span>
                <span className="text-[10px] text-muted-foreground text-right">
                  {p.detalle === "Semifinal" ? `Semifinal de ${p.copa}` : `${p.detalle} · ${p.copa}`}
                  {p.margen != null && <span className="text-muted-foreground/60"> · perdió por {p.margen}</span>}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-muted-foreground/70 mt-2">
            Entre los dos semifinalistas de una copa ordenamos por el margen de la derrota.
            ARUSA no publica su criterio de desempate.
          </p>
        </section>
      )}

      {/* La tabla OFICIAL. Durante semanas dijimos que ARUSA no la publicaba
          abierta: la tenía cargada a mano en Leverade todo este tiempo, en un
          grupo de partidos ficticios cuyo score lleva los puntos. Comprobada
          contra nuestra clasificación del 24-oct: los doce puestos coinciden. */}
      {(data.oficial ?? []).length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="font-bold uppercase tracking-widest text-sm">Tabla del circuito</h2>
            <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Oficial</span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-4">
            Los puntos que ARUSA carga por etapa según el puesto: el 24-oct fueron 22 para el
            campeón de Oro y 1 para el último de Bronce.
          </p>
          <ol className="rounded-xl border border-border overflow-hidden divide-y divide-border/50">
            {(data.oficial ?? []).map((f) => (
              <li key={f.team} className="flex items-center gap-3 px-3 py-2">
                <span className={`w-6 text-center text-xs font-black tabular-nums flex-shrink-0 ${f.pos <= 4 ? "text-amber-500" : f.pos <= 8 ? "text-slate-400" : "text-orange-600"}`}>
                  {f.pos}
                </span>
                <Escudo nombre={f.team} logos={logos} size={24} />
                <span className="font-medium text-sm truncate flex-1 min-w-0">{f.team}</span>
                {(f.porJornada ?? []).length > 1 && (
                  <span className="text-[10px] tabular-nums text-muted-foreground/70 hidden sm:inline">
                    {(f.porJornada ?? []).map((j) => j.pts).join(" + ")}
                  </span>
                )}
                <span className="text-sm font-black tabular-nums w-7 text-right">{f.pts}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Nuestra cuenta del rendimiento en cancha. Es otra cosa que la tabla de
          arriba: acá están los jugados, los puntos a favor y la diferencia, que
          la oficial no publica. */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="h-4 w-4 text-primary" />
          <h2 className="font-bold uppercase tracking-widest text-sm">Rendimiento en cancha</h2>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          Nuestra cuenta, partido por partido: jugados, ganados y la diferencia de puntos.
          La columna Pts son los puntos de liga que da Leverade (victoria 3, derrota 1, más
          bonus){(data.oficial ?? []).length > 0 ? ", que es otra cuenta que la de la tabla oficial de arriba." : "."}
        </p>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-bold">#</th>
                <th className="text-left px-1 py-2 font-bold">Equipo</th>
                <th className="text-center px-2 py-2 font-bold">PJ</th>
                <th className="text-center px-2 py-2 font-bold hidden sm:table-cell">G</th>
                <th className="text-center px-2 py-2 font-bold hidden sm:table-cell">P</th>
                <th className="text-center px-2 py-2 font-bold">Dif</th>
                <th className="text-center px-3 py-2 font-bold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {(data.tabla ?? []).map((f) => (
                <tr key={f.team} className="border-t border-border/60">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{f.pos}</td>
                  <td className="px-1 py-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <Escudo nombre={f.team} logos={logos} size={24} />
                      <span className="truncate font-medium">{f.team}</span>
                    </span>
                  </td>
                  <td className="text-center px-2 py-2 tabular-nums text-muted-foreground">{f.pj}</td>
                  <td className="text-center px-2 py-2 tabular-nums text-muted-foreground hidden sm:table-cell">{f.pg}</td>
                  <td className="text-center px-2 py-2 tabular-nums text-muted-foreground hidden sm:table-cell">{f.pp}</td>
                  <td className={`text-center px-2 py-2 tabular-nums ${f.diff > 0 ? "text-emerald-600" : f.diff < 0 ? "text-muted-foreground" : ""}`}>
                    {f.diff > 0 ? "+" : ""}{f.diff}
                  </td>
                  <td className="text-center px-3 py-2 tabular-nums font-black">{f.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sinPuntos.length > 0 && (
          <p className="flex items-start gap-1.5 text-[11px] text-amber-500 mt-2">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
            <span>
              ARUSA no asignó puntos de liga en{" "}
              {sinPuntos.map((s) => `${s.home} vs ${s.away}`).join(", ")}
              . La tabla los cuenta como 0 porque es lo que publica la fuente.
            </span>
          </p>
        )}
      </section>

      {/* Quién anotó. Es el dato que no teníamos: sale del endpoint de
          estadísticas de arusa, el único que no está detrás del muro. */}
      {jugadores.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Medal className="h-4 w-4 text-primary" />
            <h2 className="font-bold uppercase tracking-widest text-sm">Quién anotó</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mb-4">
            Fase de grupos del circuito. ARUSA no carga estadísticas de jugador en las copas,
            así que los tries de semifinales y finales no están acá.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
              <p className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground border-b border-border/60">
                Tries
              </p>
              <ul className="divide-y divide-border/40">
                {jugadores.filter((j) => j.tries > 0).slice(0, 8).map((j) => (
                  <li key={`${j.nombre}|${j.equipo}`} className="flex items-center gap-2.5 px-3 py-2">
                    <Escudo nombre={j.equipo} logos={logos} size={22} />
                    <span className="text-sm truncate flex-1 min-w-0">{j.nombre}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{j.puntos} pts</span>
                    <span className="text-sm font-black tabular-nums w-5 text-right">{j.tries}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
              <p className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground border-b border-border/60">
                Tarjetas
              </p>
              <ul className="divide-y divide-border/40">
                {jugadores.filter((j) => j.amarillas > 0 || j.rojas > 0).map((j) => (
                  <li key={`t-${j.nombre}|${j.equipo}`} className="flex items-center gap-2.5 px-3 py-2">
                    <Escudo nombre={j.equipo} logos={logos} size={22} />
                    <span className="text-sm truncate flex-1 min-w-0">{j.nombre}</span>
                    {j.amarillas > 0 && <span className="w-3 h-4 rounded-[2px] bg-yellow-400 flex-shrink-0" title={`${j.amarillas} amarilla(s)`} />}
                    {j.rojas > 0 && <span className="w-3 h-4 rounded-[2px] bg-red-600 flex-shrink-0" title={`${j.rojas} roja(s)`} />}
                  </li>
                ))}
                {jugadores.every((j) => !j.amarillas && !j.rojas) && (
                  <li className="px-3 py-3 text-xs text-muted-foreground">Sin tarjetas en la fase de grupos.</li>
                )}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Las etapas, con sus grupos */}
      {etapas.map((e) => (
        <section key={e.numero}>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="font-bold uppercase tracking-widest text-sm">
              Etapa {e.numero} · {dia(e.fecha)}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {(e.grupos ?? []).map((g) => (
              <div key={g.nombre} className="rounded-xl border border-border bg-card/50 overflow-hidden">
                <p className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground border-b border-border/60">
                  {g.nombre}
                </p>
                <div className="divide-y divide-border/40">
                  {g.partidos.map((p) => <Fila key={p.id} p={p} logos={logos} />)}
                </div>
              </div>
            ))}
          </div>
          {(e.copas ?? []).length > 0 && (
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              {(e.copas ?? []).map((c) => (
                <div key={c.nombre} className="rounded-xl border border-border bg-card/50 overflow-hidden">
                  <p className={`px-3 py-2 text-[10px] font-bold tracking-widest uppercase border-b border-border/60 ${colorCopa(c.nombre).texto}`}>
                    Copa de {c.nombre}
                  </p>
                  <div className="divide-y divide-border/40">
                    {c.partidos.map((p) => <Fila key={p.id} p={p} logos={logos} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      <p className="text-xs text-muted-foreground/70 text-center">
        {data.nombre} · Datos oficiales de{" "}
        <a href="https://arusa.cl" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">arusa.cl</a>
      </p>
    </div>
  );
}
