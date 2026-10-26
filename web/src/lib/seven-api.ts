const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface SevenPartido {
  id: string;
  fecha: string | null;
  hora: string | null;
  grupo: string;
  ronda: string;
  home: string | null;
  away: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homePts: number | null;
  awayPts: number | null;
  finished: boolean;
}
export interface SevenCopa {
  nombre: string;
  campeon: string | null;
  finalista: string | null;
  campeonScore: number | null;
  finalistaScore: number | null;
  partidos: SevenPartido[];
}
export interface SevenPuesto {
  pos: number; team: string; copa: string; detalle: string; margen: number | null;
}
export interface SevenEtapa {
  numero: number;
  fecha: string | null;
  grupos: { nombre: string; partidos: SevenPartido[] }[];
  copas: SevenCopa[];
  clasificacion: SevenPuesto[];
  jugada: boolean;
}
export interface SevenFila {
  pos: number; team: string;
  pj: number; pg: number; pe: number; pp: number;
  pf: number; pc: number; diff: number; pts: number;
}
export interface SevenCircuito {
  tournamentId: string;
  nombre: string;
  equipos: { name: string; logo: string | null }[];
  tabla: SevenFila[];
  etapas: SevenEtapa[];
  sinPuntos: { fecha: string | null; home: string | null; away: string | null }[];
  generadoEn: string;
}

/**
 * El circuito de seven. Devuelve null ante cualquier problema: la pantalla
 * reintenta desde el cliente y nunca hace fallar el render por esto.
 */
export async function fetchSeven(
  init?: RequestInit & { next?: { revalidate?: number } },
): Promise<SevenCircuito | null> {
  try {
    const r = await fetch(`${API_URL}/api/v1/seven`, init);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.tabla ? (d as SevenCircuito) : null;
  } catch {
    return null;
  }
}
