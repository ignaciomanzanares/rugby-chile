/**
 * Total de puntos de un squad: suma los puntos de sus jugadores desde las filas
 * de gameweek, con multiplicador de capitán (×2) y vice (×1.5). Compartido entre
 * la ruta de fantasy y el auto-scorer (fuente única).
 */
export function calcSquadTotalPoints(
  squadPlayers: Array<{ arusaId: string }>,
  captainId: string | null | undefined,
  viceCaptainId: string | null | undefined,
  allScores: Array<{ arusaId: string; pointsEarned: number }>,
): number {
  const arusaIds = new Set(squadPlayers.map((p) => p.arusaId));
  let total = 0;
  for (const score of allScores) {
    if (!arusaIds.has(score.arusaId)) continue;
    let pts = score.pointsEarned;
    if (captainId && score.arusaId === captainId) pts = pts * 2;
    else if (viceCaptainId && score.arusaId === viceCaptainId) pts = Math.round(pts * 1.5);
    total += pts;
  }
  return total;
}

export function calcFantasyPoints(stats: {
  played: boolean;
  tries: number;
  assists: number;
  conversions: number;
  penalties: number;
  drops: number;
  yellowCards: number;
  redCards: number;
  isMvp: boolean;
}): number {
  if (!stats.played) return 0;
  return (
    1 +                          // appeared
    stats.tries * 4 +
    stats.assists * 3 +
    stats.conversions * 1 +
    stats.penalties * 2 +
    stats.drops * 3 +
    (stats.isMvp ? 3 : 0) -
    stats.yellowCards * 1 -
    stats.redCards * 3
  );
}
