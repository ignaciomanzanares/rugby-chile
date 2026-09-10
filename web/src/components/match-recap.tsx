"use client";

import { useState } from "react";
import { Play, Film } from "lucide-react";

/**
 * Resumen en video de la fecha (canal de ARUSA en YouTube).
 *
 * OJO: los videos son por JORNADA, no por partido — el canal sube "Resumen
 * Fecha N Itaú Top 10". Por eso se rotula como resumen de la fecha y no se
 * promete que sea de este partido.
 *
 * Arranca como miniatura: el iframe de YouTube recién se monta al tocar, así no
 * se carga su script en cada ficha que alguien abre.
 */
export function MatchRecap({
  videoId, title, round, kind,
}: { videoId: string; title: string; round: number; kind: "match" | "round" }) {
  const [reproduciendo, setReproduciendo] = useState(false);

  return (
    <div className="mb-5 max-w-sm">
      <div className="flex items-center gap-2 mb-2">
        <Film className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
          {kind === "match" ? "Resumen del partido" : `Resumen de la fecha ${round}`}
        </h3>
      </div>

      {reproduciendo ? (
        <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />
        </div>
      ) : (
        <button
          onClick={() => setReproduciendo(true)}
          className="group relative w-full rounded-lg overflow-hidden bg-black block"
          style={{ aspectRatio: "16 / 9" }}
          aria-label={`Reproducir: ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-11 h-11 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
              <Play className="h-5 w-5 text-white ml-0.5" fill="currentColor" />
            </span>
          </span>
          <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2.5 text-left">
            <span className="text-[11px] text-white/90 line-clamp-1">{title}</span>
          </span>
        </button>
      )}
    </div>
  );
}
