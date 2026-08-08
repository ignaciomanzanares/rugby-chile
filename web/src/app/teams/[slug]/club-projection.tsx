"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TrendingUp, ArrowRight, Home, Plane } from "lucide-react";
import { clubLogo } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type TeamProj = {
  team: string; projectedPos: number; playoffPct: number; championPct: number;
  finalPct: number; repechajePct: number; relegationPct: number;
};
type MatchPred = {
  round: number; home: string; away: string;
  homeWinPct: number; drawPct: number; awayWinPct: number; expHome: number; expAway: number;
};
type Projection = { teams: TeamProj[]; matches: MatchPred[] };

const CLUB_COLOR: Record<string, string> = {
  COBS: "#1a3a6b", "Old Boys": "#cc0000", PWCC: "#003087", "Old Macks": "#b91c1c",
  "Stade Francais": "#1a237e", "Sporting RC": "#15803d", DOBS: "#0369a1",
  UC: "#1e3a8a", "Old Johns": "#1d4ed8", "Old Reds": "#9f1239",
};

function ClubBadge({ team, size = 22 }: { team: string; size?: number }) {
  const logo = clubLogo(team);
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt={team} width={size} height={size} className="rounded-full object-cover flex-shrink-0 ring-1 ring-border" style={{ width: size, height: size }} />;
  }
  const initials = team.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return <span className="rounded-full inline-flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white" style={{ width: size, height: size, background: CLUB_COLOR[team] ?? "#374151" }}>{initials}</span>;
}

function pct(n: number) {
  if (n <= 0) return "0%";
  if (n < 1) return "<1%";
  if (n > 99 && n < 100) return ">99%";
  return `${Math.round(n)}%`;
}

export function ClubProjection({ teamName }: { teamName: string }) {
  const [data, setData] = useState<Projection | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/api/v1/predict/season`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, []);

  if (failed) return null;

  const t = data?.teams.find((x) => x.team === teamName);
  const fixtures = (data?.matches ?? [])
    .filter((m) => m.home === teamName || m.away === teamName)
    .sort((a, b) => a.round - b.round);

  // Headline tiles: playoffs always; then champion if a contender, else the
  // relevant bottom-of-table risk.
  const tiles = t ? [
    { label: "Puesto proyectado", value: `${t.projectedPos}º` },
    { label: "Playoffs", value: pct(t.playoffPct), tone: t.playoffPct >= 50 ? "good" : "" },
    t.championPct >= 1
      ? { label: "Campeón", value: pct(t.championPct), tone: "gold" }
      : t.relegationPct >= 5 || t.repechajePct >= 5
        ? { label: t.relegationPct >= t.repechajePct ? "Descenso" : "Repechaje", value: pct(Math.max(t.relegationPct, t.repechajePct)), tone: "bad" }
        : { label: "Llega a la final", value: pct(t.finalPct) },
  ] : [];

  const toneClass = (tone?: string) =>
    tone === "good" ? "text-emerald-400" : tone === "gold" ? "text-amber-400" : tone === "bad" ? "text-red-400" : "text-foreground";

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <h2 className="font-bold uppercase tracking-widest text-sm">Proyección · fase regular</h2>
        </div>
        <Link href="/proyeccion" className="text-xs text-muted-foreground hover:text-foreground/80 flex items-center gap-1 transition-colors">
          Ver todo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {!data && <div className="rounded-xl border border-border p-6 text-center text-xs text-muted-foreground animate-pulse">Simulando…</div>}

      {data && t && (
        <div className="space-y-4">
          {/* Tiles */}
          <div className="grid grid-cols-3 gap-3">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-xl border border-border bg-card/60 px-4 py-3">
                <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide mb-1">{tile.label}</p>
                <p className={`text-2xl font-black ${toneClass(tile.tone)}`}>{tile.value}</p>
              </div>
            ))}
          </div>

          {/* Remaining fixtures with the club's win chance */}
          {fixtures.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <p className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
                Lo que viene · probabilidad de {teamName}
              </p>
              <ul className="divide-y divide-border">
                {fixtures.map((m) => {
                  const isHome = m.home === teamName;
                  const opp = isHome ? m.away : m.home;
                  const win = isHome ? m.homeWinPct : m.awayWinPct;
                  const loss = isHome ? m.awayWinPct : m.homeWinPct;
                  return (
                    <li key={`${m.round}-${opp}`} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-[11px] text-muted-foreground w-8 flex-shrink-0">F{m.round}</span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground w-12 flex-shrink-0" title={isHome ? "De local" : "De visita"}>
                        {isHome ? <><Home className="h-3 w-3" />local</> : <><Plane className="h-3 w-3" />visita</>}
                      </span>
                      <ClubBadge team={opp} />
                      <span className="text-sm font-medium truncate flex-1 min-w-0">{opp}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
                          <div className={`h-full rounded-full ${win >= loss ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.max(2, Math.min(100, win))}%` }} />
                        </div>
                        <span className="text-xs tabular-nums w-9 text-right font-semibold">{pct(win)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Simulación Monte Carlo del resto del torneo. La barra es la chance de que {teamName} gane ese partido.
          </p>
        </div>
      )}
    </section>
  );
}
