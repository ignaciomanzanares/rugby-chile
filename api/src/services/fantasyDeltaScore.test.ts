import { describe, it, expect } from "vitest";
import { desglose, type StatLine } from "./fantasyDeltaScore";

const cero: StatLine = {
  matches: 0, tries: 0, penaltyTries: 0, conversions: 0, penalties: 0,
  drops: 0, mvp: 0, yellowCards: 0, redCards: 0,
};

describe("desglose de puntos de una fecha", () => {
  it("explica cada punto: jugó, 60', tries y conversiones", () => {
    const d = { ...cero, matches: 1, tries: 2, conversions: 1 };
    // 2 (jugó) + 1 (60') + 20 (tries) + 2 (conversión) = 25
    expect(desglose(d, 1, 25)).toEqual([
      { label: "Jugó", pts: 2 },
      { label: "60' o más", pts: 1 },
      { label: "2 tries", pts: 20 },
      { label: "1 conversión", pts: 2 },
    ]);
  });

  it("las tarjetas restan", () => {
    const d = { ...cero, matches: 1, yellowCards: 1 };
    expect(desglose(d, 0, 1)).toEqual([
      { label: "Jugó", pts: 2 },
      { label: "1 amarilla", pts: -1 },
    ]);
  });

  it("si el acumulado no cuadra, agrega un ajuste para que la suma dé siempre el total", () => {
    const d = { ...cero, matches: 1, penalties: 1 };
    const lineas = desglose(d, 1, 4); // 2 + 1 + 3 = 6, pero arusa corrigió y el delta real es 4
    expect(lineas.at(-1)).toEqual({ label: "Ajuste de estadísticas", pts: -2 });
    expect(lineas.reduce((a, l) => a + l.pts, 0)).toBe(4);
  });

  it("el try penal cuenta como try", () => {
    const d = { ...cero, matches: 1, penaltyTries: 1 };
    expect(desglose(d, 0, 12)).toContainEqual({ label: "1 try", pts: 10 });
  });
});
