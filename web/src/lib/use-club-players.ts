"use client";

import { useEffect, useState } from "react";
import type { Player } from "@/data/clubs";
import { startAdaptivePoll } from "@/lib/poll";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const GRADES = [
  { key: "PRIMERA", label: "Primera" },
  { key: "INTERMEDIA", label: "Intermedia" },
  { key: "PRE_INTERMEDIA", label: "Pre-Intermedia" },
] as const;

export const GRADE_LABELS = GRADES.map((g) => g.label);

export type RosterPlayer = Player & { grade: string };

/**
 * Roster EN VIVO de un club (los 3 grados) desde arusa. `players` es null
 * mientras carga; `loading` es true hasta que resuelve el primer fetch. Poll
 * cada 60s. Compartido por la tabla de estadísticas y el plantel del club para
 * no duplicar la lógica ni mostrar el dataset estático como si fuera real.
 */
export function useClubPlayers(teamSlug?: string): { players: RosterPlayer[] | null; loading: boolean } {
  const [players, setPlayers] = useState<RosterPlayer[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamSlug) { setLoading(false); return; }
    let cancelled = false;
    const load = async (first: boolean) => {
      const all: RosterPlayer[] = [];
      await Promise.all(
        GRADES.map(async (g) => {
          try {
            const r = await fetch(`${API_URL}/api/v1/stats/players?division=${g.key}`, { cache: "no-cache" });
            if (!r.ok) return;
            const d = await r.json();
            for (const p of (d.players ?? []) as Array<Player & { teamSlug?: string }>) {
              if (p.teamSlug === teamSlug) all.push({ ...p, grade: g.label });
            }
          } catch { /* ignore a failing grade */ }
        }),
      );
      if (cancelled) return;
      setPlayers(all.length ? all : null);
      if (first) setLoading(false);
    };
    load(true);
    const stop = startAdaptivePoll(() => load(false));
    return () => { cancelled = true; stop(); };
  }, [teamSlug]);

  return { players, loading };
}
