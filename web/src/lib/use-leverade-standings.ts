"use client";

import { useEffect, useState } from "react";
import type { DivisionKey, StandingRow } from "@/lib/tournament";
import { fetchLeveradeStandingsFull, type PartidoPendiente } from "@/lib/leverade";
import { startAdaptivePoll } from "@/lib/poll";

export function useLeveradeStandings(
  division: DivisionKey,
  // Server-fetched rows used to seed the first render so the SSR'd HTML is
  // already fresh — without this the hook starts at null and the component
  // briefly paints its static fallback snapshot before the client fetch lands.
  initialRows?: StandingRow[] | null,
): {
  rows: StandingRow[] | null;
  // Jugados que Leverade todavía no puntuó: el overlay los mantiene contados.
  pendientes: PartidoPendiente[];
  loading: boolean;
} {
  const [rows, setRows] = useState<StandingRow[] | null>(initialRows ?? null);
  const [pendientes, setPendientes] = useState<PartidoPendiente[]>([]);
  const [loading, setLoading] = useState(initialRows == null);

  useEffect(() => {
    let cancelled = false;

    function load() {
      // Timeout duro: si el API está frío (cold start de Render ~50s) o cuelga,
      // igual resolvemos `loading` para no dejar la tabla en "cargando" para
      // siempre — cae al fallback pasados 15s.
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 15_000);
      fetchLeveradeStandingsFull(division, { signal: ctrl.signal }).then((r) => {
        clearTimeout(to);
        if (cancelled) return;
        // Keep the last good rows on a transient failure (r === null) rather
        // than blanking back to the static fallback and re-flashing.
        if (r) { setRows(r.rows); setPendientes(r.pendientes); }
        setLoading(false);
      });
    }

    load();
    const stop = startAdaptivePoll(load);

    return () => {
      cancelled = true;
      stop();
    };
  }, [division]);

  return { rows, pendientes, loading };
}
