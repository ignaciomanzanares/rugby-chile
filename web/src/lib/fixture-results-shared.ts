import type { DivisionKey } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface FixtureResult {
  finished: boolean;
  homeScore: number;
  awayScore: number;
  division?: DivisionKey;
  round?: number;
}

/** Server-usable: trae /results como Record (para sembrar el shell ISR). {} si falla. */
export async function fetchFixtureResults(init?: RequestInit): Promise<Record<string, FixtureResult>> {
  try {
    const res = await fetch(`${API_URL}/api/v1/results`, init);
    if (!res.ok) return {};
    return (await res.json()) as Record<string, FixtureResult>;
  } catch {
    return {};
  }
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
