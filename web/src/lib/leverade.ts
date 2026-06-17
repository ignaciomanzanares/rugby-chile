import type { DivisionKey, StandingRow } from "@/lib/tournament";

// Shared (isomorphic) Leverade helpers. No "use client" directive so the
// async fetchers can run on the server to seed the client hooks' initial
// state — that's what stops the stale-snapshot flash on first paint.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// arusa.cl uses slightly different display names — map them onto our canonical
// names so logos/colours and live overlays match by team key.
export const NAME_ALIASES: Record<string, string> = {
  "Old Mackayans": "Old Macks",
  "Prince of Wales CC": "PWCC",
  "Stade Français": "Stade Francais",
  "Univ. Católica": "UC",
  "Old Boys RC": "Old Boys",
  "Old Johns RC": "Old Johns",
  "Old Reds RC": "Old Reds",
};

export function canonicalize(name: string): string {
  return NAME_ALIASES[name] ?? name;
}

export interface LeveradeResult {
  finished: boolean;
  homeScore?: number;
  awayScore?: number;
  division?: DivisionKey;
  round?: number;
}

/** Fetch the live Leverade standings for a division, canonicalized.
 * Returns null on any failure so callers fall back to the static snapshot. */
export async function fetchLeveradeStandings(
  division: DivisionKey,
  init?: RequestInit,
): Promise<StandingRow[] | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/leverade/standings?division=${division}`, init);
    if (!res.ok) return null;
    const data = await res.json();
    const raw: StandingRow[] | null = data?.rows ?? null;
    if (!raw) return null;
    return raw.map((r) => ({ ...r, team: canonicalize(r.team) }));
  } catch {
    return null;
  }
}

/** Fetch the Leverade results as a plain (serializable) object keyed by
 * `${division}|${home}|${away}`. Returns {} on failure. */
export async function fetchLeveradeResults(
  init?: RequestInit,
): Promise<Record<string, LeveradeResult>> {
  try {
    const res = await fetch(`${API_URL}/api/v1/leverade/results`, init);
    if (!res.ok) return {};
    return (await res.json()) as Record<string, LeveradeResult>;
  } catch {
    return {};
  }
}
