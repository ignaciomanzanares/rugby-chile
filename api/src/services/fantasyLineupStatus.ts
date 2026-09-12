/**
 * Estado de cada jugador de fantasy en la nómina oficial de la fecha:
 * titular, en la banca, o dejado fuera.
 *
 * Sale de Leverade (services/leveradeLineups.ts), no de arusa, así que no gasta
 * presupuesto del muro y está disponible desde que el club sube la nómina —
 * mediana ~22 h antes del partido.
 *
 * EL CRUCE ES POR NOMBRE. Leverade identifica al jugador por `profile.id` y
 * nosotros por el `arusaId` de arusa; no hay ninguna llave en común. Medido el
 * 2026-09-12 sobre los 5 partidos de Primera de la fecha 18: de 159 jugadores
 * en nómina, 132 cruzan exacto y los 27 restantes NO tienen ningún candidato en
 * el pool de fantasy (son jugadores sin estadísticas en arusa, que por lo tanto
 * no son fichables). Cero coincidencias parciales y cero ambigüedades, así que
 * el nombre exacto normalizado alcanza y no hace falta un cruce difuso, que
 * sería justamente el que inventaría falsos positivos.
 *
 * POR QUÉ "SIN PUBLICAR" ES UN ESTADO Y NO UN ROJO. Los clubes suben la nómina
 * por separado y a horas distintas. Si un club todavía no la sube, no sabemos
 * nada de sus jugadores: marcarlos "fuera" sería afirmar algo falso justo
 * cuando el usuario está decidiendo cambios. Por eso `jugadores` sólo trae a
 * los clubes que ya publicaron, y el resto queda sin entrada.
 */
import { fetchAllMatchesMeta, type DivisionKey } from "../lib/leverade";
import { fetchLeveradeLineup } from "./leveradeLineups";
import { getPricedPlayers } from "./fantasyPricing";

export type EstadoNomina = "titular" | "banca" | "fuera";

export interface NominaFecha {
  round: number;
  /** slug de club → si ese club ya publicó su nómina de la fecha. */
  publicada: Record<string, boolean>;
  /** arusaId → estado. Sólo clubes con nómina publicada. */
  jugadores: Record<string, EstadoNomina>;
}

const slugDeClub = (name: string) => name.toLowerCase().trim().replace(/\s+/g, "-");

/**
 * Llave de cruce. Tiene que absorber cómo tipea cada club: "cristobal  atenas
 * parra", "CARLOS  BUSCHMAN", "Andrei " con espacio al final, tildes puestas o
 * no, guiones en apellidos compuestos.
 */
export function clave(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function estadoNominas(
  division: DivisionKey,
  round: number,
): Promise<NominaFecha> {
  const out: NominaFecha = { round, publicada: {}, jugadores: {} };

  let meta;
  try {
    meta = await fetchAllMatchesMeta();
  } catch {
    return out;
  }
  const partidos = meta.filter((m) => m.division === division && m.round === round && !m.postponed);
  if (partidos.length === 0) return out;

  // slug de club → (nombre normalizado → estado)
  const porClub = new Map<string, Map<string, EstadoNomina>>();

  const nominas = await Promise.all(
    partidos.map((m) =>
      fetchLeveradeLineup(m.matchId, m.homeTeam, m.awayTeam, m.finished).catch(() => null),
    ),
  );

  for (const lu of nominas) {
    if (!lu) continue;
    for (const lado of [lu.home, lu.away]) {
      // Un lado vacío es un club que todavía no sube la suya, no un club sin
      // jugadores: se deja fuera para que sus jugadores queden "sin publicar".
      if (lado.starters.length === 0 && lado.subs.length === 0) continue;
      const slug = slugDeClub(lado.team);
      const m = new Map<string, EstadoNomina>();
      for (const p of lado.starters) m.set(clave(p.name), "titular");
      for (const p of lado.subs) m.set(clave(p.name), "banca");
      porClub.set(slug, m);
      out.publicada[slug] = true;
    }
  }

  // Los clubes que juegan la fecha y no aparecieron arriba: nómina pendiente.
  for (const m of partidos) {
    for (const t of [m.homeTeam, m.awayTeam]) {
      const slug = slugDeClub(t);
      if (!(slug in out.publicada)) out.publicada[slug] = false;
    }
  }

  const jugadores = await getPricedPlayers(divisionFantasy(division));
  for (const j of jugadores) {
    const nomina = porClub.get(j.teamSlug);
    if (!nomina) continue; // club sin publicar → sin entrada, la web lo muestra gris
    out.jugadores[j.arusaId] = nomina.get(clave(j.name)) ?? "fuera";
  }

  return out;
}

/** El fantasy nombra las divisiones en minúscula; Leverade en mayúscula. */
function divisionFantasy(d: DivisionKey): string {
  return d.toLowerCase();
}
