"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Medal, ArrowRight } from "lucide-react";
import { fetchSeven, type SevenCircuito } from "@/lib/seven-api";

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

  useEffect(() => {
    if (initial) return;
    let vivo = true;
    fetchSeven({ cache: "no-store" }).then((d) => { if (vivo) setData(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [initial]);

  // Mismo cuidado que en /seven: el payload puede venir de una API más vieja
  // que esta pantalla.
  if (!data || !data.tabla?.length) return null;
  const ultima = [...(data.etapas ?? [])].reverse()[0];
  const logos = new Map((data.equipos ?? []).filter((e) => e.logo).map((e) => [e.name, e.logo!]));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Medal className="h-4 w-4 text-amber-500" />
          <h2 className="font-bold uppercase tracking-widest text-sm">
            Seven{ultima ? ` · Etapa ${ultima.numero}` : ""}
          </h2>
        </div>
        <Link href="/seven" className="text-xs text-muted-foreground hover:text-foreground/80 flex items-center gap-1 transition-colors">
          Ver todo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {ultima && (ultima.copas ?? []).length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(ultima.copas ?? []).map((c) => (
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
          Tabla acumulada
        </p>
        <ul className="divide-y divide-border/40">
          {data.tabla.slice(0, 5).map((f) => (
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
