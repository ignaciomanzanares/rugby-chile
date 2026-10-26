import { describe, it, expect } from "vitest";
import { construirTabla, copaDe } from "./seven";

const p = (
  home: string, homeScore: number, homePts: number,
  away: string, awayScore: number, awayPts: number,
) => ({
  id: `${home}-${away}`, fecha: "2026-10-24", hora: "09:00",
  grupo: "Grupo A", ronda: "Jornada 1",
  home, away, homeScore, awayScore, homePts, awayPts, finished: true,
});

describe("copaDe — qué copa es un grupo", () => {
  it("reconoce las tres copas, se llamen como se llamen", () => {
    expect(copaDe("Semifinales Oro")).toBe("Oro");
    expect(copaDe("PlayOFF Plata")).toBe("Plata");
    expect(copaDe("Semifinales Bronce")).toBe("Bronce");
  });

  it("un grupo de la fase de grupos NO es una copa", () => {
    expect(copaDe("Grupo A")).toBeNull();
    expect(copaDe("Tabla acumulada Circuito de Seven")).toBeNull();
    expect(copaDe("")).toBeNull();
  });
});

describe("construirTabla — acumulada del circuito", () => {
  it("suma los puntos de liga que da Leverade, no los inventa", () => {
    // Reales del 24-oct: la victoria son 3 + bonus ofensivo, la derrota 1 + bonus
    // por perder dentro de 7. Si la tabla asumiera 4/1 fijo, esto fallaría.
    const tabla = construirTabla([
      p("Old Boys", 19, 3, "Old Georgians", 14, 2),   // gana justo: 3 y 2
      p("COBS", 29, 4, "CDA", 7, 1),                   // gana con bonus: 4 y 1
    ]);
    expect(tabla.find((f) => f.team === "Old Boys")!.pts).toBe(3);
    expect(tabla.find((f) => f.team === "Old Georgians")!.pts).toBe(2);
    expect(tabla.find((f) => f.team === "COBS")!.pts).toBe(4);
  });

  it("ordena por puntos y desempata por diferencia", () => {
    const tabla = construirTabla([
      p("A", 30, 4, "B", 0, 1),
      p("C", 10, 4, "D", 5, 1),
    ]);
    expect(tabla.map((f) => f.team)).toEqual(["A", "C", "D", "B"]);
    expect(tabla[0].diff).toBe(30);
  });

  it("cuenta ganados, perdidos y empatados por separado", () => {
    const tabla = construirTabla([
      p("A", 10, 3, "B", 10, 3),
      p("A", 20, 4, "C", 5, 1),
    ]);
    const a = tabla.find((f) => f.team === "A")!;
    expect([a.pj, a.pg, a.pe, a.pp]).toEqual([2, 1, 1, 0]);
  });

  it("CONTROL NEGATIVO: un partido sin marcador no entra ni suma", () => {
    // Las etapas 2 y 3 existen en Leverade como partidos vacíos. Si entraran,
    // la tabla mostraría doce equipos con PJ inflados antes de jugarse.
    const vacio = { ...p("A", 0, 0, "B", 0, 0), homeScore: null, awayScore: null, home: null, away: null };
    expect(construirTabla([vacio])).toEqual([]);
  });

  it("un 0-0 de puntos NO se corrige a mano: la tabla refleja lo que publica ARUSA", () => {
    // El 24-oct UC 12-26 Old Georgians quedó con 0 puntos para los dos lados.
    // La tabla lo suma como 0, y el circuito lo informa aparte; inventarle un
    // 4/1 sería maquillar el dato de la fuente.
    const tabla = construirTabla([p("UC", 12, 0, "Old Georgians", 26, 0)]);
    expect(tabla.find((f) => f.team === "Old Georgians")!.pts).toBe(0);
    expect(tabla.find((f) => f.team === "Old Georgians")!.pg).toBe(1);
  });
});
