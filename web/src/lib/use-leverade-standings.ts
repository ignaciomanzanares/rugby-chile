"use client";

import { useEffect, useState } from "react";
import type { DivisionKey, StandingRow } from "@/lib/tournament";
import { fetchLeveradeStandings } from "@/lib/leverade";

const POLL_INTERVAL = 60_000;

export function useLeveradeStandings(
  division: DivisionKey,
  // Server-fetched rows used to seed the first render so the SSR'd HTML is
  // already fresh — without this the hook starts at null and the component
  // briefly paints its static fallback snapshot before the client fetch lands.
  initialRows?: StandingRow[] | null,
): {
  rows: StandingRow[] | null;
  loading: boolean;
} {
  const [rows, setRows] = useState<StandingRow[] | null>(initialRows ?? null);
  const [loading, setLoading] = useState(initialRows == null);

  useEffect(() => {
    let cancelled = false;

    function load() {
      fetchLeveradeStandings(division).then((r) => {
        if (cancelled) return;
        // Keep the last good rows on a transient failure (r === null) rather
        // than blanking back to the static fallback and re-flashing.
        if (r) setRows(r);
        setLoading(false);
      });
    }

    load();
    const t = setInterval(load, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [division]);

  return { rows, loading };
}
