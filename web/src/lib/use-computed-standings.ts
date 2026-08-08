"use client";

import { useCallback, useEffect, useState } from "react";
import type { DivisionKey, StandingRow } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const POLL_INTERVAL = 60_000;

/**
 * Fetches the server-computed standings (Fecha-4 baseline + FINISHED matches).
 * This is the persisted base for the standings page; the LIVE/HT overlay is
 * applied on top of it client-side. `refresh` lets the page re-pull immediately
 * when a match transitions to FINISHED instead of waiting for the poll.
 */
export function useComputedStandings(division: DivisionKey): {
  rows: StandingRow[] | null;
  loading: boolean;
  refresh: () => void;
} {
  const [rows, setRows] = useState<StandingRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch(`${API_URL}/api/v1/standings/computed?division=${division}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setRows(data?.rows ?? null);
        setLoading(false);
      })
      .catch(() => {
        setRows(null);
        setLoading(false);
      });
  }, [division]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [load]);

  return { rows, loading, refresh: load };
}
