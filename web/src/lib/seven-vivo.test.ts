/**
 * El "en vivo" del seven, que se deduce de la grilla y no de un feed.
 *
 * Los horarios son los reales de la etapa del 7-nov: el primer partido a las
 * 12:00 de Chile, uno cada veinte minutos.
 */
import { describe, it, expect } from "vitest";
import { estadoDe, enVivoDe, kickoffMs, VENTANA_VIVO_MS } from "./seven-vivo";
import type { SevenPartido, SevenEtapa } from "./seven-api";

const partido = (over: Partial<SevenPartido> = {}): SevenPartido => ({
  id: "1", fecha: "2026-11-07", hora: "12:00", grupo: "Grupo A", ronda: "Jornada 1",
  home: "Old Boys", away: "Gauchos RC", homeScore: null, awayScore: null,
  homePts: null, awayPts: null, finished: false, ...over,
});

/** 7-nov 12:00 en Chile = 15:00 UTC. */
const KICKOFF = Date.parse("2026-11-07T15:00:00.000Z");

describe("kickoffMs", () => {
  it("lee la hora como hora de Chile, no como UTC", () => {
    expect(kickoffMs("2026-11-07", "12:00")).toBe(KICKOFF);
  });
  it("sin día o sin hora no inventa nada", () => {
    expect(kickoffMs(null, "12:00")).toBe(null);
    expect(kickoffMs("2026-11-07", null)).toBe(null);
  });
});

describe("estadoDe", () => {
  it("antes de la hora está programado", () => {
    expect(estadoDe(partido(), KICKOFF - 60_000)).toBe("programado");
  });

  it("desde la hora y dentro de la ventana, EN VIVO", () => {
    expect(estadoDe(partido(), KICKOFF)).toBe("vivo");
    expect(estadoDe(partido(), KICKOFF + VENTANA_VIVO_MS - 1)).toBe("vivo");
  });

  it("pasada la ventana NO se dice que siga en juego", () => {
    // Un partido de seven dura catorce minutos. A los veinticinco sin cerrar,
    // lo que pasa es que el planillero no cerró la planilla.
    expect(estadoDe(partido(), KICKOFF + VENTANA_VIVO_MS)).toBe("demorado");
  });

  it("terminado es final aunque el reloj esté dentro de la ventana", () => {
    expect(estadoDe(partido({ finished: true }), KICKOFF + 60_000)).toBe("final");
  });

  it("sin reloj (antes de montar) nunca afirma que algo está en vivo", () => {
    expect(estadoDe(partido(), null)).toBe("programado");
  });

  it("un partido sin hora no es programado ni vivo", () => {
    expect(estadoDe(partido({ hora: null }), KICKOFF)).toBe("sin-hora");
  });
});

describe("enVivoDe", () => {
  const etapa = (partidos: SevenPartido[]): SevenEtapa => ({
    numero: 2, fecha: "2026-11-07", jugada: false, clasificacion: [],
    grupos: [{ nombre: "Grupo A", grupoId: "1", partidos }],
    copas: [],
  });

  it("devuelve los que están en juego, ordenados por hora", () => {
    const r = enVivoDe(
      etapa([
        partido({ id: "b", hora: "12:20" }),
        partido({ id: "a", hora: "12:00" }),
        partido({ id: "c", hora: "13:00" }),        // todavía no empieza
        partido({ id: "d", hora: "12:00", finished: true }),
      ]),
      KICKOFF + 20 * 60_000,
    );
    expect(r.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("los cruces de copa sin equipos sorteados no cuentan", () => {
    const r = enVivoDe(etapa([partido({ home: null, away: null })]), KICKOFF);
    expect(r).toEqual([]);
  });

  it("sin reloj o sin etapa, nada", () => {
    expect(enVivoDe(etapa([partido()]), null)).toEqual([]);
    expect(enVivoDe(undefined, KICKOFF)).toEqual([]);
  });
});
