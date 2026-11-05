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
  grupos: { nombre: string; grupoId: string; partidos: SevenPartido[] }[];
  copas: SevenCopa[];
  clasificacion: SevenPuesto[];
  jugada: boolean;
}
export interface SevenFila {
  pos: number; team: string;
  pj: number; pg: number; pe: number; pp: number;
  pf: number; pc: number; diff: number; pts: number;
}
/**
 * Una fila de la tabla OFICIAL del circuito. La publica ARUSA: la carga a mano
 * en Leverade, en un grupo aparte de partidos ficticios cuyo score lleva los
 * puntos. No es nuestra cuenta.
 */
export interface SevenOficial {
  pos: number;
  team: string;
  pts: number;
  porJornada: { ronda: string; fecha: string | null; pts: number }[];
}
export interface SevenJugador {
  nombre: string; equipo: string;
  tries: number; puntos: number; amarillas: number; rojas: number;
  conversiones: number; penales: number; drops: number; penaltyTries: number;
}
/**
 * Un evento derivado de la diferencia entre dos fotos de las estadísticas.
 * Trae el nombre y qué hizo; el minuto es la VENTANA entre fotos, no el reloj
 * del partido.
 */
export interface SevenEvento {
  jugador: string;
  equipo: string;
  tipo: string;
  cantidad: number;
  desde: string;
  hasta: string;
}
export interface SevenCircuito {
  tournamentId: string;
  nombre: string;
  equipos: { name: string; logo: string | null }[];
  tabla: SevenFila[];
  oficial: SevenOficial[];
  etapas: SevenEtapa[];
  jugadores: SevenJugador[];
  eventos: SevenEvento[];
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
