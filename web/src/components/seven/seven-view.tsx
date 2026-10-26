"use client";

import { useEffect, useState } from "react";
import { Trophy, Medal, Calendar, Info } from "lucide-react";
import { fetchSeven, type SevenCircuito, type SevenPartido } from "@/lib/seven-api";

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

export function SevenView({ initial }: { initial: SevenCircuito | null }) {
  const [data, setData] = useState<SevenCircuito | null>(initial);
  const [cargando, setCargando] = useState(!initial);

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

  const logos = new Map((data?.equipos ?? []).filter((e) => e.logo).map((e) => [e.name, e.logo!]));

  if (cargando) {
    return <p className="text-center py-16 text-sm text-muted-foreground animate-pulse">Cargando el circuito…</p>;
  }
  if (!data) {
    return (
      <p className="text-center py-16 text-sm text-muted-foreground">
        No pudimos cargar el circuito de seven. Probá recargar en un momento.
      </p>
    );
  }

  const ultima = [...data.etapas].reverse()[0];

  return (
    <div className="space-y-10">
      {/* Las copas de la última etapa: es lo primero que uno quiere saber de un
          día de seven, más que cualquier tabla. */}
      {ultima && ultima.copas.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="font-bold uppercase tracking-widest text-sm">
              Etapa {ultima.numero} · {dia(ultima.fecha)}
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {ultima.copas.map((c) => {
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

      {/* Tabla acumulada */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="h-4 w-4 text-primary" />
          <h2 className="font-bold uppercase tracking-widest text-sm">Tabla acumulada del circuito</h2>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          Suma de todas las etapas. Victoria 3 puntos y derrota 1, más los bonus que asigna ARUSA.
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
              {data.tabla.map((f) => (
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
        {data.sinPuntos.length > 0 && (
          <p className="flex items-start gap-1.5 text-[11px] text-amber-500 mt-2">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
            <span>
              ARUSA no asignó puntos de liga en{" "}
              {data.sinPuntos.map((s) => `${s.home} vs ${s.away}`).join(", ")}
              . La tabla los cuenta como 0 porque es lo que publica la fuente.
            </span>
          </p>
        )}
      </section>

      {/* Las etapas, con sus grupos */}
      {data.etapas.map((e) => (
        <section key={e.numero}>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="font-bold uppercase tracking-widest text-sm">
              Etapa {e.numero} · {dia(e.fecha)}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {e.grupos.map((g) => (
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
          {e.copas.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              {e.copas.map((c) => (
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
