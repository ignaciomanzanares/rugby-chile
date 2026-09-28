"use client";

import { useEffect, useState } from "react";
import type { DivisionKey } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Números de "fecha" sintéticos con los que viven los playoffs en el navegador
// de fechas. Van después de la 18 para que el orden del selector sea el orden
// real del torneo. No existen en Leverade: son nuestros.
export const RONDA_SEMIS = 19;
export const RONDA_FINAL = 20;

export interface Semifinal {
  label: string;
  homeSeed: number;
  awaySeed: number;
  home: string;
  away: string;
  /** ISO. Va a mano en la API: Leverade no publica los playoffs. null si aún no se sabe. */
  date: string | null;
  time: string | null;
  venue: string | null;
  /** Marcador, si ya se jugó. */
  homeScore: number | null;
  awayScore: number | null;
  finished: boolean;
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
  /** Cuándo se juega la final, y su marcador si ya se jugó. */
  final?: {
    date: string; time: string; venue: string;
    home: string | null; away: string | null;
    homeScore?: number | null; awayScore?: number | null; finished?: boolean;
  };
}

/**
 * Cuadro de semifinales de la división.
 *
 * No sale de Leverade, que no publica los playoffs: se deduce de la tabla final
 * según el reglamento (1º vs 4º, 2º vs 3º).
 *
 * REINTENTA, y eso importa: de este dato depende que la fecha "Semifinales"
 * exista en el selector. Cuando la primera consulta fallaba —arranque en frío
 * de la API, red lenta— se quedaba en null para siempre y la flecha de avanzar
 * quedaba muerta, sin forma de llegar a las semis hasta recargar la página.
 */
export function usePlayoffs(division: DivisionKey, inicial?: Playoffs | null): Playoffs | null {
  // `inicial` lo siembra el servidor (ISR) para que el home no parpadee entre
  // "no hay playoffs" y el cuadro. El cliente igual refresca: el marcador de una
  // semifinal en curso no puede quedarse en la foto de hace dos minutos.
  const [data, setData] = useState<Playoffs | null>(inicial ?? null);
  useEffect(() => {
    let vivo = true;
    const intentar = async (queda: number): Promise<void> => {
      try {
        const r = await fetch(`${API_URL}/api/v1/playoffs?division=${division}`, { cache: "no-store" });
        const d = r.ok ? await r.json() : null;
        if (!vivo) return;
        if (d?.semifinals?.length) { setData(d); return; }
      } catch { /* se reintenta abajo */ }
      if (!vivo) return;
      // Sin datos útiles: se espera un poco más en cada intento (1s, 3s, 7s).
      if (queda > 0) setTimeout(() => void intentar(queda - 1), (4 - queda) * 2000 + 1000);
    };
    void intentar(3);
    return () => { vivo = false; };
  }, [division]);
  return data;
}
