"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TrendingUp, ArrowRight, Trophy } from "lucide-react";
import { clubLogo } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type TeamProj = {
  team: string;
  projectedPos: number;
  playoffPct: number;
  championPct: number;
  repechajePct: number;
  relegationPct: number;
};
export type Projection = { teams: TeamProj[]; remainingMatches: number };

const CLUB_COLOR: Record<string, string> = {
  COBS: "#1a3a6b", "Old Boys": "#cc0000", PWCC: "#003087", "Old Macks": "#b91c1c",
  "Stade Francais": "#1a237e", "Sporting RC": "#15803d", DOBS: "#0369a1",
  UC: "#1e3a8a", "Old Johns": "#1d4ed8", "Old Reds": "#9f1239",
};

function ClubBadge({ team }: { team: string }) {
  const logo = clubLogo(team);
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt={team} className="w-6 h-6 rounded-full object-cover flex-shrink-0 ring-1 ring-border" />;
  }
  const initials = team.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white"
      style={{ background: CLUB_COLOR[team] ?? "#374151" }}>{initials}</span>
  );
}

function pct(n: number) {
  if (n <= 0) return "0%";
  if (n < 1) return "<1%";
  if (n > 99 && n < 100) return ">99%";
  return `${Math.round(n)}%`;
}

function posClasses(pos: number) {
  if (pos <= 4) return "bg-emerald-600 text-white";
  if (pos === 9) return "bg-amber-500 text-zinc-950";
  if (pos === 10) return "bg-red-700 text-white";
  return "bg-secondary text-foreground";
}

export function HomeProjectionPreview({ initialProjection = null }: { initialProjection?: Projection | null }) {
  // Seed from the server-rendered projection so the section shows data on first
  // paint (the API's cold-start simulation can be slow on Render's free tier;
  // without this the client fetch would leave it stuck on "Simulando…").
  const [data, setData] = useState<Projection | null>(initialProjection);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // Refresh client-side, but bounded — never spin forever waiting on a slow
    // cold start. On failure we keep whatever the server already gave us.
    fetch(`${API_URL}/api/v1/predict/season`, { signal: AbortSignal.timeout(20000) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, []);

  if (failed && !data) return null; // only drop if we have nothing at all to show

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <h2 className="font-bold uppercase tracking-widest text-xs">Proyección</h2>
        </div>
        <Link href="/proyeccion" className="text-xs text-muted-foreground hover:text-foreground/80 flex items-center gap-1 transition-colors">
          Ver todo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <p className="px-4 pt-3 text-[11px] text-muted-foreground">
        Chances de terminar la fase regular{data ? ` · ${data.remainingMatches} partidos por jugar` : ""}
      </p>

      <div className="p-2">
        {!data && <div className="p-6 text-center text-xs text-muted-foreground animate-pulse">Simulando…</div>}
        {data && (
          <ul className="space-y-0.5">
            {data.teams.map((t) => {
              const drop = Math.max(t.relegationPct, t.repechajePct);
              return (
                <li key={t.team} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-card/80 transition-colors">
                  <span className={`inline-flex w-5 h-5 items-center justify-center rounded text-[10px] font-bold flex-shrink-0 ${posClasses(t.projectedPos)}`}>
                    {t.projectedPos}
                  </span>
                  <ClubBadge team={t.team} />
                  <span className="text-xs font-medium truncate flex-1 min-w-0">{t.team}</span>

                  {t.championPct >= 1 && (
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-500 tabular-nums" title="Chance de campeón">
                      <Trophy className="h-3 w-3" />{pct(t.championPct)}
                    </span>
                  )}

                  <div className="flex items-center gap-1.5 w-[86px] flex-shrink-0 justify-end">
                    <div className="h-1.5 w-11 rounded-full bg-secondary overflow-hidden">
                      <div className={`h-full rounded-full ${t.projectedPos === 10 || (t.playoffPct < 5 && drop > 40) ? "bg-red-600" : "bg-emerald-500"}`}
                        style={{ width: `${Math.max(2, Math.min(100, t.playoffPct))}%` }} />
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right">{pct(t.playoffPct)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-3 pt-1 text-[10px] text-muted-foreground border-t border-border">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" />Playoffs (barra = %)</span>
        <span className="flex items-center gap-1"><Trophy className="h-2.5 w-2.5 text-amber-500" />Chance de título</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-700 inline-block" />Descenso</span>
      </div>
    </div>
  );
}
