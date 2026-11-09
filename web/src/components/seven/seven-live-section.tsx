"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { fetchSeven, type SevenCircuito, type SevenPartido } from "@/lib/seven-api";
import { useAhora, hoyEnChile } from "@/lib/use-ahora";
import { estadoDe, enVivoDe } from "@/lib/seven-vivo";

/**
 * El seven en la pantalla de En Vivo.
 *
 * /live nació para el XV y vive del socket: arusa manda minuto y estado de cada
 * partido. El seven no tiene nada de eso —el muro tapa /match/*— así que acá se
 * arma con lo mismo que el resto de la app: la foto de Leverade, que el día del
 * torneo se refresca cada dos minutos, y la grilla de horarios para saber qué
 * está en juego (ver seven-vivo).
 *
 * Sólo aparece el día de una etapa. El resto del tiempo devuelve null y la
 * pantalla queda como estaba.
 */
export function SevenLiveSection({
  onEstado,
}: {
  /** Cuántos partidos de seven están en vivo y si hoy hay etapa. La pantalla
   *  lo necesita para su chapa y para no decir "no hay nada" con el seven en
   *  cancha. Tiene que ser una función ESTABLE (useCallback): se llama desde un
   *  efecto que escribe estado en el padre. */
  onEstado?: (vivos: number, hayEtapaHoy: boolean) => void;
}) {
  const [data, setData] = useState<SevenCircuito | null>(null);
  const ahora = useAhora();
  const hoy = hoyEnChile(ahora);

  useEffect(() => {
    let vivo = true;
    fetchSeven({ cache: "no-store" }).then((d) => { if (vivo) setData(d); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const etapaHoy = (data?.etapas ?? []).find((e) => !!hoy && e.fecha === hoy);
  const enJuego = !!etapaHoy && !etapaHoy.jugada;
  useEffect(() => {
    if (!enJuego) return;
    const t = setInterval(() => {
      fetchSeven({ cache: "no-store" }).then((d) => { if (d) setData(d); }).catch(() => {});
    }, 60_000);
    return () => clearInterval(t);
  }, [enJuego]);

  const vivos = enVivoDe(etapaHoy, ahora);
  const hayEtapaHoy = !!etapaHoy;
  useEffect(() => { onEstado?.(vivos.length, hayEtapaHoy); }, [vivos.length, hayEtapaHoy, onEstado]);

  if (!etapaHoy) return null;
  const logos = new Map((data?.equipos ?? []).filter((e) => e.logo).map((e) => [e.name, e.logo!]));
  const todos = [...(etapaHoy.grupos ?? []), ...(etapaHoy.copas ?? [])]
    .flatMap((g) => g.partidos ?? [])
    .filter((p) => p.home && p.away)
    .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
  const porVenir = todos.filter((p) => estadoDe(p, ahora) === "programado").slice(0, 5);
  const jugados = todos.filter((p) => p.finished).length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Seven · Etapa {etapaHoy.numero} · {jugados} de {todos.length} jugados
        </h2>
        <Link href="/seven" className="text-xs text-muted-foreground hover:text-foreground/80 flex items-center gap-1 transition-colors">
          Ver el circuito <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {vivos.length > 0 && (
        <div className="space-y-3">
          {vivos.map((p) => <TarjetaVivo key={p.id} p={p} logos={logos} />)}
        </div>
      )}

      {porVenir.length > 0 && (
        <div className="rounded-xl border border-border bg-card/30 overflow-hidden divide-y divide-border/40">
          {porVenir.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3">
              <span className="text-xs tabular-nums text-muted-foreground w-10 flex-shrink-0">{p.hora}</span>
              <Escudo nombre={p.home} logos={logos} size={24} />
              <span className="text-sm font-semibold truncate flex-1 min-w-0">{p.home}</span>
              <span className="text-[9px] font-bold tracking-widest text-muted-foreground/50 flex-shrink-0">VS</span>
              <span className="text-sm font-semibold truncate flex-1 min-w-0 text-right">{p.away}</span>
              <Escudo nombre={p.away} logos={logos} size={24} />
              <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/60 w-16 text-right flex-shrink-0 truncate">
                {p.grupo.replace(/^(PlayOFF|Semifinales)\s+/i, "")}
              </span>
            </div>
          ))}
        </div>
      )}

      {vivos.length === 0 && porVenir.length === 0 && (
        <p className="rounded-xl border border-border bg-card/30 px-5 py-4 text-sm text-muted-foreground">
          La etapa de hoy ya terminó. Los resultados y la clasificación están en{" "}
          <Link href="/seven" className="underline hover:text-foreground">el circuito</Link>.
        </p>
      )}
    </section>
  );
}

function Escudo({ nombre, logos, size = 24 }: { nombre: string | null; logos: Map<string, string>; size?: number }) {
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

/**
 * Un partido en juego. No se inventa el minuto: el seven no tiene reloj que
 * leer, así que se dice la hora programada y que está en vivo, y el marcador
 * sólo si Leverade ya lo trae.
 */
function TarjetaVivo({ p, logos }: { p: SevenPartido; logos: Map<string, string> }) {
  const hay = p.homeScore != null && p.awayScore != null;
  return (
    <div className="rounded-xl border border-red-600/40 bg-red-600/5 overflow-hidden">
      <div className="px-5 py-2 border-b border-red-600/20 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-red-500">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />En vivo
        </span>
        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/70">
          {p.grupo} · {p.hora}
        </span>
      </div>
      <div className="px-5 py-5 flex items-center justify-between gap-4">
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
          <Escudo nombre={p.home} logos={logos} size={56} />
          <span className="text-sm font-semibold text-center truncate w-full">{p.home}</span>
        </div>
        <div className="flex flex-col items-center flex-shrink-0">
          {hay ? (
            <span className="text-3xl font-black tabular-nums">{p.homeScore} - {p.awayScore}</span>
          ) : (
            <span className="text-xs text-muted-foreground text-center max-w-[9rem]">
              Todavía sin marcador cargado
            </span>
          )}
        </div>
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
          <Escudo nombre={p.away} logos={logos} size={56} />
          <span className="text-sm font-semibold text-center truncate w-full">{p.away}</span>
        </div>
      </div>
    </div>
  );
}
