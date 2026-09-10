import { describe, it, expect } from "vitest";
import { splitDelta } from "../lib/scoreDelta";

const tipos = (d: number) => splitDelta(d).map((u) => u.type);

describe("splitDelta — deduce las jugadas a partir de un salto de marcador", () => {
  it("resuelve las jugadas simples", () => {
    expect(tipos(5)).toEqual(["TRY"]);
    expect(tipos(3)).toEqual(["PENALTY"]);
    expect(tipos(2)).toEqual(["CONVERSION"]);
    // Un try convertido se separa en las dos jugadas, como en una cronología real.
    expect(tipos(7)).toEqual(["TRY", "CONVERSION"]);
  });

  it("no se queda colgado cuando el mayor no cabe (el bug del greedy)", () => {
    // +8 son try + penal. Greedy tomaba 7 y quedaba con 1 suelto → nada.
    expect(tipos(8)).toEqual(["TRY", "PENALTY"]);
    expect(tipos(6)).toEqual(["PENALTY", "PENALTY"]);
    expect(tipos(4)).toEqual(["CONVERSION", "CONVERSION"]);
  });

  it("no inventa conversiones sin su try", () => {
    // +9 NO puede ser "try + dos conversiones": sobra una conversión sin try.
    // Son tres penales.
    expect(tipos(9)).toEqual(["PENALTY", "PENALTY", "PENALTY"]);
  });

  it("prefiere la combinación de menos jugadas", () => {
    expect(tipos(12)).toEqual(["TRY", "TRY", "CONVERSION"]);
    expect(tipos(14)).toEqual(["TRY", "TRY", "CONVERSION", "CONVERSION"]);
  });

  it("devuelve vacío antes que inventar cuando el salto no cuadra", () => {
    expect(splitDelta(1)).toEqual([]);
    expect(splitDelta(0)).toEqual([]);
    expect(splitDelta(-5)).toEqual([]);
  });

  it("los puntos de las jugadas siempre suman el salto", () => {
    for (let d = 2; d <= 30; d++) {
      const partes = splitDelta(d);
      if (partes.length === 0) continue;
      expect(partes.reduce((a, u) => a + u.pts, 0)).toBe(d);
    }
  });
});
