/**
 * Cuándo se avisa y cuándo no. `decidirAvisos` es pura, así que acá no hay red
 * ni caché: se le pasa el circuito, lo ya avisado y la hora exacta.
 *
 * El sábado 7 de noviembre de 2026 la Etapa 2 arranca 09:00 de Chile, que son
 * las 12:00 UTC. Todos los instantes de abajo están alrededor de ése.
 */
import { describe, it, expect } from "vitest";
import { decidirAvisos, type AvisosGuardados } from "./sevenPush";
import type { SevenCircuito, SevenCopa } from "../lib/seven";

const ANTES = Date.parse("2026-11-07T11:59:00Z"); // 08:59 Chile
const JUSTO = Date.parse("2026-11-07T12:00:00Z"); // 09:00 Chile
const TARDE = Date.parse("2026-11-07T20:00:00Z"); // 17:00 Chile

const LIMPIO: AvisosGuardados = { inicio: [], cierre: [] };

function circuito(opts: {
  fecha?: string | null;
  jugada?: boolean;
  horas?: (string | null)[];
  copas?: SevenCopa[];
}): SevenCircuito {
  const horas = opts.horas ?? ["10:00", "09:00", "11:20"];
  return {
    tournamentId: "1344636",
    etapas: [
      {
        numero: 2,
        fecha: opts.fecha === undefined ? "2026-11-07" : opts.fecha,
        jugada: opts.jugada ?? false,
        grupos: [
          {
            nombre: "Grupo A",
            grupoId: "1",
            partidos: horas.map((hora, i) => ({ id: String(i), hora, finished: false })),
          },
        ],
        copas: opts.copas ?? [],
        clasificacion: [],
      },
    ],
  } as unknown as SevenCircuito;
}

const ORO = (campeon: string | null, extra: Partial<SevenCopa> = {}): SevenCopa =>
  ({ nombre: "Oro", campeon, finalista: null, campeonScore: null, finalistaScore: null, partidos: [], ...extra }) as SevenCopa;

describe("decidirAvisos — el arranque de la etapa", () => {
  it("un minuto ANTES del primer partido no avisa nada", () => {
    const { avisos } = decidirAvisos(circuito({}), LIMPIO, ANTES);
    expect(avisos).toEqual([]);
  });

  it("a la hora del PRIMER partido avisa que arrancó", () => {
    // Las horas vienen desordenadas a propósito: el que manda es el más
    // temprano, no el primero de la lista.
    const { avisos, guardar } = decidirAvisos(circuito({}), LIMPIO, JUSTO);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].title).toBe("🏉 Seven · Arrancó la Etapa 2");
    expect(avisos[0].url).toBe("/seven");
    expect(guardar.inicio).toEqual(["2026-11-07"]);
  });

  it("no lo repite en la pasada siguiente", () => {
    const c = circuito({});
    const { guardar } = decidirAvisos(c, LIMPIO, JUSTO);
    // El poller vuelve dos minutos después con lo mismo.
    const { avisos } = decidirAvisos(c, guardar, JUSTO + 2 * 60_000);
    expect(avisos).toEqual([]);
  });

  it("sin horario publicado no avisa: a medianoche la etapa ya es 'de hoy'", () => {
    const { avisos } = decidirAvisos(circuito({ horas: [null, null] }), LIMPIO, JUSTO);
    expect(avisos).toEqual([]);
  });

  it("CONTROL NEGATIVO: una etapa que no es la de hoy no dispara nada", () => {
    const { avisos } = decidirAvisos(circuito({ fecha: "2026-11-14", jugada: true }), LIMPIO, JUSTO);
    expect(avisos).toEqual([]);
  });
});

describe("decidirAvisos — el cierre", () => {
  it("cuando la etapa queda jugada avisa con el campeón de Oro y el marcador", () => {
    const copas = [ORO("Old Reds", { finalista: "COBS", campeonScore: 26, finalistaScore: 14 })];
    const { avisos } = decidirAvisos(
      circuito({ jugada: true, copas }),
      { inicio: ["2026-11-07"], cierre: [] },
      TARDE,
    );
    expect(avisos).toHaveLength(1);
    expect(avisos[0].title).toBe("🏉 Seven · Terminó la Etapa 2");
    expect(avisos[0].body).toBe("Old Reds se llevó la Copa de Oro, 26-14 a COBS.");
  });

  it("si la final de Oro no está cargada, avisa igual pero sin inventar campeón", () => {
    const { avisos } = decidirAvisos(
      circuito({ jugada: true, copas: [ORO(null)] }),
      { inicio: ["2026-11-07"], cierre: [] },
      TARDE,
    );
    expect(avisos[0].body).toBe("Ya están los resultados y la clasificación del día.");
  });

  it("tampoco lo repite", () => {
    const c = circuito({ jugada: true, copas: [ORO("Old Reds")] });
    const { guardar } = decidirAvisos(c, { inicio: ["2026-11-07"], cierre: [] }, TARDE);
    const { avisos } = decidirAvisos(c, guardar, TARDE + 2 * 60_000);
    expect(avisos).toEqual([]);
  });

  it("si el servidor se enteró recién a la tarde, NO dice 'arrancó' pegado al cierre", () => {
    // Éste es el caso que importa: sin la guarda saldrían los dos avisos
    // juntos a las 17:00, y el primero sería mentira.
    const c = circuito({ jugada: true, copas: [ORO("Old Reds")] });
    const { avisos, guardar } = decidirAvisos(c, LIMPIO, TARDE);
    expect(avisos.map((a) => a.title)).toEqual(["🏉 Seven · Terminó la Etapa 2"]);
    // Y el arranque queda marcado, para que no salga después.
    expect(guardar.inicio).toEqual(["2026-11-07"]);
  });
});
