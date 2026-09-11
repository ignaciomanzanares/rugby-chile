"use client";

import { X } from "lucide-react";

export type PointDetail = { label: string; pts: number };

/**
 * Por qué un jugador sumó lo que sumó en una fecha.
 *
 * Las líneas las escribe el scorer (es el único que sabe de dónde salió cada
 * punto), así que acá solo se pintan y se les agrega arriba lo que depende del
 * equipo: la jineta de capitán y el modificador del super sub.
 *
 * Las fechas puntuadas antes de que el scorer guardara el desglose no lo tienen,
 * y eso se dice en vez de inventarlo.
 */
export function PointsBreakdown({ name, clubSlug, base, detail, played, isCaptain, subMult, onClose }: {
  name: string;
  clubSlug: string;
  base: number;                 // puntos del jugador, sin capitán ni super sub
  detail: PointDetail[] | null;
  played: boolean;
  isCaptain?: boolean;
  subMult?: 2 | 0.5 | null;     // modificador del super sub (entró / fue titular)
  onClose: () => void;
}) {
  const lineas: PointDetail[] = [...(detail ?? [])];
  let total = base;
  if (isCaptain) { lineas.push({ label: "Capitán ×2", pts: base }); total = base * 2; }
  if (subMult) {
    const final = Math.round(base * subMult);
    lineas.push({ label: subMult === 2 ? "Super sub ×2 (entró de suplente)" : "Super sub ÷2 (fue titular)", pts: final - base });
    total = final;
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/clubs/${clubSlug}.jpg`} alt="" className="w-6 h-6 rounded-full object-cover bg-white ring-1 ring-border"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
          <p className="text-sm font-bold truncate">{name}</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar desglose" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!played ? (
        <p className="text-xs text-muted-foreground">No jugó esta fecha.</p>
      ) : lineas.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Esta fecha se puntuó antes de que guardáramos el detalle, así que solo tenemos el total.
        </p>
      ) : (
        <ul className="space-y-1">
          {lineas.map((l, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{l.label}</span>
              <span className={`font-bold tabular-nums ${l.pts < 0 ? "text-red-500" : "text-foreground"}`}>
                {l.pts > 0 ? `+${l.pts}` : l.pts}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 pt-2 border-t border-border flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Total</span>
        <span className="text-base font-black tabular-nums text-emerald-400">{total} pts</span>
      </div>
    </div>
  );
}
