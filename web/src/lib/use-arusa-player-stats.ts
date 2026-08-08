"use client";

import { useEffect, useState } from "react";
import type { DivisionKey, DivisionPlayerStat } from "@/data/player-stats";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const POLL_INTERVAL = 60_000;

/**
 * Full per-player season stats scraped live from arusa (all 3 grades),
 * persisted server-side through outages. Same shape as the static dataset, so
 * it drops in as the base for the estadísticas leaderboards and club tables.
 * `players` is null while loading / if unavailable; `loading` is true until the
 * first fetch for the CURRENT division resolves. Al cambiar de división se
 * resetea a null: así no se muestran los jugadores de la división anterior
 * mientras carga la nueva (eso hacía "aparecer tuset de Primera en Intermedia").
 */
export function useArusaPlayerStats(
  division: DivisionKey,
): { players: DivisionPlayerStat[] | null; loading: boolean } {
  const [players, setPlayers] = useState<DivisionPlayerStat[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setPlayers(null);
    setLoading(true);
    const load = (first: boolean) => {
      fetch(`${API_URL}/api/v1/stats/players?division=${division}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          setPlayers(d?.players ?? null);
          if (first) setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setPlayers(null);
          if (first) setLoading(false);
        });
    };
    load(true);
    const t = setInterval(() => load(false), POLL_INTERVAL);
    return () => { cancelled = true; clearInterval(t); };
  }, [division]);

  return { players, loading };
}
