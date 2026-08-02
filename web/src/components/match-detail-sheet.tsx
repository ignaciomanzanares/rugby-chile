"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Clock, MapPin, ExternalLink, Users, Swords, Activity, Flag, TrendingUp } from "lucide-react";
import { clubLogo, CLUB_INSTAGRAM, type DivisionKey } from "@/lib/tournament";
import { useTeamForm } from "@/lib/use-team-form";
import { NewsImage } from "@/components/news-image";
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
  homeImages: string[] | null;
  awayImages: string[] | null;
  homeSourceUrl: string | null;
  awaySourceUrl: string | null;
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

type MatchTimelineEvent = {
  minute: number;
  type: string;
  playerName?: string | null;
  team: "home" | "away";
  homeScore: number;
  awayScore: number;
  half: number;
};

type H2HMeeting = { year: number; date: string | null; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number };
type H2HData = {
  teamA: string; teamB: string; meetings: H2HMeeting[];
  aWins: number; bWins: number; draws: number; aHomeWins: number; aAwayWins: number;
};

const EVENT_LABELS: Record<string, string> = {
  TRY: "Try", CONVERSION: "Conversión", PENALTY: "Penal",
  DROP_GOAL: "Drop", YELLOW_CARD: "Amarilla", RED_CARD: "Roja",
};
const EVENT_COLORS: Record<string, string> = {
  TRY: "text-emerald-400", CONVERSION: "text-blue-400", PENALTY: "text-yellow-400",
  DROP_GOAL: "text-purple-400", YELLOW_CARD: "text-yellow-400", RED_CARD: "text-red-500",
};

function ClubLogo({ team }: { team: string }) {
  const logo = clubLogo(team);
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt={team} className="w-12 h-12 rounded-full object-cover ring-2 ring-border" />
    );
  }
  return (
    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground/80">
      {team.slice(0, 2).toUpperCase()}
    </div>
  );
}

function LineupColumn({
  team,
  starters,
  subs,
  images,
  sourceUrl,
}: {
  team: string;
  starters: string[] | null;
  subs: string[] | null;
  images?: string[] | null;
  sourceUrl?: string | null;
}) {
  const instaHandle = CLUB_INSTAGRAM[team];
  const hasLineup = starters && starters.filter(Boolean).length >= 5;

  // Lineups are posted as image graphics — show them (swipeable) when we have them.
  if (images && images.length > 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 overflow-x-auto snap-x pb-1 -mx-1 px-1">
          {images.map((src, i) => (
            <a
              key={i}
              href={sourceUrl ?? (instaHandle ? `https://www.instagram.com/${instaHandle}` : "#")}
              target="_blank"
              rel="noopener noreferrer"
              className="snap-start flex-shrink-0 w-36 rounded-lg overflow-hidden border border-border bg-muted"
            >
              <NewsImage src={src} alt={`Nómina ${team} ${i + 1}`} className="w-36 h-auto block" />
            </a>
          ))}
        </div>
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-pink-300 hover:text-pink-200 transition-colors">
            <ExternalLink className="h-3 w-3" /> Ver nómina publicada
          </a>
        )}
      </div>
    );
  }

  if (!hasLineup) {
    // No names loaded yet. If the admin saved a source link, offer it directly.
    const postLink = sourceUrl;
    const profileLink = instaHandle ? `https://www.instagram.com/${instaHandle}` : null;

    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Users className="h-8 w-8 text-muted-foreground/50" />
        {postLink ? (
          <>
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Formación publicada por el club.
            </p>
            <a
              href={postLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-900/30 hover:bg-pink-900/50 border border-pink-800/50 text-xs font-semibold text-pink-300 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver nómina publicada
            </a>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Formación no disponible aún.<br />Suele publicarse 1–2 días antes.
            </p>
            {profileLink && (
              <a
                href={profileLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-secondary border border-border text-xs font-semibold text-foreground/80 transition-colors"
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
        <div key={i} className="flex items-baseline gap-2 py-1 border-b border-border/60 last:border-0">
          <span className="text-[10px] text-muted-foreground/70 w-16 flex-shrink-0 font-mono leading-tight">
            {RUGBY_POSITIONS[i]?.split(". ")[0]}.
          </span>
          <span className="text-xs text-foreground/80 leading-tight">{name || "–"}</span>
        </div>
      ))}
      {subs && subs.length > 0 && (
        <div className="pt-2 mt-1 border-t border-border">
          <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-1">Suplentes</p>
          {subs.map((name, i) => (
            <div key={i} className="flex items-baseline gap-2 py-0.5">
              <span className="text-[10px] text-muted-foreground/50 w-4 flex-shrink-0">{i + 16}.</span>
              <span className="text-xs text-muted-foreground">{name || "–"}</span>
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
  const [events, setEvents] = useState<MatchTimelineEvent[] | null>(null);
  const [referees, setReferees] = useState<string[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [h2h, setH2h] = useState<H2HData | null>(null);
  const [h2hLoading, setH2hLoading] = useState(false);
  const [odds, setOdds] = useState<{ homeWinPct: number; drawPct: number; awayWinPct: number; expHome: number; expAway: number } | null>(null);
  const { form } = useTeamForm(match?.division ?? "PRIMERA");

  // Timeline in running game-minute order + the half-time score (last 1st-half event).
  const orderedEvents = useMemo(
    () => (events ? [...events].sort((a, b) => a.minute - b.minute) : []),
    [events],
  );
  const htScore = useMemo(() => {
    const firstHalf = orderedEvents.filter((e) => e.half === 1);
    const last = firstHalf[firstHalf.length - 1];
    return last ? { home: last.homeScore, away: last.awayScore } : null;
  }, [orderedEvents]);

  // Match-page data from arusa: minute-by-minute (finished) + referees (both).
  useEffect(() => {
    if (!open || !match) { setEvents(null); setReferees([]); return; }
    setEvents(null);
    setReferees([]);
    setEventsLoading(true);
    fetch(
      `${API_URL}/api/v1/match/events?division=${match.division}&home=${encodeURIComponent(match.home)}&away=${encodeURIComponent(match.away)}`,
    )
      .then((r) => r.json())
      .then((d) => { setEvents(d?.events ?? []); setReferees(d?.referees ?? []); })
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));
  }, [open, match]);

  // Head-to-head history across seasons (slow first time per pair, then cached).
  useEffect(() => {
    if (!open || !match) { setH2h(null); return; }
    setH2h(null);
    setH2hLoading(true);
    fetch(
      `${API_URL}/api/v1/h2h?division=${match.division}&a=${encodeURIComponent(match.home)}&b=${encodeURIComponent(match.away)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setH2h(d))
      .catch(() => setH2h(null))
      .finally(() => setH2hLoading(false));
  }, [open, match]);

  // 1/X/2 model prediction — only for upcoming PRIMERA fixtures (the projection
  // covers the top flight). Pulls the pre-computed odds for this exact pairing.
  useEffect(() => {
    setOdds(null);
    if (!open || !match || match.status !== "UPCOMING" || match.division !== "PRIMERA") return;
    const { home, away } = match;
    fetch(`${API_URL}/api/v1/predict/season`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const m = d?.matches?.find((x: { home: string; away: string }) => x.home === home && x.away === away);
        if (m) setOdds({ homeWinPct: m.homeWinPct, drawPct: m.drawPct, awayWinPct: m.awayWinPct, expHome: m.expHome, expAway: m.expAway });
      })
      .catch(() => setOdds(null));
  }, [open, match]);

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
  const hasForm = (homeForm?.length ?? 0) > 0 || (awayForm?.length ?? 0) > 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="bg-background border-t border-border text-foreground rounded-t-2xl max-h-[90vh] overflow-y-auto">
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
                <span className="text-muted-foreground/70 text-xl">–</span>
                <span className="text-3xl font-black tabular-nums">{match.awayScore}</span>
              </div>
            ) : (
              <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">VS</span>
            )}
            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">
              {finished ? "Final" : "Próximo"}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5 flex-1">
            <ClubLogo team={match.away} />
            <span className="text-sm font-bold text-center leading-tight">{match.away}</span>
          </div>
        </div>

        {/* Match details */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-5 text-xs text-muted-foreground">
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

        {/* Referees */}
        {referees.length > 0 && (
          <div className="mb-5 flex items-start gap-2 text-xs">
            <Flag className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-foreground/80 font-semibold">{referees[0]}</span>
              <span className="text-muted-foreground/70"> · Árbitro</span>
              {referees.length > 1 && (
                <p className="text-muted-foreground/70 mt-0.5">Asistentes: {referees.slice(1).join(", ")}</p>
              )}
            </div>
          </div>
        )}

        {/* Pronóstico 1/X/2 (modelo) — próximos partidos de Primera */}
        {odds && (
          <div className="mb-5 rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pronóstico del modelo</span>
              <span className="text-[10px] text-muted-foreground/70 tabular-nums">· {Math.round(odds.expHome)}–{Math.round(odds.expAway)}</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-secondary">
              <div className="bg-emerald-500" style={{ width: `${Math.max(0, odds.homeWinPct)}%` }} />
              <div className="bg-amber-400/70" style={{ width: `${Math.max(0, odds.drawPct)}%` }} />
              <div className="bg-sky-500" style={{ width: `${Math.max(0, odds.awayWinPct)}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs tabular-nums">
              <span className={`flex items-center gap-1.5 ${odds.homeWinPct >= odds.awayWinPct ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />{match.home} {Math.round(odds.homeWinPct)}%
              </span>
              <span className="text-muted-foreground">X {Math.round(odds.drawPct)}%</span>
              <span className={`flex items-center gap-1.5 ${odds.awayWinPct > odds.homeWinPct ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                {match.away} {Math.round(odds.awayWinPct)}%<span className="w-2 h-2 rounded-sm bg-sky-500 inline-block" />
              </span>
            </div>
          </div>
        )}

        {/* Form + head-to-head */}
        {hasForm && (
          <div className="mb-5 rounded-xl border border-border bg-card/40 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate max-w-full">{match.home}</span>
                <FormPills form={homeForm} />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate max-w-full">{match.away}</span>
                <FormPills form={awayForm} />
              </div>
            </div>

            <div className="border-t border-border mt-3 pt-3">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <Swords className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Historial</span>
              </div>
              {h2hLoading ? (
                <p className="text-xs text-muted-foreground/70 text-center py-1">Cargando historial…</p>
              ) : h2h && h2h.meetings.length > 0 ? (
                <>
                  {/* Overall record (match.home perspective = teamA) */}
                  <div className="flex items-center justify-center gap-3 mb-3 text-xs">
                    <span className="font-semibold text-foreground/80">{match.home}</span>
                    <span className="font-black tabular-nums text-foreground text-sm">{h2h.aWins}-{h2h.bWins}</span>
                    <span className="font-semibold text-foreground/80">{match.away}</span>
                    {h2h.draws > 0 && <span className="text-muted-foreground/70">· {h2h.draws}E</span>}
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {h2h.meetings.map((m, i) => (
                      <div key={i} className="flex items-center justify-center gap-2 text-xs">
                        <span className="text-muted-foreground/70 font-mono text-[10px] w-8 text-right">{m.date ? m.date.slice(0, 4) : m.year}</span>
                        <span className="text-muted-foreground truncate max-w-[80px] text-right flex-1">{m.homeTeam}</span>
                        <span className="font-black tabular-nums text-foreground">{m.homeScore}-{m.awayScore}</span>
                        <span className="text-muted-foreground truncate max-w-[80px] flex-1">{m.awayTeam}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground/70 text-center">Sin enfrentamientos previos registrados</p>
              )}
            </div>
          </div>
        )}

        {/* Lineups */}
        {!finished && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Formaciones</h3>
            </div>

            {loading ? (
              <div className="text-center py-6 text-muted-foreground/70 text-sm">Cargando formaciones…</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{match.home}</p>
                    <LineupColumn
                      team={match.home}
                      starters={lineup?.homeStarters ?? null}
                      subs={lineup?.homeSubs ?? null}
                      images={lineup?.homeImages}
                      sourceUrl={lineup?.homeSourceUrl}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{match.away}</p>
                    <LineupColumn
                      team={match.away}
                      starters={lineup?.awayStarters ?? null}
                      subs={lineup?.awaySubs ?? null}
                      images={lineup?.awayImages}
                      sourceUrl={lineup?.awaySourceUrl}
                    />
                  </div>
                </div>
                {lineup?.crawledAt ? (
                  <p className="text-[10px] text-muted-foreground/50 text-center mt-3">
                    Actualizado {new Date(lineup.crawledAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                ) : null}
              </>
            )}
          </>
        )}

        {/* Minute-by-minute (finished matches) */}
        {finished && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Minuto a minuto</h3>
            </div>
            {eventsLoading ? (
              <div className="text-center py-6 text-muted-foreground/70 text-sm">Cargando cronología…</div>
            ) : orderedEvents.length > 0 ? (
              <div className="space-y-0.5 mb-2">
                {orderedEvents.map((ev, i) => {
                  const prev = orderedEvents[i - 1];
                  const showHt = ev.half === 2 && (!prev || prev.half === 1);
                  const isCard = ev.type === "YELLOW_CARD" || ev.type === "RED_CARD";
                  return (
                    <div key={i}>
                      {showHt && (
                        <div className="flex items-center gap-2 my-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          <div className="flex-1 h-px bg-muted" />
                          <span>Medio tiempo{htScore ? ` · ${htScore.home}-${htScore.away}` : ""}</span>
                          <div className="flex-1 h-px bg-muted" />
                        </div>
                      )}
                      <div className={`flex items-center gap-2.5 py-1.5 ${ev.team === "away" ? "flex-row-reverse text-right" : ""}`}>
                        <span className="font-mono text-[11px] text-muted-foreground/70 w-7 flex-shrink-0 text-center">{ev.minute}&apos;</span>
                        {!isCard && (
                          <span className="text-[11px] font-black tabular-nums text-foreground w-10 flex-shrink-0 text-center">
                            {ev.homeScore}-{ev.awayScore}
                          </span>
                        )}
                        <span className={`text-xs font-bold ${EVENT_COLORS[ev.type] ?? "text-foreground/80"}`}>
                          {EVENT_LABELS[ev.type] ?? ev.type}
                        </span>
                        {ev.playerName && <span className="text-muted-foreground text-xs truncate">{ev.playerName}</span>}
                      </div>
                    </div>
                  );
                })}

                {/* Full time */}
                <div className="flex items-center gap-2 mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <div className="flex-1 h-px bg-secondary" />
                  <span className="inline-flex items-center gap-1.5">
                    <Flag className="h-3 w-3" />
                    Fin del partido
                    <span className="text-foreground tabular-nums">· {match.homeScore ?? orderedEvents[orderedEvents.length - 1]?.homeScore}-{match.awayScore ?? orderedEvents[orderedEvents.length - 1]?.awayScore}</span>
                  </span>
                  <div className="flex-1 h-px bg-secondary" />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/70 text-center py-4">Cronología no disponible para este partido.</p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
