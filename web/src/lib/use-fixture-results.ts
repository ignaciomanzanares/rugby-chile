"use client";

import { useEffect, useState } from "react";
import type { DivisionKey } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const POLL_INTERVAL = 60_000;

export interface FixtureResult {
  finished: boolean;
  homeScore: number;
  awayScore: number;
  division?: DivisionKey;
  round?: number;
}

// Reliable, offline final scores from the DB (prediction_fixtures + finished
// live matches), keyed by `${division}|${home}|${away}`. Used as the primary
// score source on the schedule page, with Leverade as a fallback.
async function fetchResults(): Promise<Map<string, FixtureResult>> {
  const res = await fetch(`${API_URL}/api/v1/results`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw: Record<string, FixtureResult> = await res.json();
  return new Map(Object.entries(raw));
}

export function useFixtureResults(): Map<string, FixtureResult> {
  const [results, setResults] = useState<Map<string, FixtureResult>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchResults()
        .then((m) => { if (!cancelled) setResults(m); })
        .catch(() => {}); // fail silently — Leverade/static dates are the fallback
    };
    load();
    const t = setInterval(load, POLL_INTERVAL);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return results;
}

export function getFixtureResult(
  results: Map<string, FixtureResult>,
  division: DivisionKey,
  home: string,
  away: string,
): FixtureResult | undefined {
  // Prefer the exact home/away orientation. The static ROUNDS fixtures and the
  // DB sometimes label the same match with opposite home/away, so fall back to
  // the reversed key and swap the scores to match the requested orientation.
  // Direct-first keeps separate home/away legs correct in a double round-robin.
  const direct = results.get(`${division}|${home}|${away}`);
  if (direct) return direct;
  const reversed = results.get(`${division}|${away}|${home}`);
  if (reversed) {
    return { ...reversed, homeScore: reversed.awayScore, awayScore: reversed.homeScore };
  }
  return undefined;
}
