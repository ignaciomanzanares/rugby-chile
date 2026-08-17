"use client";

import { useEffect, useState } from "react";
import type { DivisionKey } from "@/lib/tournament";
import { startAdaptivePoll } from "@/lib/poll";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
    const stop = startAdaptivePoll(load);
    return () => { cancelled = true; stop(); };
  }, []);

  return results;
}

export function getFixtureResult(
  results: Map<string, FixtureResult>,
  division: DivisionKey,
  home: string,
  away: string,
  round?: number,
): FixtureResult | undefined {
  // Gate both orientations on the round: the same pairing plays twice in a
  // double round-robin and the DB/fixtures may label a leg opposite to arusa,
  // so only a same-round result identifies this exact leg.
  //
  // A round-less result (r == null) passes the gate: FINISHED live matches come
  // from a table with no round column, so /results emits their final score
  // without one. Dropping those was the transición-en-vivo bug — the instant a
  // match ended it left /live yet its round-less final was rejected here, so the
  // row fell back to the static fixture and showed "no ha comenzado" until
  // Leverade caught up. Each orientation only occurs in one leg, so accepting a
  // round-less final for this exact pair is unambiguous.
  const ok = (r?: number) => round == null || r == null || r === round;
  const direct = results.get(`${division}|${home}|${away}`);
  if (direct && ok(direct.round)) return direct;
  const reversed = results.get(`${division}|${away}|${home}`);
  if (reversed && ok(reversed.round)) {
    return { ...reversed, homeScore: reversed.awayScore, awayScore: reversed.homeScore };
  }
  return undefined;
}
