"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trophy, Clock, Wallet, Search, X, AlertCircle, Flame, Home, Plane, History, Shuffle, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { ClubLogo } from "@/components/club-logo";
import {
  fetchState, fetchMarket, saveSquad, money,
  type Division, type FantasyState, type MarketPlayer, type FantasyRules, type RoundFixture, type GwHistory,
  type UpcomingFixture, type RecentScore,
} from "@/lib/fantasy-api";
import { FORMATION, POSITION_SHORT, POSITION_LABELS, getPositionInfo, playsPosition, type FormationSlot, type Position, type FantasyPlayer } from "@/lib/fantasy";
import { FANTASY_LIVE, FantasyComingSoon } from "@/lib/fantasy-flags";

const DIVISIONS: { key: Division; label: string }[] = [
  { key: "primera", label: "Primera" },
  { key: "intermedia", label: "Intermedia" },
  { key: "pre-intermedia", label: "Pre-Inter" },
];

// Jugador de mercado + su posición (de PLAYER_POSITIONS). Solo los mapeados
// pueden llenar un puesto del XV; el super sub puede ser cualquiera.
type PP = MarketPlayer & { primary?: Position; secondary?: Position };

function toFantasyPlayer(p: PP): FantasyPlayer {
  return {
    id: p.arusaId, name: p.name, clubSlug: p.teamSlug, clubName: p.team, price: p.price / 10,
    position: p.primary ?? "PROP", secondary: p.secondary, division: "primera",
    stats: { tries: 0, conversions: 0, penalties: 0, drops: 0, points: p.points, matches: p.matches, mvp: 0 },
  };
}

export default function FantasyTeamPage() {
  if (!FANTASY_LIVE) return <FantasyComingSoon />;
  return <Inner />;
}

function Inner() {
  const [division, setDivision] = useState<Division>("primera");
  const [market, setMarket] = useState<PP[]>([]);
  const [rules, setRules] = useState<FantasyRules | null>(null);
  const [fixtures, setFixtures] = useState<Record<string, RoundFixture>>({});
  const [upcoming, setUpcoming] = useState<Record<string, UpcomingFixture[]>>({});
  const [ownership, setOwnership] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<Record<string, RecentScore[]>>({});
  const [detail, setDetail] = useState<{ slotId: string; arusaId: string } | null>(null);
  const [state, setState] = useState<FantasyState | null>(null);
  const [loading, setLoading] = useState(true);

  // asignaciones: slotId → arusaId ; super sub aparte
  const [assign, setAssign] = useState<Record<string, string | null>>({});
  const [superSub, setSuperSub] = useState<string | null>(null);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("Mi Equipo");
  const [picker, setPicker] = useState<{ slotId: string; position: Position } | "supersub" | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Revisión de fechas pasadas: null = editando la fecha actual; nº = viendo esa fecha.
  const [viewRound, setViewRound] = useState<number | null>(null);

  const byId = useMemo(() => new Map(market.map((p) => [p.arusaId, p])), [market]);

  const history = state?.history ?? [];
  const curRound = state?.gameweek?.round ?? 1;
  const shownRound = viewRound ?? curRound;
  const activeH = history.find((h) => h.round === shownRound) ?? null;
  const reviewing = activeH != null;                 // fecha pasada con puntos → vista de solo lectura
  const canEdit = shownRound === curRound && !state?.gameweek?.locked;

  // Fechas navegables: la actual + las próximas (upcoming) + las que tengan historial.
  const allRounds = useMemo(() => {
    const set = new Set<number>([curRound]);
    for (const arr of Object.values(upcoming)) for (const u of arr) set.add(u.round);
    for (const h of history) set.add(h.round);
    return [...set].sort((a, b) => a - b);
  }, [upcoming, history, curRound]);

  // Rival de un club en la fecha que se está mostrando (actual o una próxima).
  const fixtureOf = (slug: string): RoundFixture | undefined => {
    if (shownRound === curRound) return fixtures[slug];
    const u = upcoming[slug]?.find((x) => x.round === shownRound);
    return u ? { opp: "", oppShort: u.oppShort, oppName: u.oppName, home: u.home } : undefined;
  };

  // Sienta los 15 titulares de una fecha pasada en los slots del XV por posición.
  const reviewAssign = useMemo(() => {
    const seated: Record<string, string | null> = Object.fromEntries(FORMATION.map((s) => [s.id, null]));
    if (!activeH) return seated;
    const infoById = new Map(market.map((m) => [m.arusaId, m]));
    const taken = new Set<string>();
    for (const slot of FORMATION) {
      const id = activeH.starters.find((r) => !taken.has(r) && infoById.get(r)?.primary === slot.position)
        ?? activeH.starters.find((r) => !taken.has(r) && infoById.get(r)?.secondary === slot.position);
      if (id) { seated[slot.id] = id; taken.add(id); }
    }
    const rest = activeH.starters.filter((r) => !taken.has(r));
    for (const slot of FORMATION) { if (!seated[slot.id] && rest.length) { const id = rest.shift()!; seated[slot.id] = id; taken.add(id); } }
    return seated;
  }, [activeH, market]);

  async function load(div: Division) {
    setLoading(true); setMsg(null);
    try {
      const [mkt, st] = await Promise.all([fetchMarket(div), fetchState(div).catch(() => null)]);
      const merged: PP[] = mkt.players.map((p) => { const info = getPositionInfo(p.arusaId); return { ...p, primary: info?.primary, secondary: info?.secondary }; });
      setMarket(merged); setRules(mkt.rules); setFixtures(mkt.fixtures ?? {});
      setUpcoming(mkt.upcoming ?? {}); setOwnership(mkt.ownership ?? {}); setRecent(mkt.recent ?? {});
      setState(st);
      if (st?.squad && st.roster) {
        // sembrar asignaciones desde el roster (primeros 15 al XV por posición, el 16° super sub)
        setTeamName(st.squad.teamName);
        setCaptainId(st.currentLineup?.captainId ?? st.squad.captainId);
        const rosterIds = st.roster.map((r) => r.arusaId);
        const infoById = new Map(merged.map((m) => [m.arusaId, m]));
        const seated: Record<string, string | null> = Object.fromEntries(FORMATION.map((s) => [s.id, null]));
        const taken = new Set<string>();
        for (const slot of FORMATION) {
          const id = rosterIds.find((r) => !taken.has(r) && infoById.get(r)?.primary === slot.position)
            ?? rosterIds.find((r) => !taken.has(r) && infoById.get(r)?.secondary === slot.position);
          if (id) { seated[slot.id] = id; taken.add(id); }
        }
        // llenar slots vacíos con los que queden (por orden)
        const rest = rosterIds.filter((r) => !taken.has(r));
        for (const slot of FORMATION) { if (!seated[slot.id] && rest.length) { const id = rest.shift()!; seated[slot.id] = id; taken.add(id); } }
        setAssign(seated);
        setSuperSub(rest[0] ?? rosterIds.find((r) => !taken.has(r)) ?? null);
      } else {
        setAssign(Object.fromEntries(FORMATION.map((s) => [s.id, null])));
        setSuperSub(null);
      }
    } catch { /* mercado igual carga arriba */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(division); /* eslint-disable-next-line */ }, [division]);

  const chosenIds = [...Object.values(assign).filter(Boolean) as string[], ...(superSub ? [superSub] : [])];
  const cost = chosenIds.reduce((s, id) => s + (byId.get(id)?.price ?? 0), 0);
  const budget = rules?.BUDGET ?? 1000;
  const remaining = budget - cost;
  const filledSlots = Object.values(assign).filter(Boolean).length;
  const complete = filledSlots === 15; // el super sub es OPCIONAL

  function clubCount(slug: string, exclude?: string) {
    return chosenIds.filter((id) => id !== exclude && byId.get(id)?.teamSlug === slug).length;
  }

  function assignPlayer(id: string) {
    const p = byId.get(id); if (!p || !picker) return;
    if (chosenIds.includes(id)) { setMsg("Ese jugador ya está en tu equipo"); return; }
    if (clubCount(p.teamSlug) >= (rules?.MAX_PER_CLUB ?? 3)) { setMsg(`Máximo ${rules?.MAX_PER_CLUB ?? 3} por club`); return; }
    if (picker === "supersub") {
      if (remaining - p.price < 0 && !superSub) { setMsg("Te pasas del presupuesto"); return; }
      setSuperSub(id);
    } else {
      const prev = assign[picker.slotId];
      const prevPrice = prev ? byId.get(prev)?.price ?? 0 : 0;
      if (remaining + prevPrice - p.price < 0) { setMsg("Te pasas del presupuesto"); return; }
      setAssign((a) => ({ ...a, [picker.slotId]: id }));
    }
    setPicker(null); setQ(""); setMsg(null);
  }

  function clearTeam() {
    setAssign(Object.fromEntries(FORMATION.map((s) => [s.id, null])));
    setSuperSub(null); setCaptainId(null); setMsg(null);
  }

  // Arma un XV VÁLIDO al azar: cada puesto con un jugador que lo juega, ≤3 por
  // club y dentro del presupuesto (deja al menos el mínimo para los slots que
  // faltan). Capitán = el titular de mayor valor.
  function randomTeam() {
    const MIN = 40; // precio mínimo aprox. (4.0M)
    const budget = rules?.BUDGET ?? 1000;
    const maxClub = rules?.MAX_PER_CLUB ?? 3;
    const pool = market.filter((p) => p.primary);
    const playsPos = (p: PP, pos: Position) => p.primary === pos || p.secondary === pos;
    const eligible = (pos: Position) => pool.filter((p) => playsPos(p, pos)).length;
    const ordered = [...FORMATION].sort((a, b) => eligible(a.position) - eligible(b.position));

    for (let attempt = 0; attempt < 150; attempt++) {
      const seated: Record<string, string | null> = Object.fromEntries(FORMATION.map((s) => [s.id, null]));
      const used = new Set<string>();
      const clubN: Record<string, number> = {};
      let spent = 0; let ok = true;
      for (let i = 0; i < ordered.length; i++) {
        const slot = ordered[i];
        const remain = ordered.length - i - 1;
        const maxThis = budget - spent - remain * MIN;
        const cands = pool.filter((p) =>
          !used.has(p.arusaId) && playsPos(p, slot.position) &&
          (clubN[p.teamSlug] ?? 0) < maxClub && p.price <= maxThis + 1e-9);
        if (cands.length === 0) { ok = false; break; }
        const pick = cands[Math.floor(Math.random() * cands.length)];
        seated[slot.id] = pick.arusaId; used.add(pick.arusaId);
        clubN[pick.teamSlug] = (clubN[pick.teamSlug] ?? 0) + 1; spent += pick.price;
      }
      if (ok) {
        const starters = FORMATION.map((s) => seated[s.id]!).filter(Boolean);
        const cap = starters.slice().sort((a, b) => (byId.get(b)?.points ?? 0) - (byId.get(a)?.points ?? 0))[0] ?? null;
        setAssign(seated); setSuperSub(null); setCaptainId(cap); setMsg(null);
        return;
      }
    }
    setMsg("No pude armar un equipo al azar, prueba de nuevo");
  }

  async function submit() {
    if (!complete) { setMsg("Completa los 15 puestos del XV (el super sub es opcional)"); return; }
    setSaving(true); setMsg(null);
    try {
      const starters = FORMATION.map((s) => assign[s.id]!).filter(Boolean);
      const all = superSub ? [...starters, superSub] : starters;
      await saveSquad({
        division, teamName,
        playerIds: all.map((id) => { const p = byId.get(id)!; return { arusaId: id, clubSlug: p.teamSlug, playerName: p.name, purchasePrice: p.price }; }),
        captainId: captainId ?? starters[0], viceCaptainId: starters[1],
      });
      await load(division);
      setMsg("¡Equipo guardado!");
    } catch (e) { setMsg((e as Error).message); } finally { setSaving(false); }
  }

  const gw = state?.gameweek;
  const countdown = useCountdown(gw?.deadline ?? null);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-5">
          <div className="flex items-center gap-2 mb-1"><Trophy className="h-5 w-5 text-emerald-500" /><h1 className="text-xl font-black tracking-tight">FANTASY TOP 10</h1></div>
          <p className="text-muted-foreground text-xs">Tu XV por posición + un super sub · Capitán ×2</p>
          <div className="flex items-center gap-1 mt-3 p-1 rounded-xl border border-border bg-card w-fit">
            {DIVISIONS.map((d) => (
              <button key={d.key} onClick={() => setDivision(d.key)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${division === d.key ? "bg-emerald-600 text-white" : "text-muted-foreground hover:text-foreground"}`}>{d.label}</button>
            ))}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-5 max-w-2xl">
        {loading && <div className="rounded-xl border border-border p-10 text-center text-muted-foreground animate-pulse">Cargando fantasy…</div>}

        {!loading && rules && (
          <>
            {/* barra presupuesto / estado */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" />Libre</p><p className={`text-lg font-black tabular-nums ${remaining < 0 ? "text-red-500" : "text-emerald-400"}`}>{money(remaining)}</p></div>
              <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] uppercase text-muted-foreground">Jugadores</p><p className="text-lg font-black tabular-nums">{filledSlots + (superSub ? 1 : 0)}/16</p></div>
              <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Fecha {gw?.round ?? "—"}</p><p className={`text-sm font-bold ${gw?.locked ? "text-red-500" : "text-emerald-400"}`}>{gw?.locked ? "En juego" : countdown || "—"}</p></div>
            </div>

            {msg && <p className="text-xs text-amber-500 flex items-center gap-1 mb-3"><AlertCircle className="h-3.5 w-3.5" />{msg}</p>}

            {/* Banner cuando mirás una fecha que no es la actual */}
            {shownRound !== curRound && (
              <div className="flex items-center justify-between gap-2 mb-3 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2">
                <span className="text-xs font-semibold text-orange-300">
                  {reviewing && activeH
                    ? <>Fecha {shownRound} jugada · <b className="tabular-nums">{activeH.points}</b> pts</>
                    : <>Fecha {shownRound} · próxima (mirando el fixture)</>}
                </span>
                <button onClick={() => setViewRound(null)} className="text-xs font-bold text-orange-200 hover:text-white underline whitespace-nowrap">Fecha {curRound} →</button>
              </div>
            )}

            {/* acciones rápidas */}
            {canEdit && (
              <div className="flex gap-2 mb-3">
                <button onClick={randomTeam} className="flex-1 py-2 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted/40 transition-colors flex items-center justify-center gap-1.5">
                  <Shuffle className="h-4 w-4 text-emerald-500" />Aleatorio
                </button>
                <button onClick={clearTeam} className="flex-1 py-2 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted/40 transition-colors flex items-center justify-center gap-1.5">
                  <Trash2 className="h-4 w-4 text-red-500" />Vaciar
                </button>
              </div>
            )}

            {/* cancha XV */}
            <Pitch assign={reviewing ? reviewAssign : assign} byId={byId} captainId={captainId} fixtureOf={fixtureOf}
              review={activeH} rounds={allRounds} shownRound={shownRound}
              onSelectRound={(r) => { setViewRound(r); setMsg(null); }}
              onSlot={(slot) => {
                if (!canEdit) return;
                const id = assign[slot.id];
                if (id) setDetail({ slotId: slot.id, arusaId: id });
                else setPicker({ slotId: slot.id, position: slot.position });
              }}
              onCaptain={(id) => { if (canEdit) { setCaptainId(id); setMsg(null); } }} />

            {/* super sub + capitán */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <SlotCard label="Super Sub" icon={<Flame className="h-3.5 w-3.5 text-orange-400" />}
                id={reviewing ? (activeH?.superSubId ?? null) : superSub} byId={byId}
                onClick={() => { if (canEdit) setPicker("supersub"); }} accent="orange"
                onClear={canEdit && superSub ? () => { setSuperSub(null); setMsg(null); } : undefined}
                points={reviewing && activeH ? subContribution(activeH) : undefined} />
              <SlotCard label="Capitán ×2" icon={<span className="text-yellow-400 font-black text-xs">C</span>}
                id={reviewing ? (activeH?.captainUsedId ?? null) : captainId} byId={byId}
                onClick={() => { if (canEdit) setMsg("Toca la C de un titular en la cancha"); }} accent="yellow"
                points={reviewing && activeH?.captainUsedId ? (activeH.scores[activeH.captainUsedId]?.points ?? 0) * 2 : undefined} />
            </div>

            {/* guardar (solo editando la fecha actual) */}
            {canEdit && (
              <div className="mt-4 flex items-center gap-2">
                <input value={teamName} onChange={(e) => setTeamName(e.target.value)} className="flex-1 bg-card border border-border rounded-lg px-3 py-2.5 text-sm outline-none" placeholder="Nombre del equipo" />
                <button onClick={submit} disabled={saving || !complete || remaining < 0}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-sm disabled:opacity-40">{saving ? "Guardando…" : "Guardar"}</button>
              </div>
            )}
            {/* Tu campaña: cómo te fue fecha a fecha */}
            {state?.squad && (state.perGw?.length ?? 0) > 0 && (
              <div className="mt-4 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><History className="h-3.5 w-3.5" />Tu campaña</h3>
                  <span className="text-sm"><b className="text-emerald-400 text-lg tabular-nums">{state.overallPoints ?? 0}</b> <span className="text-muted-foreground text-xs">pts totales</span></span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {state.perGw!.map((g) => {
                    const active = viewRound === g.round;
                    return (
                      <button key={g.round} onClick={() => setViewRound(active ? null : g.round)}
                        className={`flex-none rounded-lg border px-3 py-2 text-center min-w-[68px] transition-colors ${active ? "border-orange-500 bg-orange-500/15" : "border-border bg-muted/30 hover:border-orange-500/50"}`}>
                        <p className={`text-[10px] uppercase tracking-wide ${active ? "text-orange-300" : "text-muted-foreground"}`}>{g.round === 0 ? "Total" : `Fecha ${g.round}`}</p>
                        <p className="text-xl font-black tabular-nums">{g.points}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Toca una fecha para revivir cómo quedó tu equipo.</p>
              </div>
            )}

            {state?.squad && <div className="mt-3 text-center"><Link href="/fantasy/leaderboard" className="text-xs text-emerald-400 hover:underline">Ver ranking →</Link></div>}
          </>
        )}
      </div>

      {detail && byId.get(detail.arusaId) && (() => {
        const slot = FORMATION.find((s) => s.id === detail.slotId)!;
        const p = byId.get(detail.arusaId)!;
        return (
          <PlayerDetailModal
            p={p}
            positionLabel={p.primary ? POSITION_LABELS[p.primary] : slot.position}
            ownership={ownership[detail.arusaId] ?? 0}
            recent={recent[detail.arusaId] ?? []}
            upcoming={upcoming[p.teamSlug] ?? []}
            isCaptain={captainId === detail.arusaId}
            onClose={() => setDetail(null)}
            onReplace={() => { setPicker({ slotId: detail.slotId, position: slot.position }); setDetail(null); }}
            onRemove={() => {
              setAssign((a) => ({ ...a, [detail.slotId]: null }));
              if (captainId === detail.arusaId) setCaptainId(null);
              setDetail(null); setMsg(null);
            }}
            onCaptain={() => { setCaptainId(detail.arusaId); setDetail(null); setMsg(null); }}
          />
        );
      })()}

      {picker && rules && (
        <PickerModal
          market={market} byId={byId} picker={picker} q={q} setQ={setQ} onPick={assignPlayer} fixtures={fixtures}
          onClose={() => { setPicker(null); setQ(""); }} chosenIds={chosenIds} clubCount={clubCount} maxClub={rules.MAX_PER_CLUB}
          avail={picker !== "supersub" && assign[picker.slotId] ? remaining + (byId.get(assign[picker.slotId]!)?.price ?? 0) : remaining}
        />
      )}
    </div>
  );
}

// Primer apellido (paterno) para la etiqueta de la cancha. En un nombre chileno
// "Nombre(s) Paterno Materno" el paterno es la penúltima palabra; si solo hay
// nombre+apellido, es la última. Normaliza los que vienen EN MAYÚSCULAS.
function firstSurname(name: string): string {
  const parts = name.trim().split(/\s+/);
  let s = parts.length <= 1 ? (parts[0] ?? "") : parts.length === 2 ? parts[1] : parts[parts.length - 2];
  if (s && s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|[-\s])\p{L}/gu, (c) => c.toUpperCase());
  return s;
}

// Píldora del próximo rival (vs OJ / @ OJ) para elegir según el fixture.
function Opp({ fx, tone = "muted" }: { fx?: RoundFixture; tone?: "muted" | "pitch" }) {
  if (!fx) return null;
  const cls = tone === "pitch" ? "text-emerald-100/75" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-0.5 ${cls}`} title={`${fx.home ? "Local vs" : "Visita a"} ${fx.oppName}`}>
      {fx.home ? <Home className="h-2.5 w-2.5" /> : <Plane className="h-2.5 w-2.5" />}
      <span className="font-bold">{fx.oppShort}</span>
    </span>
  );
}

// Puntos que aportó el super sub en una fecha (×2 si entró de suplente, ÷2 si fue
// titular, 0 si no jugó).
function subContribution(h: GwHistory): number {
  if (!h.superSubId) return 0;
  const s = h.scores[h.superSubId];
  if (!s || !s.played) return 0;
  return Math.round(s.points * (s.wasSub ? 2 : 0.5));
}

// ── Cancha XV ────────────────────────────────────────────────────────────────
function Pitch({ assign, byId, captainId, fixtureOf, review, rounds, shownRound, onSelectRound, onSlot, onCaptain }: {
  assign: Record<string, string | null>; byId: Map<string, PP>; captainId: string | null;
  fixtureOf: (slug: string) => RoundFixture | undefined;
  review: GwHistory | null; rounds: number[]; shownRound: number;
  onSelectRound: (r: number) => void;
  onSlot: (slot: FormationSlot) => void; onCaptain: (id: string) => void;
}) {
  const capId = review ? review.captainUsedId : captainId;
  const idx = rounds.indexOf(shownRound);
  const canPrev = idx > 0;
  const canNext = idx >= 0 && idx < rounds.length - 1;
  return (
    <div className="relative rounded-2xl overflow-hidden border border-emerald-900/50"
      style={{ aspectRatio: "3 / 3.5", background: "linear-gradient(180deg,#0d5c2f 0%,#0a4d28 50%,#083d20 100%)" }}>
      {/* líneas */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute inset-x-[5%] top-[2.5%] bottom-[2.5%] border border-white/30 rounded" />
        <div className="absolute left-[5%] right-[5%] top-[22%] border-t border-white/25" />
        <div className="absolute left-[5%] right-[5%] top-1/2 border-t border-dashed border-white/30" />
        <div className="absolute left-[5%] right-[5%] bottom-[22%] border-t border-white/25" />
      </div>

      {/* Selector de fecha: ‹ Fecha N › arriba del fullback, naranjo. */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-black/35 rounded-full pl-1 pr-1 py-0.5 border border-orange-400/50">
        <button disabled={!canPrev} onClick={() => canPrev && onSelectRound(rounds[idx - 1])} aria-label="Fecha anterior"
          className="w-6 h-6 flex items-center justify-center text-orange-300 hover:text-white disabled:opacity-25"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-xs font-black text-orange-200 tabular-nums px-1 whitespace-nowrap">Fecha {shownRound}</span>
        <button disabled={!canNext} onClick={() => canNext && onSelectRound(rounds[idx + 1])} aria-label="Fecha siguiente"
          className="w-6 h-6 flex items-center justify-center text-orange-300 hover:text-white disabled:opacity-25"><ChevronRight className="h-4 w-4" /></button>
      </div>

      {FORMATION.map((slot) => {
        const id = assign[slot.id];
        const p = id ? byId.get(id) : null;
        const sc = review && id ? review.scores[id] : null;
        const isCap = capId === id;
        return (
          <div key={slot.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
            {p ? (
              <div className="relative flex flex-col items-center w-[58px]">
                {isCap && <span className="absolute -top-1 -right-1 bg-yellow-400 text-black rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black z-10">C</span>}
                <button onClick={() => onSlot(slot)} disabled={!!review} className="flex flex-col items-center">
                  <ClubLogo noLink team={p.team} className="w-8 h-8 rounded-full ring-2 ring-white/20" />
                  <span className="text-[9px] font-bold text-white text-center leading-none mt-0.5 truncate w-[58px]">{firstSurname(p.name)}</span>
                  {review ? (
                    <span className={`text-[9px] font-black tabular-nums leading-tight ${sc?.played ? "text-emerald-300" : "text-white/40"}`}>
                      {sc?.played ? `${isCap ? (sc.points * 2) : sc.points} pts` : "no jugó"}
                    </span>
                  ) : (
                    <>
                      <span className="text-[8px] text-emerald-200/90 tabular-nums leading-tight">{money(p.price)}</span>
                      <span className="text-[8px] leading-tight"><Opp fx={fixtureOf(p.teamSlug)} tone="pitch" /></span>
                    </>
                  )}
                </button>
                {!review && (
                  <button onClick={() => onCaptain(id!)} className={`mt-0.5 w-4 h-3.5 rounded text-[8px] font-black leading-none ${isCap ? "bg-yellow-400 text-black" : "bg-white/20 text-white/80"}`}>C</button>
                )}
              </div>
            ) : (
              <button onClick={() => onSlot(slot)} disabled={!!review} className="flex flex-col items-center justify-center w-[52px] h-[52px] rounded-full border-2 border-dashed border-white/40 text-white/70 hover:border-white/70 disabled:opacity-30">
                <span className="text-lg leading-none">+</span>
                <span className="text-[8px] font-bold">{POSITION_SHORT[slot.position]}</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SlotCard({ label, icon, id, byId, onClick, accent, points, onClear }: {
  label: string; icon: React.ReactNode; id: string | null; byId: Map<string, PP>; onClick: () => void; accent: "orange" | "yellow";
  points?: number; onClear?: () => void;
}) {
  const p = id ? byId.get(id) : null;
  return (
    <div className={`relative rounded-xl border ${accent === "orange" ? "border-orange-500/40 bg-orange-500/5" : "border-yellow-500/40 bg-yellow-500/5"}`}>
      <button onClick={onClick} className="w-full p-3 text-left flex items-center gap-3">
        {p ? <ClubLogo noLink team={p.team} className="w-9 h-9 rounded-full flex-shrink-0" /> : <div className="w-9 h-9 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground">+</div>}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon}{label}</p>
          <p className="text-sm font-semibold truncate pr-6">{p ? p.name : "Elegir"}</p>
          {p && (points != null
            ? <p className="text-[10px] font-bold text-emerald-400 tabular-nums">+{points} pts</p>
            : <p className="text-[10px] text-muted-foreground">{money(p.price)}</p>)}
        </div>
      </button>
      {p && onClear && (
        <button onClick={onClear} title="Quitar" aria-label="Quitar"
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/20 hover:bg-red-500/70 text-white/70 hover:text-white flex items-center justify-center">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ── Detalle del jugador ──────────────────────────────────────────────────────
function PlayerDetailModal({ p, positionLabel, ownership, recent, upcoming, isCaptain, onClose, onReplace, onRemove, onCaptain }: {
  p: PP; positionLabel: string; ownership: number; recent: RecentScore[]; upcoming: UpcomingFixture[];
  isCaptain: boolean; onClose: () => void; onReplace: () => void; onRemove: () => void; onCaptain: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const played = recent.filter((r) => r.played);
  const last3 = played.slice(-3);
  const form = last3.length ? (last3.reduce((s, r) => s + r.points, 0) / last3.length) : null;
  const lastGw = recent.length ? recent[recent.length - 1] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <ClubLogo noLink team={p.team} className="w-11 h-11 rounded-full flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-bold truncate flex items-center gap-1.5">{p.name}{isCaptain && <span className="bg-yellow-400 text-black rounded px-1 text-[9px] font-black">C</span>}</p>
            <p className="text-xs text-muted-foreground">{positionLabel} · {p.team}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-black tabular-nums leading-none">{money(p.price)}</p>
            <p className="text-[10px] text-muted-foreground">precio</p>
          </div>
          <button onClick={onClose} className="ml-1"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {/* stats principales */}
          <div className="grid grid-cols-3 gap-2">
            <Stat k="Puntos" v={`${p.points}`} sub="temporada" />
            <Stat k="Forma" v={form != null ? form.toFixed(1) : "—"} sub="prom. últ. 3" />
            <Stat k="Selección" v={`${ownership}%`} sub="lo tienen" />
          </div>

          {/* puntos por fecha */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Puntos por fecha</p>
            {recent.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin fechas jugadas aún.</p>
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {recent.map((r) => (
                  <div key={r.round} className="flex flex-col items-center rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 min-w-[46px]">
                    <span className="text-[9px] uppercase text-muted-foreground">F{r.round}</span>
                    <span className={`text-sm font-black tabular-nums ${r.played ? "" : "text-muted-foreground/50"}`}>{r.played ? r.points : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* última fecha + próximas 3 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Última fecha</p>
              {lastGw ? (
                <p className="text-2xl font-black tabular-nums">{lastGw.played ? `${lastGw.points}` : "—"}<span className="text-xs font-normal text-muted-foreground ml-1">{lastGw.played ? "pts" : "no jugó"}</span></p>
              ) : <p className="text-sm text-muted-foreground">—</p>}
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Próximas</p>
              {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
                <div className="flex gap-2 justify-around">
                  {upcoming.map((u) => (
                    <div key={u.round} title={`Fecha ${u.round} · ${u.home ? "Local vs" : "Visita a"} ${u.oppName}`}
                      className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-bold text-muted-foreground">F{u.round}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/clubs/${u.opp}.jpg`} alt="" className="w-7 h-7 rounded-full object-cover bg-white ring-1 ring-border"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
                      <span className="text-[10px] font-bold whitespace-nowrap">{u.oppShort} <span className="text-muted-foreground font-normal">({u.home ? "L" : "V"})</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* acciones */}
        <div className="p-3 border-t border-border grid grid-cols-3 gap-2">
          <button onClick={onCaptain} disabled={isCaptain}
            className="py-2.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-500 font-bold text-sm disabled:opacity-40">Capitán</button>
          <button onClick={onReplace} className="py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-sm">Reemplazar</button>
          <button onClick={onRemove} className="py-2.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-500 font-bold text-sm">Quitar</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
      <p className="text-lg font-black tabular-nums leading-tight">{v}</p>
      <p className="text-[9px] text-muted-foreground">{sub}</p>
    </div>
  );
}

// ── Picker modal (por posición) ──────────────────────────────────────────────
function PickerModal({ market, byId, picker, q, setQ, onPick, onClose, chosenIds, clubCount, maxClub, avail, fixtures }: {
  market: PP[]; byId: Map<string, PP>; picker: { slotId: string; position: Position } | "supersub";
  q: string; setQ: (s: string) => void; onPick: (id: string) => void; onClose: () => void;
  chosenIds: string[]; clubCount: (slug: string, exclude?: string) => number; maxClub: number; avail: number;
  fixtures: Record<string, RoundFixture>;
}) {
  const isSub = picker === "supersub";
  const position = isSub ? null : picker.position;

  // ESC cierra el modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return market
      .filter((p) => isSub ? true : (p.primary && playsPosition(toFantasyPlayer(p), position!)))
      .filter((p) => !chosenIds.includes(p.arusaId))
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.team.toLowerCase().includes(s))
      .sort((a, b) => b.price - a.price)
      .slice(0, 120);
  }, [market, q, position, isSub, chosenIds]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-bold">{isSub ? "Elige tu Super Sub" : `Elige ${position}`}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Disponible: <b className={`tabular-nums ${avail < 0 ? "text-red-500" : "text-emerald-400"}`}>{money(avail)}</b></p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="p-3 border-b border-border">
          <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="w-full pl-8 pr-3 py-2 rounded-lg bg-muted/50 text-sm outline-none" /></div>
        </div>
        <div className="overflow-y-auto p-2 space-y-1">
          {list.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sin jugadores para este puesto</p>}
          {list.map((p) => {
            const tooExpensive = p.price > avail + 0.001;
            const clubFull = clubCount(p.teamSlug) >= maxClub;
            const disabled = clubFull || tooExpensive;
            return (
              <button key={p.arusaId} disabled={disabled} onClick={() => onPick(p.arusaId)}
                className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left ${disabled ? "opacity-40" : "hover:bg-muted/40"}`}>
                <ClubLogo noLink team={p.team} className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
                    <span>{p.team}{p.primary ? ` · ${POSITION_SHORT[p.primary]}` : ""} · {p.points}pts</span>
                    {fixtures[p.teamSlug] && <><span className="opacity-40">·</span><Opp fx={fixtures[p.teamSlug]} /></>}
                    {clubFull ? <span className="text-amber-500">· club lleno</span> : tooExpensive ? <span className="text-red-500">· no alcanza</span> : null}
                  </p>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${tooExpensive ? "text-red-500" : ""}`}>{money(p.price)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function useCountdown(deadline: string | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  if (!deadline) return "";
  const ms = Date.parse(deadline) - now;
  if (ms <= 0) return "cerrada";
  const h = Math.floor(ms / 3_600_000); const d = Math.floor(h / 24); const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h % 24}h` : `${h}h ${m}m`;
}
