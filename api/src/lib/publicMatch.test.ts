import { describe, it, expect } from "vitest";
import { publicMatch } from "./publicMatch";

const ahora = new Date("2026-09-12T15:47:00Z");

// Old Reds-Old Macks, Pre-Intermedia, fecha 18, tal como Postgres los devolvía:
// el planillero cargó el primer tiempo entero de una, así que los 14 eventos
// quedaron con minuto 14 y salieron en orden arbitrario (se veía 22-27 arriba
// del 5-0). Los marcadores son los reales del partido.
const desordenados = [
  ["away", "TRY", 7, 5], ["home", "TRY", 12, 10], ["home", "CONVERSION", 14, 10],
  ["home", "PENALTY", 17, 15], ["home", "TRY", 22, 27], ["away", "TRY", 24, 32],
  ["home", "TRY", 5, 0], ["home", "CONVERSION", 7, 0], ["away", "TRY", 7, 10],
  ["away", "TRY", 14, 15], ["away", "TRY", 17, 20], ["away", "CONVERSION", 17, 22],
  ["away", "TRY", 17, 27], ["home", "CONVERSION", 24, 27],
].map(([team, type, homeScore, awayScore], i) => ({
  id: `e${i}`, matchId: "m1", team, type, minute: 14, playerName: null,
  points: 0, homeScore, awayScore, half: 1, createdAt: ahora,
})) as any[];

const partido = {
  id: "m1", homeTeam: "Old Reds", awayTeam: "Old Macks", division: "PRE_INTERMEDIA",
  venue: "", homeScore: 24, awayScore: 32, homeTries: 3, awayTries: 6,
  minute: 14, status: "LIVE",
} as any;

describe("cronología del minuto a minuto", () => {
  it("reconstruye el orden real aunque todos compartan minuto", () => {
    const { events } = publicMatch(partido, desordenados);
    const marcadores = events.map((e: any) => `${e.homeScore}-${e.awayScore}`);
    expect(marcadores).toEqual([
      "5-0", "7-0", "7-5", "7-10", "12-10", "14-10", "14-15",
      "17-15", "17-20", "17-22", "17-27", "22-27", "24-27", "24-32",
    ]);
  });

  it("el marcador nunca retrocede", () => {
    const { events } = publicMatch(partido, desordenados);
    let previo = -1;
    for (const e of events as any[]) {
      const total = e.homeScore + e.awayScore;
      expect(total).toBeGreaterThan(previo);
      previo = total;
    }
  });

  it("el minuto sigue mandando sobre el marcador", () => {
    // Un evento de un minuto anterior va antes aunque su total sea mayor: pasa
    // si arusa aporta eventos con minuto real junto a los derivados.
    const mezcla = [
      { ...desordenados[0], minute: 70, homeScore: 3, awayScore: 0 },
      { ...desordenados[1], minute: 5, homeScore: 50, awayScore: 0 },
    ];
    const { events } = publicMatch(partido, mezcla as any);
    expect((events as any[]).map((e) => e.minute)).toEqual([5, 70]);
  });
});
