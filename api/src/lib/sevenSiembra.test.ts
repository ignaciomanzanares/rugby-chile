/**
 * Cómo se siembran los grupos de la etapa que viene.
 *
 * El control fuerte es el primero: la serpiente sobre la clasificación REAL del
 * 24-oct tiene que dar los grupos REALES del 7-nov, los doce casilleros. Si eso
 * calza, la regla no es una suposición.
 */
import { describe, it, expect } from "vitest";
import { sembrarProxima, type SevenEtapa } from "./seven";

function etapa(numero: number, fecha: string, orden: string[], jugada = true): SevenEtapa {
  return {
    numero,
    fecha,
    jugada,
    grupos: [],
    copas: [],
    clasificacion: orden.map((team, i) => ({
      pos: i + 1, team, copa: i < 4 ? "Oro" : i < 8 ? "Plata" : "Bronce", detalle: "", margen: null,
    })),
  } as unknown as SevenEtapa;
}

/** Clasificación del 24-oct, la que publicó ARUSA. */
const E1 = [
  "Old Boys", "PWCC", "COBS", "Old Reds", "Old Georgians", "DOBS",
  "Stade Francais", "Old Macks", "Gauchos RC", "UC", "CDA", "Old Newlanders",
];
/** Clasificación del 7-nov, nuestra, a partir de las tres copas. */
const E2 = [
  "Old Reds", "DOBS", "PWCC", "Old Boys", "Stade Francais", "Old Georgians",
  "Gauchos RC", "CDA", "COBS", "Old Macks", "UC", "Old Newlanders",
];

/** Los grupos del 7-nov tal como los cargó ARUSA en Leverade. */
const GRUPOS_REALES_E2: Record<string, string[]> = {
  "Grupo A": ["Old Boys", "Gauchos RC", "Old Macks"],
  "Grupo B": ["PWCC", "UC", "Stade Francais"],
  "Grupo C": ["COBS", "CDA", "DOBS"],
  "Grupo D": ["Old Reds", "Old Newlanders", "Old Georgians"],
};

const comoMapa = (r: NonNullable<ReturnType<typeof sembrarProxima>>) =>
  Object.fromEntries(r.grupos.map((g) => [g.nombre, [...g.equipos].sort()]));
const ordenado = (m: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v].sort()]));

describe("sembrarProxima", () => {
  it("la serpiente REPRODUCE los grupos que ARUSA armó para el 7-nov", () => {
    const r = sembrarProxima([etapa(1, "2026-10-24", E1)])!;
    expect(r.numero).toBe(2);
    expect(comoMapa(r)).toEqual(ordenado(GRUPOS_REALES_E2));
  });

  it("control negativo: la siembra DIRECTA no da esos grupos", () => {
    // 1-5-9, 2-6-10, 3-7-11, 4-8-12. Si esto también calzara, el test de arriba
    // no probaría nada.
    const directa = {
      "Grupo A": [E1[0], E1[4], E1[8]], "Grupo B": [E1[1], E1[5], E1[9]],
      "Grupo C": [E1[2], E1[6], E1[10]], "Grupo D": [E1[3], E1[7], E1[11]],
    };
    expect(ordenado(directa)).not.toEqual(ordenado(GRUPOS_REALES_E2));
  });

  it("la fecha 3, la que confirmó Ignacio", () => {
    const r = sembrarProxima([etapa(1, "2026-10-24", E1), etapa(2, "2026-11-07", E2)])!;
    expect(r.numero).toBe(3);
    expect(r.fecha).toBe(null);
    expect(r.estimado).toBe(true);
    expect(r.grupos.map((g) => [g.nombre, g.equipos])).toEqual([
      ["Grupo A", ["Old Reds", "CDA", "COBS"]],
      ["Grupo B", ["DOBS", "Gauchos RC", "Old Macks"]],
      ["Grupo C", ["PWCC", "Old Georgians", "UC"]],
      ["Grupo D", ["Old Boys", "Stade Francais", "Old Newlanders"]],
    ]);
  });

  it("si ARUSA ya cargó la etapa que viene, no adivina nada", () => {
    const cargada = etapa(3, "2026-11-21", E2, false);
    expect(sembrarProxima([etapa(1, "2026-10-24", E1), etapa(2, "2026-11-07", E2), cargada])).toBe(null);
  });

  it("no inventa una quinta fecha: el circuito son cuatro", () => {
    const cuatro = [1, 2, 3, 4].map((n) => etapa(n, `2026-1${n}-01`, n % 2 ? E1 : E2));
    expect(sembrarProxima(cuatro)).toBe(null);
  });

  it("sin clasificación completa no siembra", () => {
    expect(sembrarProxima([etapa(1, "2026-10-24", E1.slice(0, 8))])).toBe(null);
  });

  it("sin etapas jugadas tampoco", () => {
    expect(sembrarProxima([])).toBe(null);
  });
});
