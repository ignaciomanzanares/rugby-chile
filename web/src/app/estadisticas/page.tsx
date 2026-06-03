"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { clubs } from "@/data/clubs";
import { PLAYER_STATS_BY_DIVISION, type DivisionKey, type DivisionPlayerStat } from "@/data/player-stats";
import { clubLogo } from "@/lib/tournament";
import { useLivePlayerStats, type LivePlayerStat } from "@/lib/use-live-player-stats";
import { useLiveMatches } from "@/lib/use-live-matches";
import { BarChart3, Target, Zap, Award, AlertTriangle, Radio } from "lucide-react";

type StatKey = "points" | "tries" | "conversions" | "penalties" | "drops" | "yellowCards" | "redCards" | "mvp";

type MergedStat = DivisionPlayerStat & { live?: boolean };

// live_events carry free-text names; normalise (lowercase, strip accents,
// collapse spaces) so a live scorer matches their static baseline row when the
// names line up. Unmatched scorers are kept as new live-only rows.
const normName = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[^\x00-\x7f]/g, "").replace(/\s+/g, " ").trim();

function mergeLiveStats(base: DivisionPlayerStat[], live: LivePlayerStat[]): MergedStat[] {
  const byKey = new Map<string, MergedStat>();
  for (const p of base) byKey.set(`${normName(p.name)}|${p.teamSlug}`, { ...p });
  for (const lp of live) {
    const key = `${normName(lp.name)}|${lp.teamSlug}`;
    const cur = byKey.get(key);
    if (cur) {
      cur.tries += lp.tries; cur.conversions += lp.conversions;
      cur.penalties += lp.penalties; cur.drops += lp.drops;
      cur.yellowCards += lp.yellowCards; cur.redCards += lp.redCards;
      cur.points += lp.points; cur.matches += lp.matches;
      cur.live = true;
    } else {
      byKey.set(key, {
        id: `live-${key}`, name: lp.name, team: lp.team, teamSlug: lp.teamSlug,
        matches: lp.matches, points: lp.points, tries: lp.tries, penaltyTries: 0,
        conversions: lp.conversions, penalties: lp.penalties, drops: lp.drops,
        yellowCards: lp.yellowCards, redCards: lp.redCards, mvp: 0, live: true,
      });
    }
  }
  return [...byKey.values()];
}

const STAT_TABS: { key: StatKey; label: string; icon: React.ElementType; color: string; suffix?: string }[] = [
  { key: "points",        label: "Puntos",        icon: Target,         color: "text-blue-400",   suffix: "pts" },
  { key: "tries",         label: "Tries",         icon: Zap,            color: "text-emerald-400" },
  { key: "conversions",   label: "Conversiones",  icon: Target,         color: "text-purple-400" },
  { key: "penalties",     label: "Penales",       icon: Target,         color: "text-amber-400" },
  { key: "drops",         label: "Drops",         icon: Target,         color: "text-cyan-400" },
  { key: "yellowCards",   label: "Amarillas",     icon: AlertTriangle,  color: "text-yellow-400" },
  { key: "redCards",      label: "Rojas",         icon: AlertTriangle,  color: "text-red-500" },
  { key: "mvp",           label: "MVP",           icon: Award,          color: "text-amber-300" },
];

const DIVISIONS: { key: DivisionKey; label: string }[] = [
  { key: "PRIMERA",        label: "Primera" },
  { key: "INTERMEDIA",     label: "Intermedia" },
  { key: "PRE_INTERMEDIA", label: "Pre-Intermedia" },
];

export default function EstadisticasPage() {
  const [division, setDivision] = useState<DivisionKey>("PRIMERA");
  const [statKey, setStatKey] = useState<StatKey>("points");
  const [clubFilter, setClubFilter] = useState<string>("ALL");

  const liveByPair = useLiveMatches();
  const { players: livePlayers, refresh } = useLivePlayerStats(division);

  // Re-pull live stats the moment a live event lands or a match finishes, so
  // the leaderboards move in real time during a match.
  const liveSignal = useMemo(() => {
    const ms = Array.from(liveByPair.values());
    const events = ms.reduce((n, m) => n + m.events.length, 0);
    const finished = ms.filter((m) => m.status === "FINISHED").length;
    return `${events}|${finished}`;
  }, [liveByPair]);
  useEffect(() => { refresh(); }, [liveSignal, refresh]);

  const pool: MergedStat[] = useMemo(
    () => mergeLiveStats(PLAYER_STATS_BY_DIVISION[division], livePlayers),
    [division, livePlayers],
  );

  const filtered = useMemo(
    () => (clubFilter === "ALL" ? pool : pool.filter((p) => p.teamSlug === clubFilter)),
    [pool, clubFilter],
  );

  const leaders = useMemo(() => {
    const list = [...filtered].filter((p) => p[statKey] > 0);
    list.sort((a, b) => (b[statKey] as number) - (a[statKey] as number) || b.points - a.points);
    return list.slice(0, 50);
  }, [filtered, statKey]);

  const tab = STAT_TABS.find((t) => t.key === statKey)!;
  const Icon = tab.icon;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <section className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-1">
            <BarChart3 className="h-5 w-5 text-red-500" />
            <h1 className="text-2xl font-black uppercase tracking-widest">Estadísticas</h1>
          </div>
          <p className="text-zinc-500 text-sm">Líderes individuales por categoría · Temporada 2026</p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 space-y-6">

        {/* Division tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mr-1">Categoría:</span>
          {DIVISIONS.map((d) => (
            <button
              key={d.key}
              onClick={() => setDivision(d.key)}
              className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                division === d.key
                  ? "bg-red-600 text-white"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Stat tabs */}
        <div className="flex flex-wrap gap-2">
          {STAT_TABS.map((t) => {
            const Ic = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setStatKey(t.key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                  statKey === t.key
                    ? "bg-zinc-700 text-white ring-1 ring-zinc-500"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600"
                }`}
              >
                <Ic className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Club filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mr-1">Club:</span>
          <button
            onClick={() => setClubFilter("ALL")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              clubFilter === "ALL"
                ? "bg-zinc-700 text-white"
                : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            Todos
          </button>
          {clubs.map((c) => {
            const logo = clubLogo(c.name);
            return (
              <button
                key={c.slug}
                onClick={() => setClubFilter(c.slug)}
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  clubFilter === c.slug
                    ? "bg-zinc-700 text-white ring-1 ring-zinc-500"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                {logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={c.name} className="w-5 h-5 rounded-full object-cover" />
                )}
                <span className="hidden sm:inline">{c.name}</span>
              </button>
            );
          })}
        </div>

        {/* Leaderboard */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Icon className={`h-4 w-4 ${tab.color}`} />
            <h2 className="font-bold uppercase tracking-widest text-sm">
              Líderes · {tab.label} · {DIVISIONS.find((d) => d.key === division)?.label}
            </h2>
            {clubFilter !== "ALL" && (
              <span className="text-xs text-zinc-500">
                · {clubs.find((c) => c.slug === clubFilter)?.name}
              </span>
            )}
            {livePlayers.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 ml-auto">
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                Actualizado en vivo
              </span>
            )}
          </div>

          {leaders.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-zinc-500 text-sm">
              No hay jugadores con {tab.label.toLowerCase()} en esta selección.
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-900/80 border-b border-zinc-800">
                    <th className="text-left px-4 py-3 text-zinc-500 text-xs uppercase tracking-wide font-semibold w-10">#</th>
                    <th className="text-left px-4 py-3 text-zinc-500 text-xs uppercase tracking-wide font-semibold">Jugador</th>
                    <th className="text-left px-4 py-3 text-zinc-500 text-xs uppercase tracking-wide font-semibold hidden sm:table-cell">Club</th>
                    <th className="text-center px-3 py-3 text-zinc-500 text-xs uppercase tracking-wide font-semibold hidden md:table-cell">PJ</th>
                    <th className={`text-center px-4 py-3 text-xs uppercase tracking-wide font-bold ${tab.color}`}>{tab.label}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((p, i) => {
                    const logo = clubLogo(p.team);
                    return (
                      <tr key={`${p.id}-${i}`} className={`border-b border-zinc-800 last:border-0 hover:bg-zinc-900/50 transition-colors ${i === 0 ? "bg-amber-500/5" : ""}`}>
                        <td className="px-4 py-3 text-zinc-500 font-bold tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold inline-flex items-center gap-1.5 ${i === 0 ? "text-white" : "text-zinc-200"}`}>
                            {p.name}
                            {p.live && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-label="actualizado en vivo" />}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Link href={`/teams/${p.teamSlug}`} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
                            {logo && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={logo} alt={p.team} className="w-5 h-5 rounded-full object-cover" />
                            )}
                            <span className="text-xs">{p.team}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-zinc-400 text-center hidden md:table-cell">{p.matches}</td>
                        <td className={`px-4 py-3 text-center text-lg font-black tabular-nums ${tab.color}`}>
                          {p[statKey]}{tab.suffix ? <span className="text-xs text-zinc-500 ml-1">{tab.suffix}</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-xs text-zinc-600 text-center pt-2">
          Datos oficiales: <a href="https://arusa.cl/en/tournament/1328550/summary" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">arusa.cl</a>
        </p>
      </div>
    </div>
  );
}
