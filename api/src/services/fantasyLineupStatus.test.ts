import { describe, it, expect } from "vitest";
import { clave } from "./fantasyLineupStatus";

// Los nombres llegan como los tipeó cada club en Leverade y como los publica
// arusa: mismo jugador, escrituras distintas. La bandera del fantasy depende de
// que estas dos puntas caigan en la misma llave.
describe("cruce de nombres entre Leverade y arusa", () => {
  it("ignora mayúsculas, tildes y espacios de más", () => {
    expect(clave("CARLOS  BUSCHMAN")).toBe(clave("carlos buschman"));
    expect(clave("Andrei ")).toBe(clave("andrei"));
    expect(clave("Iñaki Tusét  Mercier")).toBe(clave("inaki tuset mercier"));
  });

  it("ignora guiones y puntos de apellidos compuestos", () => {
    expect(clave("Franco Scassi-Buffa Gonzalez")).toBe(clave("franco scassi buffa gonzalez"));
    expect(clave("J. P. Errázuriz")).toBe(clave("j p errazuriz"));
  });

  it("NO junta a dos jugadores distintos", () => {
    // El apellido materno es lo único que los separa: si la llave los uniera,
    // uno de los dos mostraría la bandera del otro.
    expect(clave("Cristobal Vidal Trucco")).not.toBe(clave("Cristobal Vidal Cuchacovich"));
    expect(clave("Nicolas Trucco")).not.toBe(clave("Nicolas Trucco Vidal"));
  });
});
