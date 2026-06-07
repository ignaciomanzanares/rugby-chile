import { describe, it, expect } from "vitest";
import {
  parseDateStr,
  matchStatus,
  clubLogo,
  nextFechaNumber,
  STANDINGS,
  ROUNDS,
  DIVISIONS,
  type RoundMatch,
} from "./tournament";

describe("parseDateStr", () => {
  it("parses a Spanish fixture date", () => {
    const d = parseDateStr("Sáb 16 May");
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(4); // May is month index 4
    expect(d!.getDate()).toBe(16);
  });

  it("returns null for 'Por definir' and malformed input", () => {
    expect(parseDateStr("Por definir")).toBeNull();
    expect(parseDateStr("hola")).toBeNull();
    expect(parseDateStr("Sáb 16 Xyz")).toBeNull();
  });
});

describe("matchStatus", () => {
  const base: Omit<RoundMatch, "date"> = { home: "A", away: "B", time: "15:00", venue: "X" };

  it("marks a clearly past date as FINISHED", () => {
    expect(matchStatus({ ...base, date: "Lun 16 Mar" })).toBe("FINISHED");
  });

  it("marks a far-future date as UPCOMING", () => {
    expect(matchStatus({ ...base, date: "Dom 20 Dic" })).toBe("UPCOMING");
  });

  it("treats 'Por definir' as UPCOMING", () => {
    expect(matchStatus({ ...base, date: "Por definir" })).toBe("UPCOMING");
  });
});

describe("clubLogo", () => {
  it("maps a known club to its logo path", () => {
    expect(clubLogo("COBS")).toBe("/clubs/cobs.jpg");
    expect(clubLogo("Old Reds")).toBe("/clubs/old-reds.jpg");
  });

  it("returns undefined for an unknown club", () => {
    expect(clubLogo("Equipo Inexistente")).toBeUndefined();
  });
});

describe("nextFechaNumber", () => {
  it("returns a round number within the schedule", () => {
    const n = nextFechaNumber();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(ROUNDS.PRIMERA.length);
  });
});

describe("STANDINGS", () => {
  it("has 10 clubs in sequential positions for every division", () => {
    for (const { key } of DIVISIONS) {
      const rows = STANDINGS[key];
      expect(rows).toHaveLength(10);
      rows.forEach((r, i) => expect(r.pos).toBe(i + 1));
      expect(rows.every((r) => r.pts >= 0 && r.pj >= 0)).toBe(true);
    }
  });
});

describe("ROUNDS — double round-robin fixtures (Primera)", () => {
  const rounds = ROUNDS.PRIMERA;
  const matches = rounds.flatMap((r) => r.matches);

  it("has 18 rounds of 5 matches (90 total)", () => {
    expect(rounds).toHaveLength(18);
    expect(rounds.every((r) => r.matches.length === 5)).toBe(true);
    expect(matches).toHaveLength(90);
  });

  it("every round is a perfect matching of all 10 clubs", () => {
    for (const r of rounds) {
      const teams = r.matches.flatMap((m) => [m.home, m.away]);
      expect(new Set(teams).size).toBe(10);
    }
  });

  it("every pair plays exactly twice — once home, once away", () => {
    const unordered = new Map<string, number>();
    const ordered = new Map<string, number>();
    for (const m of matches) {
      const u = [m.home, m.away].sort().join("|");
      unordered.set(u, (unordered.get(u) ?? 0) + 1);
      const o = `${m.home}>${m.away}`;
      ordered.set(o, (ordered.get(o) ?? 0) + 1);
    }
    expect(unordered.size).toBe(45); // C(10,2)
    expect([...unordered.values()].every((v) => v === 2)).toBe(true);
    expect([...ordered.values()].every((v) => v === 1)).toBe(true);
  });
});
