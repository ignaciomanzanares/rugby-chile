/**
 * La tabla del circuito cuando ARUSA va atrasado.
 *
 * Los datos de acá son los REALES: los puntos que ARUSA cargó para la etapa del
 * 24-oct y las dos clasificaciones que calculamos nosotros. Así el test no
 * prueba una escala de laboratorio sino la que está en producción.
 */
import { describe, it, expect } from "vitest";
import { completarOficial, PUNTOS_POR_PUESTO, type SevenEtapa, type SevenOficial } from "./seven";

/** Los doce puestos de una etapa, en orden. */
function etapa(numero: number, fecha: string, orden: string[], jugada = true): SevenEtapa {
  return {
    numero,
    fecha,
    jugada,
    grupos: [],
    copas: [],
    clasificacion: orden.map((team, i) => ({
      pos: i + 1,
      team,
      copa: i < 4 ? "Oro" : i < 8 ? "Plata" : "Bronce",
      detalle: "",
      margen: null,
    })),
  } as unknown as SevenEtapa;
}

// 24-oct, tal como lo publicó ARUSA.
const E1 = [
  "Old Boys", "PWCC", "COBS", "Old Reds", "Old Georgians", "DOBS",
  "Stade Francais", "Old Macks", "Gauchos RC", "UC", "CDA", "Old Newlanders",
];
// 7-nov, nuestra clasificación a partir de las tres copas.
const E2 = [
  "Old Reds", "DOBS", "PWCC", "Old Boys", "Stade Francais", "Old Georgians",
  "Gauchos RC", "CDA", "COBS", "Old Macks", "UC", "Old Newlanders",
];

/** La tabla oficial del 24-oct como viene del grupo acumulado de ARUSA. */
const OFICIAL_E1: SevenOficial[] = E1.map((team, i) => ({
  pos: i + 1,
  team,
  pts: PUNTOS_POR_PUESTO[i],
  porJornada: [{ ronda: "Fecha 1 - SF", fecha: "2026-10-24", pts: PUNTOS_POR_PUESTO[i] }],
}));

describe("completarOficial", () => {
  it("la escala REPRODUCE lo que ARUSA publicó para la etapa 1", () => {
    // Sin nada cargado y sólo con nuestra clasificación, tiene que salir
    // exactamente la tabla de ellos. Es la única validación posible de la
    // escala: es la única etapa donde tenemos las dos cosas.
    const r = completarOficial([], [etapa(1, "2026-10-24", E1)]);
    expect(r.map((f) => [f.pos, f.team, f.pts])).toEqual([
      [1, "Old Boys", 22], [2, "PWCC", 19], [3, "COBS", 17], [4, "Old Reds", 15],
      [5, "Old Georgians", 13], [6, "DOBS", 12], [7, "Stade Francais", 10],
      [8, "Old Macks", 8], [9, "Gauchos RC", 7], [10, "UC", 5],
      [11, "CDA", 3], [12, "Old Newlanders", 1],
    ]);
    expect(r.every((f) => f.estimado)).toBe(true);
  });

  it("CONTROL NEGATIVO: si ARUSA ya cargó todo, no toca nada", () => {
    const r = completarOficial(OFICIAL_E1, [etapa(1, "2026-10-24", E1)]);
    expect(r).toBe(OFICIAL_E1);
    expect(r.some((f) => f.estimado)).toBe(false);
  });

  it("suma la etapa 2 sobre la 1 que ARUSA ya tenía", () => {
    const r = completarOficial(OFICIAL_E1, [
      etapa(1, "2026-10-24", E1),
      etapa(2, "2026-11-07", E2),
    ]);
    expect(r.map((f) => [f.pos, f.team, f.pts])).toEqual([
      [1, "Old Boys", 37], [1, "Old Reds", 37], [3, "PWCC", 36], [4, "DOBS", 31],
      [5, "Old Georgians", 25], [6, "COBS", 24], [7, "Stade Francais", 23],
      [8, "Gauchos RC", 17], [9, "Old Macks", 13], [10, "CDA", 11],
      [11, "UC", 8], [12, "Old Newlanders", 2],
    ]);
  });

  it("el empate de Old Reds y Old Boys se MUESTRA empatado, no se inventa un orden", () => {
    const r = completarOficial(OFICIAL_E1, [
      etapa(1, "2026-10-24", E1),
      etapa(2, "2026-11-07", E2),
    ]);
    const arriba = r.filter((f) => f.pts === 37);
    // Los dos con la misma posición, y el siguiente salta al 3.
    expect(arriba.map((f) => f.pos)).toEqual([1, 1]);
    expect(r.find((f) => f.team === "PWCC")!.pos).toBe(3);
  });

  it("marca cuál jornada es de ARUSA y cuál es nuestra", () => {
    const r = completarOficial(OFICIAL_E1, [
      etapa(1, "2026-10-24", E1),
      etapa(2, "2026-11-07", E2),
    ]);
    const or = r.find((f) => f.team === "Old Reds")!;
    expect(or.porJornada).toEqual([
      { ronda: "Fecha 1 - SF", fecha: "2026-10-24", pts: 15 },
      { ronda: "Etapa 2", fecha: "2026-11-07", pts: 22, estimado: true },
    ]);
    expect(or.estimado).toBe(true);
    // Y la etapa 1 de ARUSA sigue sin marca.
    expect(or.porJornada[0].estimado).toBeUndefined();
  });

  it("una etapa que todavía no se jugó no reparte puntos", () => {
    const r = completarOficial(OFICIAL_E1, [
      etapa(1, "2026-10-24", E1),
      etapa(3, "2026-11-21", E2, false),
    ]);
    expect(r).toBe(OFICIAL_E1);
  });

  it("una clasificación incompleta se ignora: repartiría a unos y no a otros", () => {
    const media = etapa(2, "2026-11-07", E2);
    media.clasificacion = media.clasificacion.slice(0, 8);
    const r = completarOficial(OFICIAL_E1, [etapa(1, "2026-10-24", E1), media]);
    expect(r).toBe(OFICIAL_E1);
  });
});
