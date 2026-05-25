"use client";

import { useEffect, useState } from "react";
import type { DivisionKey } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const POLL_INTERVAL = 60_000;

export interface LeveradeResult {
  finished: boolean;
  homeScore?: number;
  awayScore?: number;
  division?: DivisionKey;
}

// Module-level cache so multiple components on the same page share one fetch.
// Keys are `${division}|${home}|${away}` (the same pair plays in all three
// divisions, so an unqualified key would collide).
let moduleCache: { data: Map<string, LeveradeResult>; ts: number } | null = null;
const CACHE_TTL = 30 * 1000;

async function fetchResults(opts?: { bypassCache?: boolean }): Promise<Map<string, LeveradeResult>> {
  if (!opts?.bypassCache && moduleCache && Date.now() - moduleCache.ts < CACHE_TTL) {
    return moduleCache.data;
  }
  const res = await fetch(`${API_URL}/api/v1/leverade/results`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw: Record<string, LeveradeResult> = await res.json();
  const map = new Map(Object.entries(raw));
  moduleCache = { data: map, ts: Date.now() };
  return map;
}

export function useLeveradeResults(): Map<string, LeveradeResult> {
  const [results, setResults] = useState<Map<string, LeveradeResult>>(new Map());

  useEffect(() => {
    let cancelled = false;

    function load(opts?: { bypassCache?: boolean }) {
      fetchResults(opts)
        .then((m) => { if (!cancelled) setResults(m); })
        .catch(() => {}); // fail silently — static dates are the fallback
    }

    load();
    const t = setInterval(() => load({ bypassCache: true }), POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return results;
}

/** Look up a match in the Leverade results map. Requires the division so the
 * lookup doesn't collide with same-pair fixtures in other divisions. */
export function getLeveradeResult(
  results: Map<string, LeveradeResult>,
  division: DivisionKey,
  home: string,
  away: string,
): LeveradeResult | undefined {
  return results.get(`${division}|${home}|${away}`);
}
