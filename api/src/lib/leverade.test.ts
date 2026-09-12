import { describe, it, expect } from "vitest";
import { partidosSinPuntuar, type MatchMeta } from "./leverade";

const base: MatchMeta = {
  matchId: "1", homeTeam: "Old Reds", awayTeam: "Old Macks", homeTeamId: "h", awayTeamId: "a",
  division: "PRIMERA", round: 18, finished: true, postponed: false, canceled: false,
  datetime: "2026-09-12 18:30:00", homeScore: 20, awayScore: 24,
} as MatchMeta;

const partido = (cambios: Partial<MatchMeta>): MatchMeta => ({ ...base, ...cambios });

describe("partidos jugados que Leverade todavía no puntuó", () => {
  it("toma el que terminó con marcador pero sin puntos de liga", async () => {
    const r = await partidosSinPuntuar("PRIMERA", [partido({})]);
    expect(r).toEqual([{ homeTeam: "Old Reds", awayTeam: "Old Macks", round: 18 }]);
  });

  it("descarta el que ya tiene puntos de liga: la tabla oficial ya lo cuenta", async () => {
    const r = await partidosSinPuntuar("PRIMERA", [partido({ homeLeaguePts: 1, awayLeaguePts: 5 })]);
    expect(r).toEqual([]);
  });

  it("descarta el que no terminó, el aplazado y el cancelado", async () => {
    const r = await partidosSinPuntuar("PRIMERA", [
      partido({ finished: false }),
      partido({ postponed: true }),
      partido({ canceled: true }),
    ]);
    expect(r).toEqual([]);
  });

  it("descarta el 0-0, que en este torneo significa que no se jugó", async () => {
    const r = await partidosSinPuntuar("PRIMERA", [partido({ homeScore: 0, awayScore: 0 })]);
    expect(r).toEqual([]);
  });

  it("no mezcla divisiones", async () => {
    const r = await partidosSinPuntuar("INTERMEDIA", [partido({})]);
    expect(r).toEqual([]);
  });
});
