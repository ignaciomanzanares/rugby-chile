import { describe, it, expect } from "vitest";
import {
  construirTabla, copaDe, clasificacionDeEtapa, esAcumulada, tablaOficial, ttlPara,
  derivarEventos, fotoUsable, fusionarFotos,
} from "./seven";

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

describe("clasificacionDeEtapa — el puesto 1 a 12 de una etapa", () => {
  const copa = (nombre: string, campeon: string, finalista: string, semis: [string, number, string, number][]) => ({
    nombre, campeon, finalista, campeonScore: 0, finalistaScore: 0,
    partidos: semis.map(([h, hs, a, as_], i) => ({
      id: `${nombre}-semi-${i}`, fecha: "2026-10-24", hora: "14:00",
      grupo: `Semifinales ${nombre}`, ronda: "Semifinal",
      home: h, away: a, homeScore: hs, awayScore: as_, homePts: 0, awayPts: 0, finished: true,
    })),
  });

  // La etapa 1 real: Old Boys 28-26 PWCC en la final de Oro, y las dos semis.
  const copas = [
    copa("Oro", "Old Boys", "PWCC", [["Old Boys", 27, "Old Reds", 21], ["COBS", 14, "PWCC", 19]]),
    copa("Plata", "Old Georgians", "DOBS", [["Old Georgians", 19, "Old Macks", 12], ["DOBS", 21, "Stade Francais", 19]]),
    copa("Bronce", "Gauchos RC", "UC", [["UC", 21, "Old Newlanders", 12], ["CDA", 21, "Gauchos RC", 24]]),
  ];

  it("reparte los puestos por copa: Oro 1-4, Plata 5-8, Bronce 9-12", () => {
    const c = clasificacionDeEtapa(copas);
    expect(c).toHaveLength(12);
    expect(c.slice(0, 2).map((p) => p.team)).toEqual(["Old Boys", "PWCC"]);
    expect(c[4].team).toBe("Old Georgians");
    expect(c[8].team).toBe("Gauchos RC");
  });

  it("desempata a los semifinalistas por MARGEN, no por diferencia general", () => {
    // COBS y Old Reds terminaron los dos en +31 ese día: la diferencia no los
    // separa. COBS va 3º por perder la semi por 5, Old Reds 4º por perder por 6.
    const c = clasificacionDeEtapa(copas);
    expect(c[2]).toMatchObject({ pos: 3, team: "COBS", margen: 5 });
    expect(c[3]).toMatchObject({ pos: 4, team: "Old Reds", margen: 6 });
  });

  it("CONTROL NEGATIVO: una copa sin jugar no inventa puestos", () => {
    const vacia = [{ nombre: "Oro", campeon: null, finalista: null, campeonScore: null, finalistaScore: null, partidos: [] }];
    expect(clasificacionDeEtapa(vacia)).toEqual([]);
  });
});

/** Un partido del grupo donde ARUSA guarda su tabla: 0-0 y los puntos en score. */
const acum = (home: string, homePts: number, away: string, awayPts: number, ronda = "Fecha 1 - SF") => ({
  id: `acum-${home}-${away}`, fecha: "2026-10-24", hora: "12:00",
  grupo: "Tabla acumulada Circuito de Seven", ronda,
  home, away, homeScore: 0, awayScore: 0, homePts, awayPts, finished: true,
});

describe("esAcumulada — el grupo que NO es un grupo", () => {
  it("reconoce el grupo de la tabla oficial", () => {
    expect(esAcumulada("Tabla acumulada Circuito de Seven")).toBe(true);
  });

  it("CONTROL NEGATIVO: los grupos de verdad no lo son", () => {
    expect(esAcumulada("Grupo A")).toBe(false);
    expect(esAcumulada("Semifinales Oro")).toBe(false);
    expect(esAcumulada("PlayOFF Bronce")).toBe(false);
    expect(esAcumulada("")).toBe(false);
  });
});

describe("construirTabla — el grupo acumulado no es un resultado", () => {
  it("los 0-0 de la tabla oficial NO suman jugados, empates ni puntos", () => {
    // Esto es exactamente lo que estaba roto en producción: Old Boys aparecía
    // con 5 jugados, 1 empate y 37 puntos (15 nuestros + 22 oficiales).
    const tabla = construirTabla([
      p("Old Boys", 19, 3, "Old Georgians", 14, 2),
      acum("Old Boys", 22, "PWCC", 19),
    ]);
    const ob = tabla.find((f) => f.team === "Old Boys")!;
    expect(ob.pj).toBe(1);
    expect(ob.pe).toBe(0);
    expect(ob.pts).toBe(3);
    // PWCC sólo aparecía por el partido ficticio: no debe estar en la tabla.
    expect(tabla.find((f) => f.team === "PWCC")).toBeUndefined();
  });
});

describe("tablaOficial — la tabla que publica ARUSA", () => {
  it("lee los puntos del score y ordena de mayor a menor", () => {
    // Los seis partidos reales del 24-oct, tal como los carga ARUSA.
    const oficial = tablaOficial([
      acum("Old Boys", 22, "PWCC", 19),
      acum("CDA", 3, "Old Newlanders", 1),
      acum("Gauchos RC", 7, "UC", 5),
      acum("Stade Francais", 10, "Old Macks", 8),
      acum("Old Georgians", 13, "DOBS", 12),
      acum("COBS", 17, "Old Reds", 15),
    ]);
    expect(oficial.map((f) => f.team)).toEqual([
      "Old Boys", "PWCC", "COBS", "Old Reds", "Old Georgians", "DOBS",
      "Stade Francais", "Old Macks", "Gauchos RC", "UC", "CDA", "Old Newlanders",
    ]);
    // El puesto que nos corrigió Ignacio: OR 4º, COBS 3º.
    expect(oficial.find((f) => f.team === "Old Reds")!.pos).toBe(4);
    expect(oficial.find((f) => f.team === "COBS")!.pos).toBe(3);
  });

  it("acumula entre jornadas y guarda el desglose", () => {
    const oficial = tablaOficial([
      acum("Old Reds", 15, "COBS", 17, "Fecha 1 - SF"),
      acum("Old Reds", 22, "COBS", 10, "Jornada 2"),
    ]);
    const or = oficial.find((f) => f.team === "Old Reds")!;
    expect(or.pts).toBe(37);
    expect(or.porJornada.map((j) => j.pts)).toEqual([15, 22]);
    expect(or.pos).toBe(1);
  });

  it("CONTROL NEGATIVO: las jornadas que ARUSA no cargó no inventan filas", () => {
    const vacio = {
      id: "acum-vacio", fecha: null, hora: null,
      grupo: "Tabla acumulada Circuito de Seven", ronda: "Jornada 3",
      home: null, away: null, homeScore: null, awayScore: null,
      homePts: null, awayPts: null, finished: false,
    };
    expect(tablaOficial([vacio])).toEqual([]);
  });

  it("CONTROL NEGATIVO: los partidos de verdad no entran a la tabla oficial", () => {
    expect(tablaOficial([p("Old Boys", 19, 3, "Old Georgians", 14, 2)])).toEqual([]);
  });
});

describe("ttlPara — el caché aprieta el día del torneo", () => {
  const etapa = (fecha: string, jugada: boolean) => ({
    numero: 1, fecha, grupos: [], copas: [], clasificacion: [], jugada,
  });
  const circuito = (etapas: ReturnType<typeof etapa>[]) => ({
    tournamentId: "1344636", nombre: "Circuito", equipos: [], tabla: [],
    oficial: [], etapas, jugadores: [], sinPuntos: [], generadoEn: "",
  });

  it("dos minutos si hoy hay etapa y le quedan partidos", () => {
    expect(ttlPara(circuito([etapa("2026-11-07", false)]), "2026-11-07")).toBe(2 * 60_000);
  });

  it("media hora una vez que la etapa de hoy terminó", () => {
    expect(ttlPara(circuito([etapa("2026-11-07", true)]), "2026-11-07")).toBe(30 * 60_000);
  });

  it("media hora los días sin torneo, aunque queden etapas por jugar", () => {
    expect(ttlPara(circuito([etapa("2026-11-07", false)]), "2026-11-05")).toBe(30 * 60_000);
  });

  it("media hora sin nada guardado", () => {
    expect(ttlPara(null, "2026-11-07")).toBe(30 * 60_000);
  });
});

describe("derivarEventos — los nombres sin pasar por el muro", () => {
  const j = (nombre: string, equipo: string, tries = 0, puntos = 0, amarillas = 0, rojas = 0,
             extra: Partial<{ conversiones: number; penales: number; drops: number; penaltyTries: number }> = {}) =>
    ({ nombre, equipo, tries, puntos, amarillas, rojas,
       conversiones: 0, penales: 0, drops: 0, penaltyTries: 0, ...extra });
  const A = "2026-11-07T13:00:00.000Z", B = "2026-11-07T13:02:00.000Z";

  it("un try que aparece entre dos fotos es un try en esa ventana", () => {
    const ev = derivarEventos(
      [j("Santiago Prat", "Old Reds", 2, 10)],
      [j("Santiago Prat", "Old Reds", 3, 15)],
      A, B,
    );
    expect(ev).toEqual([
      { jugador: "Santiago Prat", equipo: "Old Reds", tipo: "try", cantidad: 1, desde: A, hasta: B },
    ]);
  });

  it("nombra la CONVERSIÓN, no la deja como puntos sueltos", () => {
    // El cuadro de ARUSA sí separa conversiones (C), penales (P) y drops (D):
    // trae las mismas trece columnas que el del XV. Antes esto salía como
    // "pateó 2 puntos" porque leíamos cuatro.
    const ev = derivarEventos(
      [j("Pateador", "PWCC", 0, 0)],
      [j("Pateador", "PWCC", 1, 7, 0, 0, { conversiones: 1 })],
      A, B,
    );
    expect(ev).toEqual([
      { jugador: "Pateador", equipo: "PWCC", tipo: "try", cantidad: 1, desde: A, hasta: B },
      { jugador: "Pateador", equipo: "PWCC", tipo: "conversión", cantidad: 1, desde: A, hasta: B },
    ]);
  });

  it("nombra el penal y el drop", () => {
    const ev = derivarEventos(
      [j("Pateador", "UC", 0, 0)],
      [j("Pateador", "UC", 0, 6, 0, 0, { penales: 1, drops: 1 })],
      A, B,
    );
    expect(ev.map((e) => e.tipo)).toEqual(["penal", "drop"]);
  });

  it("el try penal se distingue del try", () => {
    const ev = derivarEventos(
      [j("X", "COBS", 0, 0)],
      [j("X", "COBS", 0, 5, 0, 0, { penaltyTries: 1 })],
      A, B,
    );
    expect(ev.map((e) => e.tipo)).toEqual(["try penal"]);
  });

  it("si ARUSA sube TP sin desglosar, los puntos no se PIERDEN", () => {
    // Red de seguridad: lo que los contadores no explican sale como "puntos",
    // que es lo que hacía siempre antes de leer las columnas nuevas.
    const ev = derivarEventos([j("Y", "UC", 0, 0)], [j("Y", "UC", 0, 2)], A, B);
    expect(ev).toEqual([
      { jugador: "Y", equipo: "UC", tipo: "puntos", cantidad: 2, desde: A, hasta: B },
    ]);
  });

  it("CONTROL NEGATIVO: un try con su conversión no deja puntos residuales", () => {
    const ev = derivarEventos(
      [j("Z", "DOBS", 0, 0)],
      [j("Z", "DOBS", 1, 7, 0, 0, { conversiones: 1 })],
      A, B,
    );
    expect(ev.some((e) => e.tipo === "puntos")).toBe(false);
  });

  it("las tarjetas también", () => {
    const ev = derivarEventos(
      [j("Duro", "DOBS", 0, 0, 0, 0)],
      [j("Duro", "DOBS", 0, 0, 1, 0)],
      A, B,
    );
    expect(ev.map((e) => e.tipo)).toEqual(["amarilla"]);
  });

  it("distingue dos jugadores con el mismo nombre en clubes distintos", () => {
    const ev = derivarEventos(
      [j("Juan Perez", "COBS", 1, 5), j("Juan Perez", "CDA", 1, 5)],
      [j("Juan Perez", "COBS", 1, 5), j("Juan Perez", "CDA", 2, 10)],
      A, B,
    );
    expect(ev).toHaveLength(1);
    expect(ev[0].equipo).toBe("CDA");
  });

  it("CONTROL NEGATIVO: sin cambios no hay eventos", () => {
    const foto = [j("Santiago Prat", "Old Reds", 3, 15), j("Otro", "COBS", 1, 5)];
    expect(derivarEventos(foto, foto, A, B)).toEqual([]);
  });

  it("CONTROL NEGATIVO: un contador que BAJA no inventa un evento negativo", () => {
    // Una planilla corregida hacia abajo. Antes esto habría publicado "-1 try".
    const ev = derivarEventos(
      [j("Santiago Prat", "Old Reds", 3, 15)],
      [j("Santiago Prat", "Old Reds", 2, 10)],
      A, B,
    );
    expect(ev).toEqual([]);
  });

  it("CONTROL NEGATIVO: un jugador que desaparece de la foto no genera nada", () => {
    expect(derivarEventos([j("Fantasma", "UC", 2, 10)], [], A, B)).toEqual([]);
  });

  it("un jugador nuevo con tries ya hechos entra con lo que trae", () => {
    const ev = derivarEventos([j("Viejo", "UC", 1, 5)], [j("Viejo", "UC", 1, 5), j("Nuevo", "CDA", 2, 10)], A, B);
    expect(ev).toEqual([
      { jugador: "Nuevo", equipo: "CDA", tipo: "try", cantidad: 2, desde: A, hasta: B },
    ]);
  });
});

describe("fotoUsable — no borrar la referencia con una foto vacía", () => {
  const j = { nombre: "X", equipo: "Y", tries: 1, puntos: 5, amarillas: 0, rojas: 0,
              conversiones: 0, penales: 0, drops: 0, penaltyTries: 0 };

  it("una foto con datos siempre sirve", () => {
    expect(fotoUsable([j], [])).toBe(true);
    expect(fotoUsable([j], [j])).toBe(true);
  });

  it("CONTROL NEGATIVO: una foto vacía NO reemplaza una con datos", () => {
    // Es el caso real: statsDeGrupo devuelve [] ante cualquier falla. Guardar
    // ese [] haría que la lectura siguiente publicara un evento por jugador.
    expect(fotoUsable([], [j])).toBe(false);
  });

  it("vacía sobre vacía sirve: es el arranque del circuito", () => {
    expect(fotoUsable([], [])).toBe(true);
  });
});

describe("fusionarFotos — la referencia no pierde jugadores", () => {
  const j = (nombre: string, equipo: string, tries = 0, puntos = 0, amarillas = 0, rojas = 0,
             extra: Partial<{ conversiones: number; penales: number; drops: number; penaltyTries: number }> = {}) =>
    ({ nombre, equipo, tries, puntos, amarillas, rojas,
       conversiones: 0, penales: 0, drops: 0, penaltyTries: 0, ...extra });

  it("conserva a los jugadores que la foto nueva no trae", () => {
    // El caso real: el cuadro se pide por grupo y uno falló, así que la foto
    // viene incompleta en vez de vacía.
    const r = fusionarFotos([j("A", "Old Reds", 3, 15), j("B", "COBS", 2, 10)], [j("A", "Old Reds", 3, 15)]);
    expect(r).toHaveLength(2);
    expect(r.find((x) => x.nombre === "B")!.tries).toBe(2);
  });

  it("se queda con el valor más alto de cada contador", () => {
    const r = fusionarFotos([j("A", "UC", 2, 10, 1, 0)], [j("A", "UC", 3, 17, 1, 0)]);
    expect(r).toEqual([j("A", "UC", 3, 17, 1, 0)]);
  });

  it("una planilla corregida hacia abajo no baja la referencia", () => {
    // Coherente con derivarEventos, que tampoco emite eventos negativos.
    const r = fusionarFotos([j("A", "UC", 3, 15)], [j("A", "UC", 2, 10)]);
    expect(r).toEqual([j("A", "UC", 3, 15)]);
  });

  it("suma a los jugadores nuevos", () => {
    const r = fusionarFotos([j("A", "UC", 1, 5)], [j("A", "UC", 1, 5), j("Nuevo", "CDA", 2, 10)]);
    expect(r.map((x) => x.nombre).sort()).toEqual(["A", "Nuevo"]);
  });

  it("distingue el mismo nombre en clubes distintos", () => {
    const r = fusionarFotos([j("Juan", "COBS", 1, 5)], [j("Juan", "CDA", 2, 10)]);
    expect(r).toHaveLength(2);
  });

  it("CONTROL NEGATIVO: una foto vacía no borra nada", () => {
    const previa = [j("A", "UC", 3, 15), j("B", "COBS", 1, 5)];
    expect(fusionarFotos(previa, [])).toEqual(previa);
  });
});
