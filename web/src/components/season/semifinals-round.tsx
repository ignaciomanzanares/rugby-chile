"use client";

import { CheckCircle, ChevronRight } from "lucide-react";
import { ClubLogo } from "@/components/club-logo";
import type { Playoffs, Semifinal } from "@/lib/use-playoffs";

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
 *
 * Las tarjetas ABREN el detalle, igual que las de la fase regular: son la única
 * vía a la cronología y a las formaciones de los playoffs. Cuando eran <div>
 * el partido se veía pero no se podía tocar.
 */
/** "2026-09-26" → "Sáb 26 Sep". Se parte a mano para que no lo corra la zona horaria. */
function diaLargo(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  const dia = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][f.getDay()];
  const mes = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m - 1];
  return `${dia} ${d} ${mes}`;
}

/** Lo que necesita el detalle para abrirse: mismo formato de fecha que el fixture. */
export type PlayoffPick = {
  home: string; away: string; date: string; time: string; venue: string;
  homeScore: number | null; awayScore: number | null; finished: boolean;
};

export function SemifinalsRound({
  playoffs,
  onSelect,
}: {
  playoffs: Playoffs;
  onSelect: (p: PlayoffPick) => void;
}) {
  return (
    <div className="space-y-3">
      {!playoffs.decided && (
        <p className="text-xs text-amber-500">
          Cuadro provisional: todavía quedan partidos de la fase regular, así que las posiciones pueden cambiar.
        </p>
      )}

      {playoffs.semifinals.map((sf) => {
        // Con resultado NO se muestra el pronóstico: ya no hay nada que
        // pronosticar y deja de leerse como un partido por jugar.
        const jugado = sf.homeScore != null && sf.awayScore != null;
        const hayPronostico = !jugado && sf.homeWinPct != null && sf.awayWinPct != null;
        return (
          <button
            key={sf.label}
            type="button"
            onClick={() => onSelect(aPick(sf))}
            className="w-full text-left rounded-xl border border-border bg-card/50 p-4 hover:border-foreground/30 active:scale-[0.99] transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-500">
                {sf.label}
              </span>
              <span className="text-[10px] text-muted-foreground/70 text-right">
                {sf.date ? diaLargo(sf.date) : "Día por confirmar"}
                {sf.time && <> · {sf.time}</>}
                {sf.venue && <><br />{sf.venue}</>}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <ClubLogo team={sf.home} stopPropagation className="w-8 h-8 rounded-full ring-1 ring-border flex-shrink-0" />
                <span className="min-w-0">
                  <span className="block font-semibold text-sm truncate">{sf.home}</span>
                  <span className="block text-[10px] text-muted-foreground">{sf.homeSeed}º · local</span>
                </span>
              </div>
              {jugado ? (
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xl font-black tabular-nums ${sf.homeScore! > sf.awayScore! ? "" : "text-muted-foreground"}`}>{sf.homeScore}</span>
                  <span className="text-muted-foreground/50">-</span>
                  <span className={`text-xl font-black tabular-nums ${sf.awayScore! > sf.homeScore! ? "" : "text-muted-foreground"}`}>{sf.awayScore}</span>
                </span>
              ) : (
                <span className="text-muted-foreground/60 text-xs font-bold">vs</span>
              )}
              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
                <span className="min-w-0">
                  <span className="block font-semibold text-sm truncate">{sf.away}</span>
                  <span className="block text-[10px] text-muted-foreground">{sf.awaySeed}º</span>
                </span>
                <ClubLogo team={sf.away} stopPropagation className="w-8 h-8 rounded-full ring-1 ring-border flex-shrink-0" />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
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

            <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground/50">
              {jugado ? (
                <span className="flex items-center gap-1 text-emerald-600"><CheckCircle className="h-3 w-3" />Finalizado</span>
              ) : null}
              <span className="ml-auto">{jugado ? "Ver cronología →" : "Ver formación →"}</span>
            </div>
          </button>
        );
      })}

      <p className="text-[10px] text-muted-foreground/70">
        El cruce sale de la tabla final según el reglamento (1º vs 4º, 2º vs 3º; local el mejor sembrado).
        Día, hora y cancha del fixture oficial de ARUSA.
      </p>
    </div>
  );
}

function aPick(sf: Semifinal): PlayoffPick {
  return {
    home: sf.home,
    away: sf.away,
    date: sf.date ? diaLargo(sf.date) : "Por definir",
    time: sf.time ?? "",
    venue: sf.venue ?? "",
    homeScore: sf.homeScore,
    awayScore: sf.awayScore,
    finished: sf.finished,
  };
}

/** La final, como su propia "fecha". Los equipos salen de las semis. */
export function FinalRound({
  playoffs,
  onSelect,
}: {
  playoffs: Playoffs;
  onSelect: (p: PlayoffPick) => void;
}) {
  const f = playoffs.final;
  if (!f) return null;
  // Sin finalistas definidos no hay partido que abrir: el detalle no sabría a
  // quién buscar. La tarjeta queda informativa, como estaba.
  const abrible = !!(f.home && f.away);
  const Tag = abrible ? "button" : "div";
  return (
    <div className="space-y-3">
      <Tag
        {...(abrible
          ? {
              type: "button" as const,
              onClick: () =>
                onSelect({
                  home: f.home!, away: f.away!, date: diaLargo(f.date), time: f.time, venue: f.venue,
                  homeScore: null, awayScore: null, finished: false,
                }),
              className:
                "w-full text-left rounded-xl border border-red-600/40 bg-red-600/5 p-4 hover:border-red-600/70 active:scale-[0.99] transition-all cursor-pointer",
            }
          : { className: "rounded-xl border border-red-600/40 bg-red-600/5 p-4" })}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[10px] font-bold tracking-widest uppercase text-red-500">Final</span>
          <span className="text-[10px] text-muted-foreground/70 text-right">
            {diaLargo(f.date)} · {f.time}
            <br />{f.venue}
          </span>
        </div>
        <p className="text-sm font-semibold flex items-center gap-2">
          <span>{f.home ?? "Ganador SF1"} <span className="text-muted-foreground/60 font-normal">vs</span> {f.away ?? "Ganador SF2"}</span>
          {abrible && <ChevronRight className="h-4 w-4 text-muted-foreground/50 ml-auto flex-shrink-0" />}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {abrible ? "Ver formación →" : "Se define con las semifinales del fin de semana anterior."}
        </p>
      </Tag>
      <p className="text-[10px] text-muted-foreground/70">
        Día, hora y cancha del fixture oficial de ARUSA.
      </p>
    </div>
  );
}
