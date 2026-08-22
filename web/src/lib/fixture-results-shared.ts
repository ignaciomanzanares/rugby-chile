import type { DivisionKey } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface FixtureResult {
  finished: boolean;
  homeScore: number;
  awayScore: number;
  division?: DivisionKey;
  round?: number;
}

/** Server-usable: trae /results como Record (para sembrar el shell ISR). {} si falla. */
export async function fetchFixtureResults(init?: RequestInit): Promise<Record<string, FixtureResult>> {
  try {
    const res = await fetch(`${API_URL}/api/v1/results`, init);
    if (!res.ok) return {};
    return (await res.json()) as Record<string, FixtureResult>;
  } catch {
    return {};
  }
}

export function getFixtureResult(
  results: Map<string, FixtureResult>,
  division: DivisionKey,
  home: string,
  away: string,
  round?: number,
): FixtureResult | undefined {
  // Directo (misma orientación home/away que el fixture): un resultado sin round
  // es inequívoco acá — solo puede ser ESTA vuelta, porque la vuelta espejo se
  // guarda bajo la clave invertida. Aceptar el round-less directo es lo que
  // arregla la transición en-vivo→finalizado: al terminar un partido en vivo su
  // final (que no trae round, viene de una tabla sin columna round) tiene que
  // seguir mostrándose de inmediato, no caer al fixture estático.
  const direct = results.get(`${division}|${home}|${away}`);
  if (direct && (round == null || direct.round == null || direct.round === round)) return direct;

  // Invertida = la vuelta ESPEJO. Solo confiar si el round calza exacto. Un
  // resultado invertido SIN round no se puede atribuir a una vuelta y marcaba
  // como "Finalizado" un partido futuro (Stade Francais–DOBS de la fecha 16
  // mostraba el marcador round-less de la vuelta con DOBS de local). Si el
  // llamador no sabe el round (round == null), se acepta la invertida como mejor
  // estimación de un mismo partido guardado en orden opuesto.
  const reversed = results.get(`${division}|${away}|${home}`);
  const okReversed = round == null || (reversed?.round != null && reversed.round === round);
  if (reversed && okReversed) {
    return { ...reversed, homeScore: reversed.awayScore, awayScore: reversed.homeScore };
  }
  return undefined;
}
