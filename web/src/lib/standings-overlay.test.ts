import { describe, it, expect } from "vitest";
import { applyLiveOverlay } from "./standings-overlay";
import type { StandingRow } from "./tournament";
import type { LiveMatch } from "./socket";

const fila = (team: string, pts: number, pj = 17): StandingRow =>
  ({ pos: 0, team, pj, pg: 0, pe: 0, pp: 0, pf: 0, pc: 0, diff: 0, pts });

// Old Macks le gana a Old Reds 24-20 con 4 tries: 4 (victoria) + 1 (bonus
// ofensivo) = 5 para Old Macks, y 1 (bonus defensivo, pierde por ≤7) para Old Reds.
const partido = (status: LiveMatch["status"]): LiveMatch => ({
  id: "1", homeTeam: "Old Reds", awayTeam: "Old Macks", division: "PRIMERA", venue: "",
  homeScore: 20, awayScore: 24, homeTries: 2, awayTries: 4, minute: 80, status, events: [],
});

const base = [fila("Old Reds", 51), fila("Old Macks", 47)];

describe("tabla en vivo", () => {
  it("cuenta el partido mientras se juega", () => {
    const r = applyLiveOverlay(base, [partido("LIVE")]);
    expect(r.find((x) => x.team === "Old Macks")!.pts).toBe(52);
    expect(r.find((x) => x.team === "Old Reds")!.pts).toBe(52);
    expect(r.find((x) => x.team === "Old Macks")!.pj).toBe(18);
  });

  it("al terminar lo suelta, porque la tabla oficial ya debería contarlo", () => {
    const r = applyLiveOverlay(base, [partido("FINISHED")]);
    expect(r.find((x) => x.team === "Old Macks")!.pts).toBe(47);
    expect(r.find((x) => x.team === "Old Macks")!.pj).toBe(17);
  });

  it("pero lo mantiene si Leverade todavía no lo puntuó", () => {
    // Es el hueco entre el pitazo final y la publicación de los puntos de liga:
    // sin esto la tabla se queda atrás justo cuando todos la miran.
    const r = applyLiveOverlay(base, [partido("FINISHED")], [], [
      { homeTeam: "Old Reds", awayTeam: "Old Macks" },
    ]);
    expect(r.find((x) => x.team === "Old Macks")!.pts).toBe(52);
    expect(r.find((x) => x.team === "Old Reds")!.pts).toBe(52);
    expect(r.find((x) => x.team === "Old Macks")!.pj).toBe(18);
  });

  it("no cuenta dos veces un partido de otro cruce", () => {
    const r = applyLiveOverlay(base, [partido("FINISHED")], [], [
      { homeTeam: "PWCC", awayTeam: "Old Boys" },
    ]);
    expect(r.find((x) => x.team === "Old Macks")!.pts).toBe(47);
  });
});
