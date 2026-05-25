"use client";

import { useEffect, useState } from "react";
import type { DivisionKey, StandingRow } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const POLL_INTERVAL = 60_000;

// arusa.cl uses slightly different display names — map them onto our canonical
// names so logos/colours and live overlays match by team key.
const NAME_ALIASES: Record<string, string> = {
  "Old Mackayans": "Old Macks",
  "Prince of Wales CC": "PWCC",
  "Stade Français": "Stade Francais",
  "Univ. Católica": "UC",
  "Old Boys RC": "Old Boys",
  "Old Johns RC": "Old Johns",
  "Old Reds RC": "Old Reds",
};

function canonicalize(name: string): string {
  return NAME_ALIASES[name] ?? name;
}

async function fetchStandings(division: DivisionKey): Promise<StandingRow[] | null> {
  const res = await fetch(`${API_URL}/api/v1/leverade/standings?division=${division}`);
  if (!res.ok) return null;
  const data = await res.json();
  const raw: StandingRow[] | null = data?.rows ?? null;
  if (!raw) return null;
  return raw.map((r) => ({ ...r, team: canonicalize(r.team) }));
}

export function useLeveradeStandings(division: DivisionKey): {
  rows: StandingRow[] | null;
  loading: boolean;
} {
  const [rows, setRows] = useState<StandingRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    function load() {
      fetchStandings(division)
        .then((r) => {
          if (cancelled) return;
          setRows(r);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setRows(null);
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
