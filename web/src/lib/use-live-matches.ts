"use client";

import { useEffect, useState } from "react";
import { connectSocket, disconnectSocket, type LiveMatch } from "@/lib/socket";

export type { LiveMatch };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
    let cancelled = false;
    const socket = connectSocket();

    function toMap(list: LiveMatch[]): Map<string, LiveMatch> {
      const m = new Map<string, LiveMatch>();
      for (const match of list) {
        m.set(liveKey(match.division, match.homeTeam, match.awayTeam), match);
      }
      return m;
    }

    // Siembra por REST al montar. El server emite "live:init" (todos los
    // partidos) SOLO al conectar, y el socket es singleton: una instancia que
    // monta con el socket ya conectado (p. ej. la home, tras el ticker del
    // layout) se pierde ese init y quedaría vacía hasta el próximo match:update.
    // El fetch la deja al día al toque, rellenando sin pisar datos del socket ya
    // más frescos.
    fetch(`${API_URL}/api/v1/live`, { cache: "no-store" })
      .then((r) => r.json())
      .then((list: LiveMatch[]) => {
        if (cancelled || !Array.isArray(list)) return;
        setMatches((prev) => {
          if (prev.size === 0) return toMap(list);
          const next = new Map(prev);
          for (const match of list) {
            const k = liveKey(match.division, match.homeTeam, match.awayTeam);
            if (!next.has(k)) next.set(k, match);
          }
          return next;
        });
      })
      .catch(() => {});

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
      cancelled = true;
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
