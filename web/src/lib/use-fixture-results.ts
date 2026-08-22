"use client";

import { useEffect, useState } from "react";
import { startAdaptivePoll } from "@/lib/poll";
import { fetchFixtureResults, getFixtureResult, type FixtureResult } from "@/lib/fixture-results-shared";

export { fetchFixtureResults, getFixtureResult };
export type { FixtureResult };

// Reliable, offline final scores from the DB (prediction_fixtures + finished
// live matches), keyed by `${division}|${home}|${away}`. Used as the primary
// score source on the schedule page, with Leverade as a fallback.
export function useFixtureResults(
  initial?: Record<string, FixtureResult>, // seed del server para evitar el flash sin marcadores
): Map<string, FixtureResult> {
  const [results, setResults] = useState<Map<string, FixtureResult>>(
    () => (initial ? new Map(Object.entries(initial)) : new Map()),
  );

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchFixtureResults()
        .then((raw) => { if (!cancelled) setResults(new Map(Object.entries(raw))); })
        .catch(() => {}); // fail silently — Leverade/static dates are the fallback
    };
    load();
    const stop = startAdaptivePoll(load);
    return () => { cancelled = true; stop(); };
  }, []);

  return results;
}
