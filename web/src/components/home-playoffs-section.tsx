"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy, ArrowRight, ChevronRight } from "lucide-react";
import { ClubLogo } from "@/components/club-logo";
import { MatchDetailSheet } from "@/components/match-detail-sheet";
import { useLiveMatches, getLive } from "@/lib/use-live-matches";
import { LiveScore } from "@/components/live-score";
import { usePlayoffs, RONDA_SEMIS, type Playoffs, type Semifinal } from "@/lib/use-playoffs";

/**
 * Los playoffs en el panel.
 *
 * Terminada la fase regular, el home seguía anunciando "Fecha 18 · Próxima" con
 * partidos que ya se habían jugado: nextFechaNumber() sólo conoce las 18 fechas
 * regulares y al acabarse se queda pegado en la última. Acá manda el cuadro.
 *
 * Los playoffs NO están en el feed de resultados —su clave división|local|visita
 * choca con la fase regular—, así que el marcador sale del propio cuadro; el de
 * un partido en curso, del feed en vivo, que sí los distingue porque sólo trae
 * los de hoy.
 */
/** "2026-09-27" → "Dom 27 Sep". A mano para que no lo corra la zona horaria. */
function diaLargo(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  const dia = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][f.getDay()];
  const mes = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m - 1];
  return `${dia} ${d} ${mes}`;
}

type Elegido = {
  home: string; away: string; date: string; time: string; venue: string;
  round: number; homeScore: number | null; awayScore: number | null; finished: boolean;
};

export function HomePlayoffsSection({ initial }: { initial: Playoffs | null }) {
  const playoffs = usePlayoffs("PRIMERA", initial);
  const liveMap = useLiveMatches();
  const [elegido, setElegido] = useState<Elegido | null>(null);

  if (!playoffs) return null;

  const filas: Array<{ etiqueta: string; sf: Semifinal | null; final: boolean }> = [
    ...playoffs.semifinals.map((sf) => ({ etiqueta: sf.label, sf, final: false })),
  ];

  const enJuego = playoffs.semifinals.some((sf) => {
    const l = getLive(liveMap, "PRIMERA", sf.home, sf.away);
    return l?.status === "LIVE" || l?.status === "HT";
  });
  const todasJugadas = playoffs.semifinals.every((sf) => sf.finished);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className={`h-4 w-4 ${enJuego ? "text-red-500" : "text-primary"}`} />
          <h2 className="font-bold uppercase tracking-widest text-sm">
            Semifinales ·{" "}
            {enJuego ? <span className="text-red-500">En juego</span> : todasJugadas ? "Resultados" : "Próxima"}
          </h2>
        </div>
        <Link href="/temporada?tab=partidos" className="text-xs text-muted-foreground hover:text-foreground/80 flex items-center gap-1 transition-colors">
          Ver todo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {filas.map(({ etiqueta, sf }) => {
          if (!sf) return null;
          const live = getLive(liveMap, "PRIMERA", sf.home, sf.away);
          const isLive = live?.status === "LIVE" || live?.status === "HT";
          const jugado = sf.finished || (sf.homeScore != null && sf.awayScore != null);
          return (
            <button
              key={etiqueta}
              onClick={() => setElegido({
                home: sf.home, away: sf.away,
                date: sf.date ? diaLargo(sf.date) : "Por definir",
                time: sf.time ?? "", venue: sf.venue ?? "",
                round: RONDA_SEMIS,
                homeScore: sf.homeScore, awayScore: sf.awayScore, finished: sf.finished,
              })}
              className={`w-full text-left rounded-xl border bg-card/50 overflow-hidden active:scale-[0.99] transition-all cursor-pointer ${
                isLive ? "border-red-600/50 shadow-[0_0_12px_rgba(220,38,38,0.1)]" : "border-border hover:border-foreground/30"
              }`}
            >
              <div className="px-4 py-3">
                <span className="block text-[10px] font-bold tracking-widest uppercase text-emerald-500 mb-1.5">{etiqueta}</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ClubLogo team={sf.home} stopPropagation className="w-9 h-9 rounded-full flex-shrink-0 object-cover ring-1 ring-border" />
                    <span className="font-semibold text-sm truncate">{sf.home}</span>
                  </div>
                  <LiveScore
                    live={live}
                    staticHome={sf.homeScore ?? undefined}
                    staticAway={sf.awayScore ?? undefined}
                    finished={jugado && !isLive}
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0 flex-row-reverse">
                    <ClubLogo team={sf.away} stopPropagation className="w-9 h-9 rounded-full flex-shrink-0 object-cover ring-1 ring-border" />
                    <span className="font-semibold text-sm text-right truncate">{sf.away}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                </div>
                <p className="text-muted-foreground text-xs mt-1.5">
                  {sf.date ? diaLargo(sf.date) : "Día por confirmar"}
                  {sf.time && ` · ${sf.time}`}
                  {sf.venue && ` · ${sf.venue}`}
                </p>
              </div>
            </button>
          );
        })}

        {playoffs.final && (
          <div className="rounded-xl border border-red-600/40 bg-red-600/5 px-4 py-3">
            <span className="block text-[10px] font-bold tracking-widest uppercase text-red-500 mb-1">Final</span>
            <p className="text-sm font-semibold">
              {playoffs.final.home ?? "Ganador SF1"}{" "}
              <span className="text-muted-foreground/60 font-normal">vs</span>{" "}
              {playoffs.final.away ?? "Ganador SF2"}
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              {diaLargo(playoffs.final.date)} · {playoffs.final.time} · {playoffs.final.venue}
            </p>
          </div>
        )}
      </div>

      <MatchDetailSheet
        open={!!elegido}
        match={
          elegido
            ? (() => {
                const live = getLive(liveMap, "PRIMERA", elegido.home, elegido.away);
                const fin = live?.status === "FINISHED" || elegido.finished;
                return {
                  home: elegido.home, away: elegido.away, date: elegido.date,
                  time: elegido.time, venue: elegido.venue,
                  status: fin ? ("FINISHED" as const) : ("UPCOMING" as const),
                  homeScore: live?.homeScore ?? elegido.homeScore ?? undefined,
                  awayScore: live?.awayScore ?? elegido.awayScore ?? undefined,
                  round: elegido.round,
                  division: "PRIMERA" as const,
                };
              })()
            : null
        }
        onClose={() => setElegido(null)}
      />
    </section>
  );
}

