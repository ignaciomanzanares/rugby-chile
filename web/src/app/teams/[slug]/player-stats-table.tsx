"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Star, ArrowUpDown, ArrowDown } from "lucide-react";
import type { Player } from "@/data/clubs";
import { getPositionInfo, POSITION_SHORT, POSITION_LABELS } from "@/lib/fantasy";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const GRADES = [
  { key: "PRIMERA", label: "Primera" },
  { key: "INTERMEDIA", label: "Intermedia" },
  { key: "PRE_INTERMEDIA", label: "Pre-Intermedia" },
] as const;

type RosterPlayer = Player & { grade: string };

type SortKey = "matches" | "points" | "tries" | "conversions" | "penalties" | "yellowCards" | "redCards";

const COLUMNS: { key: SortKey; label: string; hideAt?: string; bold?: boolean }[] = [
  { key: "matches",      label: "PJ" },
  { key: "points",       label: "PTS", bold: true },
  { key: "tries",        label: "T",   hideAt: "sm:table-cell" },
  { key: "conversions",  label: "C",   hideAt: "sm:table-cell" },
  { key: "penalties",    label: "P",   hideAt: "md:table-cell" },
  { key: "yellowCards",  label: "TA",  hideAt: "lg:table-cell" },
  { key: "redCards",     label: "TR",  hideAt: "lg:table-cell" },
];

export function PlayerStatsTable({ players: staticPlayers, teamSlug }: { players: Player[]; teamSlug?: string }) {
  const [sortBy, setSortBy] = useState<SortKey>("points");
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");

  // Pull this club's players across ALL 3 grades (live arusa); static fallback.
  const [live, setLive] = useState<RosterPlayer[] | null>(null);
  useEffect(() => {
    if (!teamSlug) return;
    let cancelled = false;
    const load = async () => {
      const all: RosterPlayer[] = [];
      await Promise.all(
        GRADES.map(async (g) => {
          try {
            const r = await fetch(`${API_URL}/api/v1/stats/players?division=${g.key}`);
            if (!r.ok) return;
            const d = await r.json();
            for (const p of (d.players ?? []) as Array<Player & { teamSlug?: string }>) {
              if (p.teamSlug === teamSlug) all.push({ ...p, grade: g.label });
            }
          } catch { /* ignore a failing grade */ }
        }),
      );
      if (!cancelled) setLive(all.length ? all : null);
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [teamSlug]);

  const roster: RosterPlayer[] = live ?? staticPlayers.map((p) => ({ ...p, grade: "Primera" }));
  const gradesPresent = useMemo(
    () => GRADES.map((g) => g.label).filter((label) => roster.some((p) => p.grade === label)),
    [roster],
  );

  const sorted = useMemo(() => {
    let list: RosterPlayer[];
    if (gradeFilter === "ALL") {
      // Merge a player's rows across grades so "Todas" compares TOTALS (a club's
      // overall try-leader / scorer), not per-grade splits — a player who scores
      // in Intermedia AND Pre shows the sum here. arusa's player id is stable
      // across grades. The per-grade filters below still show only that grade.
      const NUM_FIELDS: (keyof Player)[] = [
        "matches", "points", "tries", "penaltyTries", "conversions",
        "penalties", "drops", "yellowCards", "redCards", "mvp",
      ];
      const byId = new Map<string, RosterPlayer & { _grades: Set<string> }>();
      for (const p of roster) {
        const cur = byId.get(p.id);
        if (cur) {
          for (const f of NUM_FIELDS) (cur[f] as number) += p[f] as number;
          cur._grades.add(p.grade);
        } else {
          byId.set(p.id, { ...p, _grades: new Set([p.grade]) });
        }
      }
      list = [...byId.values()].map((p) => ({ ...p, grade: p._grades.size > 1 ? "Todas" : p.grade }));
    } else {
      list = roster.filter((p) => p.grade === gradeFilter);
    }
    return [...list].sort((a, b) => b[sortBy] - a[sortBy] || b.points - a.points || b.tries - a.tries);
  }, [roster, gradeFilter, sortBy]);

  const showGradeChip = gradeFilter === "ALL" && gradesPresent.length > 1;

  return (
    <div className="space-y-3">
      {/* Grade filter */}
      {gradesPresent.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mr-1">División:</span>
          {["ALL", ...gradesPresent].map((g) => (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                gradeFilter === g
                  ? "bg-red-600 text-white"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {g === "ALL" ? "Todas" : g}
            </button>
          ))}
          <span className="text-xs text-muted-foreground/70 ml-auto">{sorted.length} jugadores</span>
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-card/80 border-b border-border">
              <th className="text-left px-4 py-3 text-muted-foreground text-xs uppercase tracking-wide font-semibold">Jugador</th>
              {COLUMNS.map((col) => {
                const active = sortBy === col.key;
                const Icon = active ? ArrowDown : ArrowUpDown;
                return (
                  <th
                    key={col.key}
                    className={`text-center px-3 py-3 text-xs uppercase tracking-wide font-semibold ${col.hideAt ? `hidden ${col.hideAt}` : ""}`}
                  >
                    <button
                      onClick={() => setSortBy(col.key)}
                      className={`inline-flex items-center justify-center gap-1 transition-colors ${
                        active ? "text-red-400" : "text-muted-foreground hover:text-foreground/80"
                      }`}
                      title={`Ordenar por ${col.label}`}
                    >
                      {col.label}
                      <Icon className="h-3 w-3" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={1 + COLUMNS.length} className="text-center py-6 text-muted-foreground text-sm">
                  No hay jugadores en esta selección.
                </td>
              </tr>
            ) : (
              sorted.map((p, i) => (
                <tr key={`${p.id}-${p.grade}`} className={`border-b border-border last:border-0 hover:bg-card/50 transition-colors ${i === 0 ? "bg-yellow-500/5" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {i === 0 && <Star className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />}
                      <Link href={`/jugador/${p.id}`} className={`font-medium hover:text-red-400 transition-colors ${i === 0 ? "text-foreground" : "text-foreground/80"}`}>{p.name}</Link>
                      {(() => {
                        const pos = getPositionInfo(p.id);
                        return pos ? (
                          <span
                            className="text-[9px] font-bold uppercase tracking-wide text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5 flex-shrink-0"
                            title={pos.secondary ? `${POSITION_LABELS[pos.primary]} · 2ª: ${POSITION_LABELS[pos.secondary]}` : POSITION_LABELS[pos.primary]}
                          >
                            {POSITION_SHORT[pos.primary]}{pos.secondary ? `/${POSITION_SHORT[pos.secondary]}` : ""}
                          </span>
                        ) : null;
                      })()}
                      {showGradeChip && (
                        <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground bg-muted rounded px-1.5 py-0.5">{p.grade}</span>
                      )}
                    </div>
                  </td>
                  {COLUMNS.map((col) => {
                    const value = p[col.key];
                    const isActive = sortBy === col.key;
                    if (col.key === "yellowCards" || col.key === "redCards") {
                      return (
                        <td key={col.key} className={`text-center px-3 py-3 ${col.hideAt ? `hidden ${col.hideAt}` : ""}`}>
                          {value > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <span
                                className={`inline-block w-3 h-4 rounded-[2px] ${col.key === "yellowCards" ? "bg-yellow-400" : "bg-red-500"}`}
                                title={`${value} ${col.key === "yellowCards" ? "amarilla" : "roja"}(s)`}
                              />
                              {value > 1 && <span className="text-xs text-muted-foreground tabular-nums">×{value}</span>}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                      );
                    }
                    return (
                      <td
                        key={col.key}
                        className={`text-center px-3 py-3 tabular-nums ${col.hideAt ? `hidden ${col.hideAt}` : ""} ${
                          col.bold || isActive ? "font-black text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
