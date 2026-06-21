"use client";

import { useEffect, useState } from "react";
import { connectSocket, disconnectSocket, type LiveMatch } from "@/lib/socket";

export type { LiveMatch };

/**
 * Normalizes a division label (raw arusa string or DivisionKey) to a stable key.
 * Mirrors the API's liveDivisionKey so the same pair in different divisions
 * never collide. The same home/away plays in all three divisions, so the map
 * MUST be keyed by division too — otherwise the last-broadcast row (often a
 * 0-0 Pre-Intermedia) overwrites the real Primera score.
 */
function divKey(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("pre")) return "PRE_INTERMEDIA";
  if (s.includes("intermedia")) return "INTERMEDIA";
  if (s.includes("primera")) return "PRIMERA";
  return s.toUpperCase();
}

function liveKey(division: string, home: string, away: string): string {
  return `${divKey(division)}|${home}|${away}`;
}

/**
 * Subscribes to the Socket.IO live feed and returns a lookup map.
 * Key: `${division}|${homeTeam}|${awayTeam}` (case-sensitive on team names,
 * which match tournament.ts).
 */
export function useLiveMatches(): Map<string, LiveMatch> {
  const [matches, setMatches] = useState<Map<string, LiveMatch>>(new Map());

  useEffect(() => {
    const socket = connectSocket();

    function toMap(list: LiveMatch[]): Map<string, LiveMatch> {
      const m = new Map<string, LiveMatch>();
      for (const match of list) {
        m.set(liveKey(match.division, match.homeTeam, match.awayTeam), match);
      }
      return m;
    }

    const onInit = (list: LiveMatch[]) => setMatches(toMap(list));
    const onUpdate = (updated: LiveMatch) => {
      setMatches((prev) => {
        const next = new Map(prev);
        next.set(liveKey(updated.division, updated.homeTeam, updated.awayTeam), updated);
        return next;
      });
    };

    socket.on("live:init", onInit);
    socket.on("match:update", onUpdate);

    return () => {
      socket.off("live:init", onInit);
      socket.off("match:update", onUpdate);
      disconnectSocket();
    };
  }, []);

  return matches;
}

/** Returns the live match for a given division + home/away pair, or undefined. */
export function getLive(
  liveMap: Map<string, LiveMatch>,
  division: string,
  home: string,
  away: string,
): LiveMatch | undefined {
  return liveMap.get(liveKey(division, home, away));
}
