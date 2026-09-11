"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clubs } from "@/data/clubs";
import { PLAYER_STATS_BY_DIVISION, type DivisionKey } from "@/data/player-stats";
import { clubLogo } from "@/lib/tournament";
import { useLivePlayerStats } from "@/lib/use-live-player-stats";
import { useArusaPlayerStats } from "@/lib/use-arusa-player-stats";
import { useLiveMatches } from "@/lib/use-live-matches";
import { mergeLiveStats, type MergedStat } from "@/lib/merge-live-stats";
import { BarChart3, Target, Zap, Award, AlertTriangle, Radio, ChevronRight, ChevronLeft } from "lucide-react";

type StatKey = "points" | "tries" | "conversions" | "penalties" | "drops" | "yellowCards" | "redCards" | "mvp";

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

const DIVISIONS: { key: DivisionKey; label: string; short: string }[] = [
  { key: "PRIMERA",        label: "Primera",        short: "Primera" },
  { key: "INTERMEDIA",     label: "Intermedia",     short: "Inter" },
  { key: "PRE_INTERMEDIA", label: "Pre-Intermedia", short: "Pre" },
];

export function EstadisticasView({ embedded = false }: { embedded?: boolean }) {
  // TODO lo que decide qué se ve vive en la dirección: la categoría abierta
  // (?stat=tries) y también los dos filtros (?div= y ?club=). Abrir una
  // categoría es una navegación, y una navegación vuelve a montar la vista: con
  // los filtros en estado local se perdían justo al tocar "ver todos".
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const enUrl = params.get("stat");
  const abierta: StatKey | null = STAT_TABS.some((t) => t.key === enUrl) ? (enUrl as StatKey) : null;
  const divUrl = params.get("div");
  const division: DivisionKey = DIVISIONS.some((d) => d.key === divUrl) ? (divUrl as DivisionKey) : "PRIMERA";
  const clubFilter = params.get("club") ?? "ALL";

  // Si la abrimos nosotros, cerrar es volver atrás (no deja basura en el
  // historial). Si se llegó por un link directo, se reescribe la dirección.
  const abiertaPorNosotros = useRef(false);

  const conParams = useCallback((cambios: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) { if (v) q.set(k, v); else q.delete(k); }
    const cola = q.toString();
    return cola ? `${pathname}?${cola}` : pathname;
  }, [params, pathname]);

  const abrir = (key: StatKey) => { abiertaPorNosotros.current = true; router.push(conParams({ stat: key })); };
  const cerrar = () => {
    if (abiertaPorNosotros.current) { abiertaPorNosotros.current = false; router.back(); }
    else router.replace(conParams({ stat: null }));
  };
  // Los filtros reescriben la dirección en vez de empujarla: cambiar de club no
  // tiene por qué dejar una entrada en el historial.
  const setDivision = (d: DivisionKey) => router.replace(conParams({ div: d === "PRIMERA" ? null : d }), { scroll: false });
  const setClubFilter = (c: string) => router.replace(conParams({ club: c === "ALL" ? null : c }), { scroll: false });

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

  // Live arusa season stats are the base (all 3 grades, auto-updating); the
  // static dataset is the offline fallback. Live in-match events merge on top.
  const { players: arusaPlayers, loading: statsLoading } = useArusaPlayerStats(division);
  const pool: MergedStat[] = useMemo(
    // Mientras carga NO usamos el baseline estático como base (era el flash de
    // datos viejos); solo cae al estático si el fetch ya resolvió y falló.
    () =>
      mergeLiveStats(
        arusaPlayers ?? (statsLoading ? [] : PLAYER_STATS_BY_DIVISION[division]),
        livePlayers,
      ),
    [division, arusaPlayers, statsLoading, livePlayers],
  );

  const filtered = useMemo(
    () => (clubFilter === "ALL" ? pool : pool.filter((p) => p.teamSlug === clubFilter)),
    [pool, clubFilter],
  );

  // Un solo ordenador para todo: la portada pide 3 por categoría y la vista
  // abierta pide 50 de una sola.
  const rankingDe = useMemo(() => {
    return (key: StatKey, n: number) => {
      const list = [...filtered].filter((p) => p[key] > 0);
      list.sort((a, b) => (b[key] as number) - (a[key] as number) || b.points - a.points);
      return list.slice(0, n);
    };
  }, [filtered]);

  const statKey: StatKey = abierta ?? "points";
  const leaders = useMemo(() => (abierta ? rankingDe(abierta, 50) : []), [abierta, rankingDe]);
  const tab = STAT_TABS.find((t) => t.key === statKey)!;
  const Icon = tab.icon;

  return (
    <div className={embedded ? "" : "min-h-screen bg-background text-foreground"}>
      {!embedded && (
      <section className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-1">
            <BarChart3 className="h-5 w-5 text-red-500" />
            <h1 className="text-2xl font-black uppercase tracking-widest">Estadísticas</h1>
          </div>
          <p className="text-muted-foreground text-sm">Líderes individuales por categoría · Temporada 2026</p>
        </div>
      </section>
      )}

      <div className={`container mx-auto px-4 space-y-6 ${embedded ? "pt-4 pb-24" : "py-8"}`}>

        {/* Division tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mr-1">Categoría:</span>
          {DIVISIONS.map((d) => (
            <button
              key={d.key}
              onClick={() => setDivision(d.key)}
              className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                division === d.key
                  ? "bg-red-600 text-white"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              <span className="sm:hidden">{d.short}</span>
              <span className="hidden sm:inline">{d.label}</span>
            </button>
          ))}
        </div>

        {/* Club filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mr-1">Club:</span>
          <button
            onClick={() => setClubFilter("ALL")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              clubFilter === "ALL"
                ? "bg-secondary text-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
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
                    ? "bg-secondary text-foreground ring-1 ring-muted-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
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

        {/* Portada: el top 3 de cada categoría. Tocar una abre la lista entera.
            Los filtros de división y club siguen mandando en las dos vistas. */}
        {!abierta && (
          <div className="grid gap-3 sm:grid-cols-2">
            {STAT_TABS.map((t) => {
              const Ic = t.icon;
              const top = rankingDe(t.key, 3);
              return (
                <button key={t.key} onClick={() => abrir(t.key)}
                  className="text-left rounded-xl border border-border bg-card/40 p-4 hover:border-foreground/30 transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    <Ic className={`h-4 w-4 ${t.color}`} />
                    <h3 className="font-bold text-sm">{t.label}</h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                  </div>
                  {statsLoading ? (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => <div key={i} className="h-6 rounded bg-muted/50 animate-pulse" />)}
                    </div>
                  ) : top.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin registros en esta selección.</p>
                  ) : (
                    <ol className="space-y-2">
                      {top.map((pl, i) => {
                        const logo = clubLogo(pl.team);
                        return (
                          <li key={`${pl.id}-${i}`} className="flex items-center gap-2">
                            <span className="w-4 text-xs font-bold text-muted-foreground tabular-nums">{i + 1}</span>
                            {logo && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={logo} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                            )}
                            <span className="text-sm font-semibold truncate flex-1 min-w-0">{pl.name}</span>
                            <span className={`text-sm font-black tabular-nums ${t.color}`}>{pl[t.key]}</span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Lista completa de una categoría */}
        {abierta && (
        <section>
          <button onClick={cerrar}
            className="inline-flex items-center gap-1.5 mb-3 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" /> Todas las estadísticas
          </button>
          <div className="flex items-center gap-2 mb-4">
            <Icon className={`h-4 w-4 ${tab.color}`} />
            <h2 className="font-bold uppercase tracking-widest text-sm">
              Líderes · {tab.label} · {DIVISIONS.find((d) => d.key === division)?.label}
            </h2>
            {clubFilter !== "ALL" && (
              <span className="text-xs text-muted-foreground">
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

          {statsLoading ? (
            <div className="rounded-xl border border-border overflow-hidden">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className={`flex items-center gap-4 px-4 py-3.5 border-b border-border last:border-0 ${i % 2 === 0 ? "bg-card/30" : ""}`}>
                  <span className="w-5 h-4 rounded bg-muted/60 animate-pulse flex-shrink-0" />
                  <span className="flex-1 h-4 rounded bg-muted/50 animate-pulse" />
                  <span className="w-24 h-4 rounded bg-muted/40 animate-pulse hidden sm:block" />
                  <span className="w-10 h-4 rounded bg-muted/50 animate-pulse" />
                </div>
              ))}
            </div>
          ) : leaders.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/40 p-8 text-center text-muted-foreground text-sm">
              No hay jugadores con {tab.label.toLowerCase()} en esta selección.
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-card/80 border-b border-border">
                    <th className="text-left px-4 py-3 text-muted-foreground text-xs uppercase tracking-wide font-semibold w-10">#</th>
                    <th className="text-left px-4 py-3 text-muted-foreground text-xs uppercase tracking-wide font-semibold">Jugador</th>
                    <th className="text-left px-4 py-3 text-muted-foreground text-xs uppercase tracking-wide font-semibold hidden sm:table-cell">Club</th>
                    <th className="text-center px-3 py-3 text-muted-foreground text-xs uppercase tracking-wide font-semibold hidden md:table-cell">PJ</th>
                    <th className={`text-center px-4 py-3 text-xs uppercase tracking-wide font-bold ${tab.color}`}>{tab.label}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((p, i) => {
                    const logo = clubLogo(p.team);
                    return (
                      <tr key={`${p.id}-${i}`} className={`border-b border-border last:border-0 hover:bg-card/50 transition-colors ${i === 0 ? "bg-amber-500/5" : ""}`}>
                        <td className="px-4 py-3 text-muted-foreground font-bold tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold inline-flex items-center gap-1.5 ${i === 0 ? "text-foreground" : "text-foreground"}`}>
                            {String(p.id).startsWith("live-") ? (
                              p.name
                            ) : (
                              <Link href={`/jugador/${p.id}`} className="hover:text-red-400 transition-colors">{p.name}</Link>
                            )}
                            {p.live && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-label="actualizado en vivo" />}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Link href={`/teams/${p.teamSlug}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                            {logo && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={logo} alt={p.team} className="w-5 h-5 rounded-full object-cover" />
                            )}
                            <span className="text-xs">{p.team}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground text-center hidden md:table-cell">{p.matches}</td>
                        <td className={`px-4 py-3 text-center text-lg font-black tabular-nums ${tab.color}`}>
                          {p[statKey]}{tab.suffix ? <span className="text-xs text-muted-foreground ml-1">{tab.suffix}</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        )}

        <p className="text-xs text-muted-foreground/70 text-center pt-2">
          Datos oficiales: <a href="https://arusa.cl/en/tournament/1328550/summary" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">arusa.cl</a>
        </p>
      </div>
    </div>
  );
}
