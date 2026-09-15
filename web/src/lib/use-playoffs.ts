"use client";

import { useEffect, useState } from "react";
import type { DivisionKey } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Número de "fecha" con el que viven las semis en el navegador de fechas. */
export const RONDA_SEMIS = 19;

export interface Semifinal {
  label: string;
  homeSeed: number;
  awaySeed: number;
  home: string;
  away: string;
  /** ISO. Va a mano en la API: Leverade no publica los playoffs. null si aún no se sabe. */
  date: string | null;
  venue: string | null;
  /** null en Intermedia y Pre: el modelo de proyección sólo existe para Primera. */
  homeWinPct: number | null;
  drawPct: number | null;
  awayWinPct: number | null;
  expHome: number | null;
  expAway: number | null;
}

export interface Playoffs {
  division: DivisionKey;
  /** true = fase regular terminada, el cuadro ya no puede cambiar. */
  decided: boolean;
  semifinals: Semifinal[];
}

/**
 * Cuadro de semifinales de la división.
 *
 * No sale de Leverade, que no publica los playoffs: se deduce de la tabla final
 * según el reglamento (1º vs 4º, 2º vs 3º). Si falla, devuelve null y la vista
 * simplemente no muestra la fecha de semis.
 */
export function usePlayoffs(division: DivisionKey): Playoffs | null {
  const [data, setData] = useState<Playoffs | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch(`${API_URL}/api/v1/playoffs?division=${division}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setData(d?.semifinals?.length ? d : null); })
      .catch(() => { if (vivo) setData(null); });
    return () => { vivo = false; };
  }, [division]);
  return data;
}
