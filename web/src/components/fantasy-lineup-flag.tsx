"use client";

/**
 * Bandera de nómina: dice si el jugador es titular, va a la banca o quedó
 * fuera de la nómina oficial de la fecha.
 *
 * El cuarto estado — "sin publicar" — existe porque los clubes suben la nómina
 * por separado y a horas distintas. Mientras un club no la suba no sabemos nada
 * de sus jugadores, y pintarlos de rojo sería afirmar que los dejaron fuera
 * justo cuando el usuario está decidiendo cambios. Gris significa "todavía no
 * se sabe", que es distinto de "no está".
 */

export type EstadoNomina = "titular" | "banca" | "fuera";

const ESTILO: Record<EstadoNomina | "pendiente", { color: string; texto: string }> = {
  titular:   { color: "bg-emerald-400", texto: "Titular" },
  banca:     { color: "bg-amber-400",   texto: "En la banca" },
  fuera:     { color: "bg-red-500",     texto: "Fuera de la nómina" },
  pendiente: { color: "bg-zinc-400",    texto: "El club aún no publica la nómina" },
};

export function LineupFlag({
  estado,
  className = "",
}: {
  estado: EstadoNomina | null | undefined;
  className?: string;
}) {
  const e = ESTILO[estado ?? "pendiente"];
  return (
    <span
      // El color solo no basta: quien no distingue rojo de verde necesita el
      // texto, y en el punto no cabe. Va en el title y en el lector de pantalla.
      title={e.texto}
      aria-label={e.texto}
      role="img"
      className={`inline-block rounded-full ring-1 ring-black/40 ${e.color} ${className}`}
    />
  );
}

/** Leyenda, para que el color se entienda sin tener que tocar cada jugador. */
export function LineupFlagLegend({ pendientes }: { pendientes: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      {(["titular", "banca", "fuera"] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <LineupFlag estado={k} className="w-2 h-2" />
          {ESTILO[k].texto}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <LineupFlag estado={null} className="w-2 h-2" />
        {pendientes.length
          ? `Sin nómina (${pendientes.join(", ")})`
          : "Sin nómina"}
      </span>
    </div>
  );
}
