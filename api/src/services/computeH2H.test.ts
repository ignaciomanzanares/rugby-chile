import { describe, it, expect } from "vitest";
import { canonTeam, nameDivision } from "./computeH2H";

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
