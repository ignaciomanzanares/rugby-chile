"use client";

import { ClubLogo } from "@/components/club-logo";
import type { Playoffs } from "@/lib/use-playoffs";

/**
 * La "fecha" de semifinales.
 *
 * Los cruces no vienen de Leverade —no publica los playoffs— sino de la tabla
 * final, según el reglamento: 1º vs 4º, 2º vs 3º, y el mejor sembrado es local.
 * Por eso se muestra el sembrado junto a cada equipo: explica de dónde sale el
 * cruce sin que haya que saberse el reglamento.
 *
 * El pronóstico sólo existe en Primera (es la única división con modelo
 * ajustado). En el resto se muestra el cruce sin porcentajes, que es preferible
 * a inventar un número.
 */
/** "2026-09-26" → "Sáb 26 Sep". Se parte a mano para que no lo corra la zona horaria. */
function diaLargo(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  const dia = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][f.getDay()];
  const mes = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m - 1];
  return `${dia} ${d} ${mes}`;
}

export function SemifinalsRound({ playoffs }: { playoffs: Playoffs }) {
  return (
    <div className="space-y-3">
      {!playoffs.decided && (
        <p className="text-xs text-amber-500">
          Cuadro provisional: todavía quedan partidos de la fase regular, así que las posiciones pueden cambiar.
        </p>
      )}

      {playoffs.semifinals.map((sf) => {
        const hayPronostico = sf.homeWinPct != null && sf.awayWinPct != null;
        return (
          <div key={sf.label} className="rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-500">{sf.label}</span>
              <span className="text-[10px] text-muted-foreground/70 text-right">
                {sf.date ? diaLargo(sf.date) : "Día por confirmar"}
                {sf.venue && <> · {sf.venue}</>}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <ClubLogo team={sf.home} className="w-8 h-8 rounded-full ring-1 ring-border flex-shrink-0" />
                <span className="min-w-0">
                  <span className="block font-semibold text-sm truncate">{sf.home}</span>
                  <span className="block text-[10px] text-muted-foreground">{sf.homeSeed}º · local</span>
                </span>
              </div>
              <span className="text-muted-foreground/60 text-xs font-bold">vs</span>
              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
                <span className="min-w-0">
                  <span className="block font-semibold text-sm truncate">{sf.away}</span>
                  <span className="block text-[10px] text-muted-foreground">{sf.awaySeed}º</span>
                </span>
                <ClubLogo team={sf.away} className="w-8 h-8 rounded-full ring-1 ring-border flex-shrink-0" />
              </div>
            </div>

            {hayPronostico && (
              <div className="mt-3 pt-3 border-t border-border/60">
                {/* Una barra en vez de tres números sueltos: se lee de un vistazo
                    quién es favorito y por cuánto. */}
                <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                  <div className="bg-emerald-500" style={{ width: `${sf.homeWinPct}%` }} />
                  <div className="bg-muted-foreground/40" style={{ width: `${sf.drawPct ?? 0}%` }} />
                  <div className="bg-sky-500" style={{ width: `${sf.awayWinPct}%` }} />
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[10px] tabular-nums">
                  <span className="text-emerald-500 font-bold">{Math.round(sf.homeWinPct!)}%</span>
                  <span className="text-muted-foreground/70">
                    proyección · {sf.expHome}-{sf.expAway} esperado
                  </span>
                  <span className="text-sky-500 font-bold">{Math.round(sf.awayWinPct!)}%</span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <p className="text-[10px] text-muted-foreground/70">
        El cruce sale de la tabla final según el reglamento (1º vs 4º, 2º vs 3º; local el mejor sembrado).
        Día y cancha informados por ARUSA; los horarios todavía no se confirman.
      </p>
    </div>
  );
}
