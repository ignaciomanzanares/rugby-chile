"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Medal, ArrowRight, Trophy, Users } from "lucide-react";
import { fetchSeven, type SevenCircuito, type SevenPartido } from "@/lib/seven-api";
import { useAhora, hoyEnChile } from "@/lib/use-ahora";
import { estadoDe, enVivoDe } from "@/lib/seven-vivo";

/** "2026-11-07" → "Sáb 7 Nov". A mano para que no lo corra la zona horaria. */
function dia(iso: string | null): string {
  if (!iso) return "Día por confirmar";
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  const nd = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][f.getDay()];
  const nm = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m - 1];
  return `${nd} ${d} ${nm}`;
}

/**
 * El seven en el panel principal.
 *
 * Encabeza el home porque es lo que se está jugando: el Top 10 terminó el 3 de
 * octubre y el circuito sigue. Tiene que servir los tres momentos del circuito
 * sin que haya que entrar a /seven:
 *
 *  - el sábado del torneo: qué se está jugando AHORA, con su marcador;
 *  - cargada la etapa siguiente: a qué hora juega cada uno;
 *  - entre fechas, que es casi siempre: cómo quedan los GRUPOS de la que viene
 *    —que se pueden saber antes de que ARUSA cargue nada— y la tabla.
 */
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

const COLOR: Record<string, string> = {
  Oro: "text-amber-500", Plata: "text-slate-400", Bronce: "text-orange-600",
};

/** Una fila de partido: hora, escudos y marcador, con el en vivo marcado. */
function FilaPartido({ p, logos, ahora }: { p: SevenPartido; logos: Map<string, string>; ahora: number | null }) {
  const estado = estadoDe(p, ahora);
  const vivo = estado === "vivo";
  const jugado = p.homeScore != null && p.awayScore != null;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${vivo ? "bg-red-600/5" : ""}`}>
      <span className={`text-[10px] tabular-nums w-9 flex-shrink-0 ${vivo ? "text-red-500 font-bold" : "text-muted-foreground/70"}`}>
        {p.hora}
      </span>
      <Escudo nombre={p.home} logos={logos} size={22} />
      <span className="text-xs font-medium truncate flex-1 min-w-0">{p.home}</span>
      <span className="flex flex-col items-center leading-tight flex-shrink-0 w-12">
        {jugado ? (
          <span className="text-sm font-black tabular-nums">{p.homeScore}-{p.awayScore}</span>
        ) : (
          <span className={`text-[9px] font-bold tracking-widest ${vivo ? "text-red-500" : "text-muted-foreground/50"}`}>
            {vivo ? "···" : "VS"}
          </span>
        )}
        {vivo && (
          <span className="flex items-center gap-1 text-[8px] font-bold tracking-widest uppercase text-red-500">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />En vivo
          </span>
        )}
      </span>
      <span className="text-xs font-medium truncate flex-1 min-w-0 text-right">{p.away}</span>
      <Escudo nombre={p.away} logos={logos} size={22} />
    </div>
  );
}

export function HomeSevenSection({ initial }: { initial: SevenCircuito | null }) {
  const [data, setData] = useState<SevenCircuito | null>(initial);
  const ahora = useAhora();
  const hoy = hoyEnChile(ahora);

  useEffect(() => {
    if (initial) return;
    let vivo = true;
    fetchSeven({ cache: "no-store" }).then((d) => { if (vivo) setData(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [initial]);

  // El día del torneo el home también se refresca solo: con el shell ISR de dos
  // minutos, una pestaña abierta se quedaba con el marcador de cuando entró.
  const hayTorneoHoy = !!hoy && (data?.etapas ?? []).some((e) => e.fecha === hoy && !e.jugada);
  useEffect(() => {
    if (!hayTorneoHoy) return;
    const t = setInterval(() => {
      fetchSeven({ cache: "no-store" }).then((d) => { if (d) setData(d); }).catch(() => {});
    }, 60_000);
    return () => clearInterval(t);
  }, [hayTorneoHoy]);

  // Mismo cuidado que en /seven: el payload puede venir de una API más vieja
  // que esta pantalla.
  if (!data || !data.tabla?.length) return null;
  const etapas = data.etapas ?? [];
  const logos = new Map((data.equipos ?? []).filter((e) => e.logo).map((e) => [e.name, e.logo!]));
  const oficial = data.oficial ?? [];
  // La etapa cargada que todavía no se juega, y la última que sí. "La primera
  // sin jugar" no necesita el reloj: da lo mismo en el servidor y en el cliente.
  const porJugar = etapas.find((e) => !e.jugada);
  const ultimaJugada = [...etapas].reverse().find((e) => e.jugada);
  // Los grupos de la fecha que viene cuando ARUSA no la cargó. Se lee a la
  // defensiva: la API y la web se despliegan por separado.
  const proxima = !porJugar ? data.proxima ?? null : null;

  const vivos = enVivoDe(porJugar, ahora);
  const esHoy = !!hoy && !!porJugar && porJugar.fecha === hoy;
  const siguientes = (porJugar
    ? [...(porJugar.grupos ?? []), ...(porJugar.copas ?? [])]
        .flatMap((g) => g.partidos ?? [])
        .filter((m) => m.home && m.away && m.homeScore == null && estadoDe(m, ahora) !== "vivo")
        .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""))
    : []).slice(0, 4);

  const numero = porJugar?.numero ?? proxima?.numero ?? ultimaJugada?.numero;
  const fecha = porJugar?.fecha ?? proxima?.fecha ?? null;
  const chip =
    vivos.length > 0 ? `${vivos.length} en vivo`
    : esHoy ? "Hoy"
    : porJugar || proxima ? dia(fecha)
    : ultimaJugada ? dia(ultimaJugada.fecha)
    : "";

  return (
    <section className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          {vivos.length > 0
            ? <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse flex-shrink-0" />
            : <Medal className="h-4 w-4 text-amber-500 flex-shrink-0" />}
          <h2 className="font-black uppercase tracking-widest text-sm sm:text-base truncate">
            Circuito de Seven{numero ? ` · Etapa ${numero}` : ""}
          </h2>
          <span className={`text-[10px] font-bold tracking-widest uppercase flex-shrink-0 ${vivos.length > 0 || esHoy ? "text-red-500" : "text-muted-foreground"}`}>
            {chip}
          </span>
        </div>
        <Link href="/seven" className="text-xs text-muted-foreground hover:text-foreground/80 flex items-center gap-1 transition-colors flex-shrink-0">
          Ver todo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">

        {/* Lo que se juega: en vivo, lo que viene, o los grupos de la próxima. */}
        <div className="lg:col-span-2 space-y-4">
          {vivos.length > 0 && (
            <div className="rounded-xl border border-red-600/40 bg-red-600/5 overflow-hidden divide-y divide-border/40">
              {vivos.map((m) => <FilaPartido key={m.id} p={m} logos={logos} ahora={ahora} />)}
            </div>
          )}

          {siguientes.length > 0 && (
            <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
              <p className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground border-b border-border/60">
                {vivos.length > 0 ? "Después" : "Los que vienen"}
              </p>
              <div className="divide-y divide-border/40">
                {siguientes.map((m) => <FilaPartido key={m.id} p={m} logos={logos} ahora={ahora} />)}
              </div>
            </div>
          )}

          {proxima && (proxima.grupos ?? []).length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                <Users className="h-3 w-3" />
                Los grupos de la Etapa {proxima.numero}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {proxima.grupos.map((g) => (
                  <div key={g.nombre} className="rounded-xl border border-dashed border-border bg-card/30 overflow-hidden">
                    <p className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-muted-foreground border-b border-dashed border-border/60">
                      {g.nombre}
                    </p>
                    <ul className="divide-y divide-border/40">
                      {g.equipos.map((t) => (
                        <li key={t} className="flex items-center gap-2 px-3 py-1.5">
                          <Escudo nombre={t} logos={logos} size={20} />
                          <span className="text-xs font-medium truncate">{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/80 mt-2">
                ARUSA todavía no carga el día ni los partidos. Los grupos los sembramos con la
                clasificación de la Etapa {ultimaJugada?.numero ?? ""}, igual que los de la fecha pasada.
              </p>
            </div>
          )}

          {/* Las copas de la última etapa jugada: es lo que uno recuerda del día. */}
          {ultimaJugada && (ultimaJugada.copas ?? []).length > 0 && vivos.length === 0 && (
            <div className="grid grid-cols-3 gap-3">
              {(ultimaJugada.copas ?? []).map((c) => (
                <div key={c.nombre} className="rounded-xl border border-border bg-card/50 p-3">
                  <span className={`flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase mb-2 ${COLOR[c.nombre] ?? ""}`}>
                    <Trophy className="h-3 w-3" />{c.nombre}
                  </span>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Escudo nombre={c.campeon} logos={logos} size={22} />
                    <span className="text-xs font-bold truncate">{c.campeon ?? "—"}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* La tabla del circuito, que es lo que define la temporada. */}
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden self-start">
          <p className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground border-b border-border/60">
            {oficial.length > 0 ? "Tabla del circuito" : "Rendimiento en cancha"}
          </p>
          <ul className="divide-y divide-border/40">
            {oficial.length > 0
              ? oficial.slice(0, 6).map((f) => (
                  <li key={f.team} className="flex items-center gap-2.5 px-3 py-2">
                    <span className="w-5 text-center text-[10px] font-bold tabular-nums text-muted-foreground flex-shrink-0">{f.pos}</span>
                    <Escudo nombre={f.team} logos={logos} size={22} />
                    <span className="text-sm font-medium truncate flex-1 min-w-0">{f.team}</span>
                    <span className="text-sm font-black tabular-nums w-7 text-right">{f.pts}</span>
                  </li>
                ))
              : data.tabla.slice(0, 6).map((f) => (
                  <li key={f.team} className="flex items-center gap-2.5 px-3 py-2">
                    <span className="w-5 text-center text-[10px] font-bold tabular-nums text-muted-foreground flex-shrink-0">{f.pos}</span>
                    <Escudo nombre={f.team} logos={logos} size={22} />
                    <span className="text-sm font-medium truncate flex-1 min-w-0">{f.team}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{f.pj}PJ</span>
                    <span className="text-sm font-black tabular-nums w-7 text-right">{f.pts}</span>
                  </li>
                ))}
          </ul>
          <Link href="/seven" className="block px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground/80 border-t border-border/60 transition-colors">
            La tabla completa <ArrowRight className="h-3 w-3 inline" />
          </Link>
        </div>

      </div>
    </section>
  );
}
