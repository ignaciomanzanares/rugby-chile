"use client";

import { useEffect, useState } from "react";
import type { DivisionKey, DivisionPlayerStat } from "@/data/player-stats";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const POLL_INTERVAL = 60_000;

/**
 * Full per-player season stats scraped live from arusa (all 3 grades),
 * persisted server-side through outages. Same shape as the static dataset, so
 * it drops in as the base for the estadísticas leaderboards and club tables.
 * Returns null while loading / if unavailable, so callers can fall back.
 */
export function useArusaPlayerStats(division: DivisionKey): DivisionPlayerStat[] | null {
  const [players, setPlayers] = useState<DivisionPlayerStat[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${API_URL}/api/v1/stats/players?division=${division}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!cancelled) setPlayers(d?.players ?? null); })
        .catch(() => { if (!cancelled) setPlayers(null); });
    };
    load();
    const t = setInterval(load, POLL_INTERVAL);
    return () => { cancelled = true; clearInterval(t); };
  }, [division]);

  return players;
}
