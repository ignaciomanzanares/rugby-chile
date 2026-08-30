"use client";

import type { LiveMatch } from "@/lib/use-live-matches";
import { useEstimatedMinute } from "@/lib/use-estimated-minute";

/** Renders the score area for a match card — static VS, live score, or final score. */
export function LiveScore({
  live,
  staticHome,
  staticAway,
  finished: staticFinished,
}: {
  live?: LiveMatch;
  staticHome?: number;
  staticAway?: number;
  finished: boolean;
}) {
  // Hook siempre llamado (reglas de hooks); congela cuando no está EN VIVO.
  const liveMinute = useEstimatedMinute(live?.id ?? "", live?.minute ?? 0, live?.status ?? "SCHEDULED");
  if (live && (live.status === "LIVE" || live.status === "HT")) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black tabular-nums text-foreground">{live.homeScore}</span>
          <span className="text-muted-foreground/50">-</span>
          <span className="text-xl font-black tabular-nums text-foreground">{live.awayScore}</span>
        </div>
        {live.status === "HT" ? (
          <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">Descanso</span>
        ) : (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-400 uppercase tracking-widest animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            {liveMinute}&apos; En vivo
          </span>
        )}
      </div>
    );
  }

  // Partido TERMINADO: el marcador OFICIAL de Leverade (static) manda sobre el que
  // dejó el scrape en vivo de arusa. Ese scrape puede quedar con una captura
  // INCOMPLETA si el planillero de arusa carga/corrige eventos tarde (fue el caso
  // del PRE: en vivo quedó 25-7, pero el final real de Leverade es 30-14). Sólo
  // caemos al marcador del en vivo si Leverade todavía no lo tiene.
  const isFinished = staticFinished || live?.status === "FINISHED";
  if (isFinished) {
    const home = staticHome ?? live?.homeScore;
    const away = staticAway ?? live?.awayScore;
    if (home !== undefined && away !== undefined) {
      const hw = home > away;
      const draw = home === away;
      return (
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-2">
            <span className={`text-xl font-black tabular-nums ${hw || draw ? "text-foreground" : "text-muted-foreground"}`}>{home}</span>
            <span className="text-muted-foreground/50">-</span>
            <span className={`text-xl font-black tabular-nums ${!hw || draw ? "text-foreground" : "text-muted-foreground"}`}>{away}</span>
          </div>
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Final</span>
        </div>
      );
    }
  }

  return <span className="text-muted-foreground/70 text-xs font-bold tracking-widest">VS</span>;
}
