"use client";

import { useCallback, useEffect, useState } from "react";
import type { DivisionKey } from "@/lib/tournament";
import { startAdaptivePoll } from "@/lib/poll";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface LivePlayerStat {
  name: string;
  team: string;
  teamSlug: string;
  matches: number;
  points: number;
  tries: number;
  conversions: number;
  penalties: number;
  drops: number;
  yellowCards: number;
  redCards: number;
}

/**
 * Per-player stat lines aggregated server-side from live_events (including
 * finished matches). The stats page merges these onto its static baseline.
 * `refresh` lets the page re-pull immediately when a live event lands.
 */
export function useLivePlayerStats(division: DivisionKey): {
  players: LivePlayerStat[];
  refresh: () => void;
} {
  const [players, setPlayers] = useState<LivePlayerStat[]>([]);

  const load = useCallback(() => {
    fetch(`${API_URL}/api/v1/stats/live?division=${division}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPlayers(d?.players ?? []))
      .catch(() => setPlayers([]));
  }, [division]);

  useEffect(() => {
    load();
    return startAdaptivePoll(load);
  }, [load]);

  return { players, refresh: load };
}
