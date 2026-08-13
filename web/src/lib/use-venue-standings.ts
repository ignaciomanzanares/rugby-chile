"use client";

import { useEffect, useState } from "react";
import type { DivisionKey, StandingRow } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Home-only / away-only standings with full rugby bonus points (offensive try
 * bonus included), computed server-side from per-match tries. Only fetched when
 * `enabled` (i.e. the user picked the Local/Visita filter), since the try-bonus
 * scrape is heavy on a cold cache.
 */
export function useVenueStandings(division: DivisionKey, enabled: boolean): {
  home: StandingRow[] | null;
  away: StandingRow[] | null;
  loading: boolean;
} {
  const [data, setData] = useState<{ home: StandingRow[]; away: StandingRow[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${API_URL}/api/v1/leverade/venue-standings?division=${division}`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setData(d && d.home && d.away ? { home: d.home, away: d.away } : null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [division, enabled]);

  return { home: data?.home ?? null, away: data?.away ?? null, loading };
}
