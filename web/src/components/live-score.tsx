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
  const liveMinute = useEstimatedMinute(live?.minute ?? 0, live?.status ?? "SCHEDULED");
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

  if (live && live.status === "FINISHED") {
    const hw = live.homeScore > live.awayScore;
    const draw = live.homeScore === live.awayScore;
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-2">
          <span className={`text-xl font-black tabular-nums ${hw || draw ? "text-foreground" : "text-muted-foreground"}`}>{live.homeScore}</span>
          <span className="text-muted-foreground/50">-</span>
          <span className={`text-xl font-black tabular-nums ${!hw || draw ? "text-foreground" : "text-muted-foreground"}`}>{live.awayScore}</span>
        </div>
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Final</span>
      </div>
    );
  }

  if (staticFinished && staticHome !== undefined && staticAway !== undefined) {
    const hw = staticHome > staticAway;
    const draw = staticHome === staticAway;
    return (
      <div className="flex items-center gap-2">
        <span className={`text-xl font-black tabular-nums ${hw || draw ? "text-foreground" : "text-muted-foreground"}`}>{staticHome}</span>
        <span className="text-muted-foreground/50">-</span>
        <span className={`text-xl font-black tabular-nums ${!hw || draw ? "text-foreground" : "text-muted-foreground"}`}>{staticAway}</span>
      </div>
    );
  }

  return <span className="text-muted-foreground/70 text-xs font-bold tracking-widest">VS</span>;
}
