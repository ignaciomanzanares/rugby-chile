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
