"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, ArrowUpDown, ArrowDown } from "lucide-react";
import type { Player } from "@/data/clubs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
  // Prefer live arusa player stats for this club (auto-updating); fall back to
  // the static roster while loading or if arusa is unavailable.
  const [livePlayers, setLivePlayers] = useState<Player[] | null>(null);
  useEffect(() => {
    if (!teamSlug) return;
    let cancelled = false;
    const load = () => {
      fetch(`${API_URL}/api/v1/stats/players?division=PRIMERA`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          const all: Player[] | null = d?.players ?? null;
          setLivePlayers(all ? all.filter((p) => (p as { teamSlug?: string }).teamSlug === teamSlug) : null);
        })
        .catch(() => { if (!cancelled) setLivePlayers(null); });
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [teamSlug]);

  const players = livePlayers && livePlayers.length > 0 ? livePlayers : staticPlayers;
  const [sortBy, setSortBy] = useState<SortKey>("points");

  const sorted = useMemo(() => {
    return [...players]
      .filter((p) => p[sortBy] > 0)
      .sort((a, b) => b[sortBy] - a[sortBy] || b.points - a.points || b.tries - a.tries)
      .slice(0, 10);
  }, [players, sortBy]);

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-900/80 border-b border-zinc-800">
            <th className="text-left px-4 py-3 text-zinc-500 text-xs uppercase tracking-wide font-semibold">Jugador</th>
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
                      active ? "text-red-400" : "text-zinc-500 hover:text-zinc-300"
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
              <td colSpan={1 + COLUMNS.length} className="text-center py-6 text-zinc-500 text-sm">
                No hay jugadores con esta estadística.
              </td>
            </tr>
          ) : (
            sorted.map((p, i) => (
              <tr key={p.id} className={`border-b border-zinc-800 last:border-0 hover:bg-zinc-900/50 transition-colors ${i === 0 ? "bg-yellow-500/5" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {i === 0 && <Star className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />}
                    <span className={`font-medium ${i === 0 ? "text-white" : "text-zinc-300"}`}>{p.name}</span>
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
                            {value > 1 && <span className="text-xs text-zinc-400 tabular-nums">×{value}</span>}
                          </span>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={col.key}
                      className={`text-center px-3 py-3 tabular-nums ${col.hideAt ? `hidden ${col.hideAt}` : ""} ${
                        col.bold || isActive ? "font-black text-white" : "text-zinc-400"
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
  );
}
