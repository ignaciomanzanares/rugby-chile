"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Medal, ArrowRight } from "lucide-react";
import { fetchSeven, type SevenCircuito } from "@/lib/seven-api";

/** "2026-11-07" → "Sáb 7 Nov". A mano para que no lo corra la zona horaria. */
function dia(iso: string | null): string {
  if (!iso) return "Por confirmar";
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  const nd = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][f.getDay()];
  const nm = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m - 1];
  return `${nd} ${d} ${nm}`;
}

/**
 * Hoy en Chile, recién después de montar. El home es estático: leer el reloj
 * durante el render haría que su HTML afirmara un día distinto al del visitante.
 */
function useHoyEnChile(): string | null {
  const [hoy, setHoy] = useState<string | null>(null);
  useEffect(() => {
    setHoy(new Date(Date.now() - 3 * 60 * 60_000).toISOString().slice(0, 10));
  }, []);
  return hoy;
}

/**
 * El seven en el panel.
 *
 * Existe porque el home seguía liderando con el Top 10 tres semanas después de
 * su final, mientras el circuito de seven estaba en curso — hasta la noticia
 * principal ya era del seven. Lo que se está jugando va primero.
 *
 * Es un resumen, no la sección: las tres copas de la última etapa y la punta de
 * la tabla. El detalle vive en /seven.
 */
function Escudo({ nombre, logos }: { nombre: string | null; logos: Map<string, string> }) {
  const src = nombre ? logos.get(nombre) : undefined;
  if (!src) {
    return (
      <span className="w-7 h-7 rounded-full bg-muted inline-flex items-center justify-center text-[9px] font-bold text-foreground/70 flex-shrink-0">
        {(nombre ?? "?").slice(0, 2).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={nombre ?? ""} className="w-7 h-7 rounded-full object-cover ring-1 ring-border flex-shrink-0" />;
}

const COLOR: Record<string, string> = {
  Oro: "text-amber-500", Plata: "text-slate-400", Bronce: "text-orange-600",
};

export function HomeSevenSection({ initial }: { initial: SevenCircuito | null }) {
  const [data, setData] = useState<SevenCircuito | null>(initial);
  const hoy = useHoyEnChile();

  useEffect(() => {
    if (initial) return;
    let vivo = true;
    fetchSeven({ cache: "no-store" }).then((d) => { if (vivo) setData(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [initial]);

  // Mismo cuidado que en /seven: el payload puede venir de una API más vieja
  // que esta pantalla.
  if (!data || !data.tabla?.length) return null;
  const etapas = data.etapas ?? [];
  // Las copas salen de la última etapa JUGADA. Con la etapa 2 cargada en
  // Leverade pero sin jugarse, tomar la última a secas mostraba tres copas con
  // un guión donde va el campeón.
  const ultimaJugada = [...etapas].reverse().find((e) => e.jugada);
  // La etapa que viene. No se compara con la fecha de hoy: leer el reloj en el
  // render haría que el HTML estático del home afirmara un día distinto al del
  // visitante. El chip "Hoy" sí lo necesita, y por eso espera a montar.
  const porJugar = etapas.find((e) => !e.jugada);
  // Lo que viene manda sobre lo que pasó hace dos semanas.
  const esHoy = !!hoy && !!porJugar && porJugar.fecha === hoy;
  const proximos = (porJugar
    ? [...(porJugar.grupos ?? []), ...(porJugar.copas ?? [])]
        .flatMap((g) => g.partidos ?? [])
        .filter((m) => m.home && m.away && m.homeScore == null)
        .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""))
    : []).slice(0, 3);
  // La tabla oficial de ARUSA si la publicó; si no, nuestra cuenta.
  const oficial = data.oficial ?? [];
  const logos = new Map((data.equipos ?? []).filter((e) => e.logo).map((e) => [e.name, e.logo!]));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Medal className="h-4 w-4 text-amber-500" />
          <h2 className="font-bold uppercase tracking-widest text-sm">
            Seven{porJugar ? ` · Etapa ${porJugar.numero}` : ultimaJugada ? ` · Etapa ${ultimaJugada.numero}` : ""}
          </h2>
          {porJugar && (
            <span className={`text-[10px] font-bold tracking-widest uppercase ${esHoy ? "text-red-500" : "text-muted-foreground"}`}>
              {esHoy ? "Hoy" : dia(porJugar.fecha)}
            </span>
          )}
        </div>
        <Link href="/seven" className="text-xs text-muted-foreground hover:text-foreground/80 flex items-center gap-1 transition-colors">
          Ver todo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {proximos.length > 0 && (
        <div className="rounded-xl border border-red-600/30 bg-red-600/5 overflow-hidden mb-3 divide-y divide-border/40">
          {proximos.map((m) => (
            <div key={m.id} className="flex items-center gap-2 px-3 py-2">
              <span className="text-[10px] tabular-nums text-muted-foreground/70 w-9 flex-shrink-0">{m.hora}</span>
              <Escudo nombre={m.home} logos={logos} />
              <span className="text-xs font-medium truncate flex-1 min-w-0">{m.home}</span>
              <span className="text-[9px] font-bold tracking-widest text-muted-foreground/50">VS</span>
              <span className="text-xs font-medium truncate flex-1 min-w-0 text-right">{m.away}</span>
              <Escudo nombre={m.away} logos={logos} />
            </div>
          ))}
        </div>
      )}

      {proximos.length === 0 && ultimaJugada && (ultimaJugada.copas ?? []).length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(ultimaJugada.copas ?? []).map((c) => (
            <div key={c.nombre} className="rounded-xl border border-border bg-card/50 p-3">
              <span className={`block text-[9px] font-bold tracking-widest uppercase mb-2 ${COLOR[c.nombre] ?? ""}`}>
                {c.nombre}
              </span>
              <span className="flex items-center gap-1.5 min-w-0">
                <Escudo nombre={c.campeon} logos={logos} />
                <span className="text-xs font-bold truncate">{c.campeon ?? "—"}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
        <p className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground border-b border-border/60">
          {oficial.length > 0 ? "Tabla del circuito" : "Rendimiento en cancha"}
        </p>
        <ul className="divide-y divide-border/40">
          {oficial.length > 0
            ? oficial.slice(0, 5).map((f) => (
                <li key={f.team} className="flex items-center gap-2.5 px-3 py-2">
                  <span className="w-5 text-center text-[10px] font-bold tabular-nums text-muted-foreground flex-shrink-0">{f.pos}</span>
                  <Escudo nombre={f.team} logos={logos} />
                  <span className="text-sm font-medium truncate flex-1 min-w-0">{f.team}</span>
                  <span className="text-sm font-black tabular-nums w-7 text-right">{f.pts}</span>
                </li>
              ))
            : data.tabla.slice(0, 5).map((f) => (
                <li key={f.team} className="flex items-center gap-2.5 px-3 py-2">
                  <span className="w-5 text-center text-[10px] font-bold tabular-nums text-muted-foreground flex-shrink-0">{f.pos}</span>
                  <Escudo nombre={f.team} logos={logos} />
                  <span className="text-sm font-medium truncate flex-1 min-w-0">{f.team}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{f.pj}PJ</span>
                  <span className="text-sm font-black tabular-nums w-7 text-right">{f.pts}</span>
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
}
