"use client";

import { useEffect, useState } from "react";
import type { DivisionKey } from "@/lib/tournament";
import { fetchLeveradeResults, type LeveradeResult } from "@/lib/leverade";

export type { LeveradeResult };

const POLL_INTERVAL = 60_000;

// Module-level cache so multiple components on the same page share one fetch.
// Keys are `${division}|${home}|${away}` (the same pair plays in all three
// divisions, so an unqualified key would collide).
let moduleCache: { data: Map<string, LeveradeResult>; ts: number } | null = null;
const CACHE_TTL = 30 * 1000;

async function loadResults(opts?: { bypassCache?: boolean }): Promise<Map<string, LeveradeResult>> {
  if (!opts?.bypassCache && moduleCache && Date.now() - moduleCache.ts < CACHE_TTL) {
    return moduleCache.data;
  }
  const map = new Map(Object.entries(await fetchLeveradeResults()));
  moduleCache = { data: map, ts: Date.now() };
  return map;
}

export function useLeveradeResults(
  // Server-fetched results (plain object) used to seed the first render so the
  // SSR'd scores are already fresh instead of flashing the static fixture.
  initialResults?: Record<string, LeveradeResult>,
): Map<string, LeveradeResult> {
  const [results, setResults] = useState<Map<string, LeveradeResult>>(
    () => new Map(Object.entries(initialResults ?? {})),
  );

  useEffect(() => {
    let cancelled = false;

    function load(opts?: { bypassCache?: boolean }) {
      loadResults(opts)
        .then((m) => { if (!cancelled && m.size) setResults(m); })
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
  round?: number,
): LeveradeResult | undefined {
  // In a double round-robin the same pairing plays twice (home/away swapped in a
  // later round), and the static fixtures / DB sometimes label a leg opposite to
  // arusa — so neither the direct nor the reversed key alone identifies the leg.
  // Gate both on the round so the 2nd leg never shows the 1st leg's score.
  const ok = (r?: number) => round == null || r === round;
  const direct = results.get(`${division}|${home}|${away}`);
  if (direct && ok(direct.round)) return direct;
  const reversed = results.get(`${division}|${away}|${home}`);
  if (reversed && ok(reversed.round)) {
    return { ...reversed, homeScore: reversed.awayScore, awayScore: reversed.homeScore };
  }
  return undefined;
}
