"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Clock, MapPin, ExternalLink, Users, Swords } from "lucide-react";
import { clubLogo, CLUB_INSTAGRAM, type DivisionKey } from "@/lib/tournament";
import { useTeamForm } from "@/lib/use-team-form";
import { FormPills } from "@/components/form-pills";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const DIVISION_API_KEY: Record<DivisionKey, string> = {
  PRIMERA: "PRIMERA",
  INTERMEDIA: "INTERMEDIA",
  PRE_INTERMEDIA: "PRE_INTERMEDIA",
};

const RUGBY_POSITIONS = [
  "1. Pilar izquierdo",
  "2. Talonador",
  "3. Pilar derecho",
  "4. Segundo línea",
  "5. Segundo línea",
  "6. Ala ciega",
  "7. Ala abierta",
  "8. Octavo",
  "9. Medio scrum",
  "10. Apertura",
  "11. Ala izquierdo",
  "12. Centro",
  "13. Centro",
  "14. Ala derecho",
  "15. Zaguero",
];

type Lineup = {
  homeStarters: string[] | null;
  homeSubs: string[] | null;
  awayStarters: string[] | null;
  awaySubs: string[] | null;
  homeInstagramUrl: string | null;
  awayInstagramUrl: string | null;
  crawledAt: string | null;
} | null;

type MatchInfo = {
  home: string;
  away: string;
  date: string;
  time: string;
  venue: string;
  status: "FINISHED" | "UPCOMING";
  homeScore?: number;
  awayScore?: number;
  round: number;
  division: DivisionKey;
};

function ClubLogo({ team }: { team: string }) {
  const logo = clubLogo(team);
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt={team} className="w-12 h-12 rounded-full object-cover ring-2 ring-zinc-700" />
    );
  }
  return (
    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-300">
      {team.slice(0, 2).toUpperCase()}
    </div>
  );
}

function LineupColumn({
  team,
  starters,
  subs,
  instagramPostUrl,
}: {
  team: string;
  starters: string[] | null;
  subs: string[] | null;
  instagramPostUrl?: string | null;
}) {
  const instaHandle = CLUB_INSTAGRAM[team];
  const hasLineup = starters && starters.filter(Boolean).length >= 5;

  if (!hasLineup) {
    // If we found a post but couldn't parse names, link directly to it
    const postLink = instagramPostUrl;
    const profileLink = instaHandle ? `https://www.instagram.com/${instaHandle}` : null;

    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Users className="h-8 w-8 text-zinc-700" />
        {postLink ? (
          <>
            <p className="text-xs text-zinc-500 text-center leading-relaxed">
              Formación publicada en Instagram —<br />los nombres no pudieron extraerse automáticamente.
            </p>
            <a
              href={postLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-900/30 hover:bg-pink-900/50 border border-pink-800/50 text-xs font-semibold text-pink-300 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver formación en Instagram
            </a>
          </>
        ) : (
          <>
            <p className="text-xs text-zinc-500 text-center leading-relaxed">
              Formación no disponible aún.<br />Suele publicarse 1–2 días antes.
            </p>
            {profileLink && (
              <a
                href={profileLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5 text-pink-400" />
                @{instaHandle} (Instagram)
              </a>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {starters.map((name, i) => (
        <div key={i} className="flex items-baseline gap-2 py-1 border-b border-zinc-800/60 last:border-0">
          <span className="text-[10px] text-zinc-600 w-16 flex-shrink-0 font-mono leading-tight">
            {RUGBY_POSITIONS[i]?.split(". ")[0]}.
          </span>
          <span className="text-xs text-zinc-300 leading-tight">{name || "–"}</span>
        </div>
      ))}
      {subs && subs.length > 0 && (
        <div className="pt-2 mt-1 border-t border-zinc-700">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Suplentes</p>
          {subs.map((name, i) => (
            <div key={i} className="flex items-baseline gap-2 py-0.5">
              <span className="text-[10px] text-zinc-700 w-4 flex-shrink-0">{i + 16}.</span>
              <span className="text-xs text-zinc-400">{name || "–"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MatchDetailSheet({
  match,
  open,
  onClose,
}: {
  match: MatchInfo | null;
  open: boolean;
  onClose: () => void;
}) {
  const [lineup, setLineup] = useState<Lineup>(undefined as unknown as Lineup);
  const [loading, setLoading] = useState(false);
  const { form } = useTeamForm(match?.division ?? "PRIMERA");

  useEffect(() => {
    if (!open || !match) return;
    setLineup(undefined as unknown as Lineup);
    if (match.status === "FINISHED") return;

    setLoading(true);
    const divKey = DIVISION_API_KEY[match.division];
    fetch(
      `${API_URL}/api/v1/lineups?division=${divKey}&round=${match.round}&home=${encodeURIComponent(match.home)}&away=${encodeURIComponent(match.away)}`,
    )
      .then((r) => r.json())
      .then(setLineup)
      .catch(() => setLineup(null))
      .finally(() => setLoading(false));
  }, [open, match]);

  if (!match) return null;

  const finished = match.status === "FINISHED";
  const homeForm = form[match.home];
  const awayForm = form[match.away];
  const h2h = (homeForm ?? []).filter((m) => m.opponent === match.away);
  const hasForm = (homeForm?.length ?? 0) > 0 || (awayForm?.length ?? 0) > 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="bg-zinc-950 border-t border-zinc-800 text-white rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="sr-only">Detalles del partido</SheetTitle>
        </SheetHeader>

        {/* Match header */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <ClubLogo team={match.home} />
            <span className="text-sm font-bold text-center leading-tight">{match.home}</span>
          </div>

          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            {finished ? (
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black tabular-nums">{match.homeScore}</span>
                <span className="text-zinc-600 text-xl">–</span>
                <span className="text-3xl font-black tabular-nums">{match.awayScore}</span>
              </div>
            ) : (
              <span className="text-zinc-500 text-xs font-bold tracking-widest uppercase">VS</span>
            )}
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
              {finished ? "Final" : "Próximo"}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5 flex-1">
            <ClubLogo team={match.away} />
            <span className="text-sm font-bold text-center leading-tight">{match.away}</span>
          </div>
        </div>

        {/* Match details */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-5 text-xs text-zinc-500">
          {match.time && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {match.date} · {match.time}
            </span>
          )}
          {match.venue && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {match.venue}
            </span>
          )}
        </div>

        {/* Form + head-to-head */}
        {hasForm && (
          <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate max-w-full">{match.home}</span>
                <FormPills form={homeForm} />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate max-w-full">{match.away}</span>
                <FormPills form={awayForm} />
              </div>
            </div>

            <div className="border-t border-zinc-800 mt-3 pt-3">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <Swords className="h-3 w-3 text-zinc-500" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Historial</span>
              </div>
              {h2h.length > 0 ? (
                <div className="space-y-1.5">
                  {h2h.map((m, i) => (
                    <div key={i} className="flex items-center justify-center gap-2 text-xs">
                      {m.round != null && <span className="text-zinc-600 font-mono text-[10px]">F{m.round}</span>}
                      <span className="text-zinc-300">
                        {match.home}{" "}
                        <span className={`font-black tabular-nums ${m.result === "W" ? "text-emerald-400" : m.result === "L" ? "text-red-400" : "text-zinc-300"}`}>
                          {m.scoreFor}-{m.scoreAgainst}
                        </span>{" "}
                        {match.away}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-600 text-center">Primer enfrentamiento de la temporada</p>
              )}
            </div>
          </div>
        )}

        {/* Lineups */}
        {!finished && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-zinc-500" />
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Formaciones</h3>
            </div>

            {loading ? (
              <div className="text-center py-6 text-zinc-600 text-sm">Cargando formaciones…</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{match.home}</p>
                    <LineupColumn
                      team={match.home}
                      starters={lineup?.homeStarters ?? null}
                      subs={lineup?.homeSubs ?? null}
                      instagramPostUrl={lineup?.homeInstagramUrl}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{match.away}</p>
                    <LineupColumn
                      team={match.away}
                      starters={lineup?.awayStarters ?? null}
                      subs={lineup?.awaySubs ?? null}
                      instagramPostUrl={lineup?.awayInstagramUrl}
                    />
                  </div>
                </div>
                {lineup?.crawledAt ? (
                  <p className="text-[10px] text-zinc-700 text-center mt-3">
                    Actualizado {new Date(lineup.crawledAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                ) : null}
              </>
            )}
          </>
        )}

        {finished && (
          <p className="text-xs text-zinc-600 text-center py-2">Partido finalizado</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
