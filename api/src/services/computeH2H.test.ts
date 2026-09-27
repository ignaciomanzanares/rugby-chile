import { describe, it, expect } from "vitest";
import { canonTeam, nameDivision, parseFullTimeScore } from "./computeH2H";

describe("canonTeam — maps historical club name variants to canonical names", () => {
  it("recognises the same club across name changes / suffixes", () => {
    expect(canonTeam("Craighouse Old Boys School")).toBe("COBS");
    expect(canonTeam("COBS A")).toBe("COBS");
    expect(canonTeam("Old Reds RC")).toBe("Old Reds");
    expect(canonTeam("Universidad Católica")).toBe("UC");
    expect(canonTeam("Prince of Wales Country Club")).toBe("PWCC");
    expect(canonTeam("Dunalastair")).toBe("DOBS");
  });

  it("returns null for unknown or empty input", () => {
    expect(canonTeam("Some Random Club")).toBeNull();
    expect(canonTeam("")).toBeNull();
    expect(canonTeam(undefined)).toBeNull();
  });
});

describe("nameDivision — classifies a tournament/group name into a grade", () => {
  it("detects each grade", () => {
    expect(nameDivision("Primera Nacional (TOP 10) - Titulares")).toBe("PRIMERA");
    expect(nameDivision("TOP 8 - Titulares")).toBe("PRIMERA");
    expect(nameDivision("TOP8 - Apertura - Intermedia")).toBe("INTERMEDIA");
    expect(nameDivision("Pre Intermedia")).toBe("PRE_INTERMEDIA");
  });

  it("returns null when the name carries no grade marker (falls back to the tournament base)", () => {
    expect(nameDivision("Fase Regular")).toBeNull();
    expect(nameDivision("PlayOff")).toBeNull();
  });

  it("prioritises 'pre' over 'intermedia'", () => {
    expect(nameDivision("Pre-Intermedia")).toBe("PRE_INTERMEDIA");
  });
});

describe("parseFullTimeScore — marcador de tiempo completo desde Leverade", () => {
  // Payload real del Old Reds 38-21 Old Boys (match 144047901), recortado.
  const OR = "15747913", OB = "15747906";
  const finales = [
    { type: "result", attributes: { value: 38, score: 5 }, relationships: { team: { data: { id: OR } }, period: { data: null } } },
    { type: "result", attributes: { value: 21, score: 0 }, relationships: { team: { data: { id: OB } }, period: { data: null } } },
  ];

  it("lee el marcador con el local y la visita en el orden pedido", () => {
    expect(parseFullTimeScore(finales, OR, OB)).toEqual([38, 21]);
    expect(parseFullTimeScore(finales, OB, OR)).toEqual([21, 38]);
  });

  it("IGNORA los parciales por período — si los contara, el primer tiempo pisaría el final", () => {
    const conPeriodos = [
      { type: "result", attributes: { value: 12 }, relationships: { team: { data: { id: OR } }, period: { data: { id: "1" } } } },
      { type: "result", attributes: { value: 7 }, relationships: { team: { data: { id: OB } }, period: { data: { id: "1" } } } },
      ...finales,
      { type: "result", attributes: { value: 26 }, relationships: { team: { data: { id: OR } }, period: { data: { id: "2" } } } },
      { type: "result", attributes: { value: 14 }, relationships: { team: { data: { id: OB } }, period: { data: { id: "2" } } } },
    ];
    expect(parseFullTimeScore(conPeriodos, OR, OB)).toEqual([38, 21]);
  });

  it("devuelve null si falta un lado, en vez de inventar un 0", () => {
    expect(parseFullTimeScore([finales[0]], OR, OB)).toBeNull();
    expect(parseFullTimeScore([], OR, OB)).toBeNull();
    // Sin planilla cargada Leverade manda value null: no es un 0-0.
    const sinCargar = [
      { type: "result", attributes: { value: null }, relationships: { team: { data: { id: OR } }, period: { data: null } } },
      { type: "result", attributes: { value: null }, relationships: { team: { data: { id: OB } }, period: { data: null } } },
    ];
    expect(parseFullTimeScore(sinCargar, OR, OB)).toBeNull();
  });
});
