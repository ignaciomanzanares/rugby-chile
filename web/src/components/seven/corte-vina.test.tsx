/**
 * La línea de corte a Viña.
 *
 * El caso que importa es el EMPATE: hoy Old Boys y Old Reds comparten el 1º, así
 * que la tabla va 1, 1, 3 — si la zona se dibujara contando filas en vez de
 * mirar el puesto, dejaría a PWCC afuera estando tercero.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SevenView } from "@/components/seven/seven-view";
import { HomeSevenSection } from "@/components/seven/home-seven-section";
import { CUPOS_VINA, type SevenCircuito, type SevenOficial } from "@/lib/seven-api";

/** La tabla real de hoy: empate en la punta. */
const OFICIAL: SevenOficial[] = [
  { pos: 1, team: "Old Boys", pts: 37, porJornada: [] },
  { pos: 1, team: "Old Reds", pts: 37, porJornada: [] },
  { pos: 3, team: "PWCC", pts: 36, porJornada: [] },
  { pos: 4, team: "DOBS", pts: 31, porJornada: [] },
  { pos: 5, team: "Old Georgians", pts: 25, porJornada: [] },
  { pos: 6, team: "COBS", pts: 24, porJornada: [] },
];

const circuito = (oficial: SevenOficial[]): SevenCircuito => ({
  tournamentId: "1344636", nombre: "Circuito de SEVEN", equipos: [],
  tabla: [{ pos: 1, team: "Old Boys", pj: 4, pg: 4, pe: 0, pp: 0, pf: 100, pc: 40, diff: 60, pts: 16 }],
  oficial, etapas: [], jugadores: [], eventos: [], sinPuntos: [], proxima: null,
  generadoEn: new Date().toISOString(),
});

/** Los equipos cuya fila quedó dentro de la zona verde. */
function enLaZona(html: string): string[] {
  return [...html.matchAll(/border-l-emerald-500[\s\S]{0,700}?<\/li>/g)]
    .map((m) => {
      const t = m[0].replace(/<[^>]*>/g, "|");
      return (OFICIAL.map((f) => f.team).find((n) => t.includes(n)) ?? "?");
    });
}

describe("el corte a Viña", () => {
  it("son tres cupos", () => {
    expect(CUPOS_VINA).toBe(3);
  });

  it("/seven marca a los tres primeros, y el empate en el 1º no corre a PWCC", () => {
    const html = renderToStaticMarkup(<SevenView initial={circuito(OFICIAL)} />);
    expect(enLaZona(html)).toEqual(["Old Boys", "Old Reds", "PWCC"]);
    expect(html).toContain("clasifican directo al Seven de Viña del Mar");
  });

  it("el panel marca lo mismo", () => {
    const html = renderToStaticMarkup(<HomeSevenSection initial={circuito(OFICIAL)} />);
    expect(enLaZona(html)).toEqual(["Old Boys", "Old Reds", "PWCC"]);
  });

  it("con empate EN EL CORTE entran los dos: están empatados por el último cupo", () => {
    const empatados: SevenOficial[] = [
      { pos: 1, team: "Old Boys", pts: 40, porJornada: [] },
      { pos: 2, team: "Old Reds", pts: 38, porJornada: [] },
      { pos: 3, team: "PWCC", pts: 36, porJornada: [] },
      { pos: 3, team: "DOBS", pts: 36, porJornada: [] },
      { pos: 5, team: "COBS", pts: 24, porJornada: [] },
    ];
    const html = renderToStaticMarkup(<SevenView initial={circuito(empatados)} />);
    expect(enLaZona(html)).toEqual(["Old Boys", "Old Reds", "PWCC", "DOBS"]);
  });

  it("sin tabla oficial no se inventa ninguna zona", () => {
    const html = renderToStaticMarkup(<SevenView initial={circuito([])} />);
    expect(enLaZona(html)).toEqual([]);
    expect(html).not.toContain("Seven de Viña");
  });
});
