/**
 * El enganche de la bitácora, de punta a punta.
 *
 * Los tests de `derivarEventos` prueban la aritmética del delta; esto prueba lo
 * otro: que `fetchSeven` guarde la foto, la vuelva a leer en la pasada
 * siguiente y publique el evento en el payload. Ahí estaba el riesgo que los
 * unitarios no cubren —la llave, el orden de escritura, qué pasa en la primera
 * pasada— y no se puede comprobar contra producción: la prueba exigía retrasar
 * a mano una fila de la foto en la base, que es la base de verdad de la app.
 *
 * Así que acá la red y el caché son de mentira, pero el documento de Leverade
 * es el REAL: `__fixtures__/leverade-seven.json` es la respuesta que devolvió
 * api.leverade.com el 5-nov-2026, con sus 75 partidos y el grupo de la tabla
 * acumulada incluido.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import leveradeDoc from "./__fixtures__/leverade-seven.json";

// Un caché en memoria que se comporta como el de la base.
const almacen = new Map<string, { data: unknown; at: number }>();
vi.mock("./arusaCache", () => ({
  readCache: async (key: string) => almacen.get(key)?.data ?? null,
  readCacheEntry: async (key: string) => {
    const e = almacen.get(key);
    return e ? { data: e.data, ageMs: Date.now() - e.at } : null;
  },
  writeCache: async (key: string, data: unknown) => {
    almacen.set(key, { data, at: Date.now() });
  },
}));
vi.mock("./robots", () => ({ robotsAllows: async () => true }));

/** El cuadro de estadísticas de arusa: HTML dentro de un JSON, como el real. */
function cuadroStats(
  filas: { nombre: string; equipo: string; t: number; tp: number; yc?: number; c?: number }[],
) {
  // Las trece columnas reales y en su orden real, verificado contra una
  // respuesta de arusa: Player Team PM TP C YC RC PT T P D S MVP. Importa que
  // sea el orden real, porque el parser ubica cada valor por el índice de su
  // cabecera y un cuadro de prueba simplificado no probaría el parser.
  const tr = filas
    .map((f, i) =>
      `<tr><td>${i + 1}</td><td>${f.nombre}</td><td>${f.equipo}</td>` +
      `<td>1</td><td>${f.tp}</td><td>${f.c ?? 0}</td><td>${f.yc ?? 0}</td><td>0</td>` +
      `<td>0</td><td>${f.t}</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>`,
    )
    .join("");
  return {
    code: 0,
    content:
      "<table><tr><th>Player</th><th>Team</th><th>PM</th><th>TP</th><th>C</th>" +
      "<th>YC</th><th>RC</th><th>PT</th><th>T</th><th>P</th><th>D</th>" +
      "<th>S</th><th>MVP</th></tr>" + tr + "</table>",
  };
}

/**
 * Deja la red respondiendo: Leverade siempre el fixture, y el cuadro de
 * estadísticas lo que diga `stats` — pero SOLO para el primer grupo, porque el
 * cuadro real se pide una vez por grupo y sumarlo cuatro veces multiplicaría
 * los tries.
 */
function conRed(stats: ReturnType<typeof cuadroStats>) {
  let primerGrupo: string | null = null;
  vi.stubGlobal("fetch", async (url: string) => {
    const u = String(url);
    if (u.includes("api.leverade.com")) {
      return { ok: true, status: 200, json: async () => leveradeDoc } as any;
    }
    const id = new URL(u).searchParams.get("id");
    primerGrupo ??= id;
    return {
      ok: true,
      status: 200,
      json: async () => (id === primerGrupo ? stats : { code: 0, content: "" }),
    } as any;
  });
}

describe("fetchSeven + bitácora — los eventos llegan al payload", () => {
  beforeEach(() => {
    almacen.clear();
    vi.resetModules();
  });

  it("la PRIMERA pasada no inventa eventos, pero deja la foto guardada", async () => {
    conRed(cuadroStats([{ nombre: "Timothy Mugisha", equipo: "Stade Francais", t: 3, tp: 15 }]));
    const { fetchSeven } = await import("./seven");

    const c = await fetchSeven(true);
    // Si la primera pasada derivara, los 3 tries del acumulado se leerían como
    // si acabaran de pasar.
    expect(c!.eventos).toEqual([]);
    expect(c!.jugadores).toHaveLength(1);

    const bitacora = almacen.get("seven:eventos:v2:1344636") as any;
    expect(bitacora.data.foto).toHaveLength(1);
    expect(bitacora.data.foto[0].tries).toBe(3);
  });

  it("la SEGUNDA pasada publica el try y los puntos de patada", async () => {
    conRed(cuadroStats([{ nombre: "Timothy Mugisha", equipo: "Stade Francais", t: 3, tp: 15 }]));
    const { fetchSeven } = await import("./seven");
    await fetchSeven(true);

    // Anotó: un try (5) y pateó una conversión (2).
    conRed(cuadroStats([{ nombre: "Timothy Mugisha", equipo: "Stade Francais", t: 4, tp: 22, c: 1 }]));
    const c = await fetchSeven(true);

    expect(c!.eventos.map((e) => ({ tipo: e.tipo, cantidad: e.cantidad, jugador: e.jugador })))
      .toEqual([
        { tipo: "try", cantidad: 1, jugador: "Timothy Mugisha" },
        { tipo: "conversión", cantidad: 1, jugador: "Timothy Mugisha" },
      ]);
    // La ventana es el rato entre las dos fotos.
    expect(Date.parse(c!.eventos[0].hasta)).toBeGreaterThanOrEqual(Date.parse(c!.eventos[0].desde));
  });

  it("los eventos se ACUMULAN entre pasadas, lo último primero", async () => {
    conRed(cuadroStats([{ nombre: "A", equipo: "Old Reds", t: 0, tp: 0 }]));
    const { fetchSeven } = await import("./seven");
    await fetchSeven(true);

    conRed(cuadroStats([{ nombre: "A", equipo: "Old Reds", t: 1, tp: 5 }]));
    await fetchSeven(true);
    conRed(cuadroStats([{ nombre: "A", equipo: "Old Reds", t: 1, tp: 5, yc: 1 }]));
    const c = await fetchSeven(true);

    expect(c!.eventos.map((e) => e.tipo)).toEqual(["amarilla", "try"]);
  });

  it("CONTROL NEGATIVO: si el cuadro falla, no se publica un evento por jugador", async () => {
    conRed(cuadroStats([
      { nombre: "A", equipo: "Old Reds", t: 2, tp: 10 },
      { nombre: "B", equipo: "COBS", t: 1, tp: 5 },
    ]));
    const { fetchSeven } = await import("./seven");
    await fetchSeven(true);

    // arusa se cae: statsDeGrupo devuelve [] y la foto quedaría vacía.
    conRed({ code: 1, content: "" });
    const caido = await fetchSeven(true);
    expect(caido!.eventos).toEqual([]);
    // La foto NO se pisó, así que sigue siendo la buena.
    expect((almacen.get("seven:eventos:v2:1344636") as any).data.foto).toHaveLength(2);

    // Y cuando vuelve, tampoco: el acumulado es el mismo que antes de la caída.
    conRed(cuadroStats([
      { nombre: "A", equipo: "Old Reds", t: 2, tp: 10 },
      { nombre: "B", equipo: "COBS", t: 1, tp: 5 },
    ]));
    const vuelve = await fetchSeven(true);
    expect(vuelve!.eventos).toEqual([]);
  });

  it("el payload trae la tabla oficial y NO cuenta el grupo acumulado", async () => {
    // Con el documento real: es la comprobación de que lo que se arregló hoy
    // sigue arreglado cuando cambie cualquier otra cosa.
    conRed(cuadroStats([]));
    const { fetchSeven } = await import("./seven");
    const c = await fetchSeven(true);

    expect(c!.oficial.slice(0, 4).map((f) => f.team))
      .toEqual(["Old Boys", "PWCC", "COBS", "Old Reds"]);
    const ob = c!.tabla.find((f) => f.team === "Old Boys")!;
    expect({ pj: ob.pj, pe: ob.pe, pts: ob.pts }).toEqual({ pj: 4, pe: 0, pts: 15 });
    expect(c!.etapas.flatMap((e) => e.grupos.map((g) => g.nombre)))
      .not.toContain("Tabla acumulada Circuito de Seven");
  });
});

describe("un grupo que falla no debe inventar tries al volver", () => {
  // Su propio beforeEach: sin esto el test arranca con la bitácora que dejó el
  // describe anterior —una foto vacía— y entonces la PRIMERA pasada ya deriva
  // y todos entran como debutantes. Me pasó: el test fallaba por estar
  // contaminado, no por el bug que quería medir.
  beforeEach(() => {
    almacen.clear();
    vi.resetModules();
  });

  it("si un grupo se cae y vuelve, sus jugadores no cuentan como nuevos", async () => {
    // Dos grupos con datos. El cuadro se pide POR GRUPO y cada uno falla
    // aparte, así que una foto puede venir INCOMPLETA en vez de vacía —y
    // fotoUsable sólo mira el caso vacío.
    const dos = cuadroStats([
      { nombre: "A", equipo: "Old Reds", t: 3, tp: 15 },
      { nombre: "B", equipo: "COBS", t: 2, tp: 10 },
    ]);
    const soloUno = cuadroStats([{ nombre: "A", equipo: "Old Reds", t: 3, tp: 15 }]);

    conRed(dos);
    const { fetchSeven } = await import("./seven");
    await fetchSeven(true);

    // El grupo de B se cae: la foto queda con un jugador menos, pero NO vacía.
    conRed(soloUno);
    await fetchSeven(true);

    // Vuelve. B reaparece con sus 2 tries de siempre.
    conRed(dos);
    const c = await fetchSeven(true);

    // B no anotó nada: su acumulado es el mismo que al principio.
    expect(c!.eventos).toEqual([]);
  });
});
