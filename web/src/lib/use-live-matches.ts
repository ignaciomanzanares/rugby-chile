"use client";

import { useEffect, useState } from "react";
import { connectSocket, disconnectSocket, type LiveMatch } from "@/lib/socket";

export type { LiveMatch };

/**
 * Subscribes to the Socket.IO live feed and returns a lookup map.
 * Key: `${homeTeam}|${awayTeam}` (case-sensitive, matches tournament.ts names).
 */
export function useLiveMatches(): Map<string, LiveMatch> {
  const [matches, setMatches] = useState<Map<string, LiveMatch>>(new Map());

  useEffect(() => {
    const socket = connectSocket();

    function toMap(list: LiveMatch[]): Map<string, LiveMatch> {
      const m = new Map<string, LiveMatch>();
      for (const match of list) {
        m.set(`${match.homeTeam}|${match.awayTeam}`, match);
      }
      return m;
    }

    const onInit = (list: LiveMatch[]) => setMatches(toMap(list));
    const onUpdate = (updated: LiveMatch) => {
      setMatches((prev) => {
        const next = new Map(prev);
        next.set(`${updated.homeTeam}|${updated.awayTeam}`, updated);
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

/** Returns the live match for a given home/away pair, or undefined. */
export function getLive(
  liveMap: Map<string, LiveMatch>,
  home: string,
  away: string,
): LiveMatch | undefined {
  return liveMap.get(`${home}|${away}`);
}
