"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trophy, Clock, Wallet, Search, X, AlertCircle, Flame } from "lucide-react";
import { ClubLogo } from "@/components/club-logo";
import {
  fetchState, fetchMarket, saveSquad, money,
  type Division, type FantasyState, type MarketPlayer, type FantasyRules,
} from "@/lib/fantasy-api";
import { FORMATION, POSITION_SHORT, getPositionInfo, playsPosition, type FormationSlot, type Position, type FantasyPlayer } from "@/lib/fantasy";
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

  const byId = useMemo(() => new Map(market.map((p) => [p.arusaId, p])), [market]);

  async function load(div: Division) {
    setLoading(true); setMsg(null);
    try {
      const [mkt, st] = await Promise.all([fetchMarket(div), fetchState(div).catch(() => null)]);
      const merged: PP[] = mkt.players.map((p) => { const info = getPositionInfo(p.arusaId); return { ...p, primary: info?.primary, secondary: info?.secondary }; });
      setMarket(merged); setRules(mkt.rules);
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

            {/* cancha XV */}
            <Pitch assign={assign} byId={byId} captainId={captainId}
              onSlot={(slot) => !gw?.locked && setPicker({ slotId: slot.id, position: slot.position })}
              onCaptain={(id) => { if (!gw?.locked) { setCaptainId(id); setMsg(null); } }} />

            {/* super sub + capitán */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <SlotCard label="Super Sub" icon={<Flame className="h-3.5 w-3.5 text-orange-400" />} id={superSub} byId={byId}
                onClick={() => !gw?.locked && setPicker("supersub")} accent="orange" />
              <SlotCard label="Capitán ×2" icon={<span className="text-yellow-400 font-black text-xs">C</span>} id={captainId} byId={byId}
                onClick={() => setMsg("Toca la C de un titular en la cancha")} accent="yellow" />
            </div>

            {/* guardar */}
            {!gw?.locked && (
              <div className="mt-4 flex items-center gap-2">
                <input value={teamName} onChange={(e) => setTeamName(e.target.value)} className="flex-1 bg-card border border-border rounded-lg px-3 py-2.5 text-sm outline-none" placeholder="Nombre del equipo" />
                <button onClick={submit} disabled={saving || !complete || remaining < 0}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-sm disabled:opacity-40">{saving ? "Guardando…" : "Guardar"}</button>
              </div>
            )}
            {state?.squad && <div className="mt-3 text-center"><Link href="/fantasy/leaderboard" className="text-xs text-emerald-400 hover:underline">Ver ranking →</Link></div>}
          </>
        )}
      </div>

      {picker && rules && (
        <PickerModal
          market={market} byId={byId} picker={picker} q={q} setQ={setQ} onPick={assignPlayer}
          onClose={() => { setPicker(null); setQ(""); }} chosenIds={chosenIds} clubCount={clubCount} maxClub={rules.MAX_PER_CLUB} remaining={remaining}
        />
      )}
    </div>
  );
}

// ── Cancha XV ────────────────────────────────────────────────────────────────
function Pitch({ assign, byId, captainId, onSlot, onCaptain }: {
  assign: Record<string, string | null>; byId: Map<string, PP>; captainId: string | null;
  onSlot: (slot: FormationSlot) => void; onCaptain: (id: string) => void;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-emerald-900/50"
      style={{ aspectRatio: "3 / 3.5", background: "linear-gradient(180deg,#0d5c2f 0%,#0a4d28 50%,#083d20 100%)" }}>
      {/* líneas */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute inset-x-[5%] top-[2.5%] bottom-[2.5%] border border-white/30 rounded" />
        <div className="absolute left-[5%] right-[5%] top-[22%] border-t border-white/25" />
        <div className="absolute left-[5%] right-[5%] top-1/2 border-t border-dashed border-white/30" />
        <div className="absolute left-[5%] right-[5%] bottom-[22%] border-t border-white/25" />
        {/* postes arriba */}
        <div className="absolute left-1/2 top-[2%] -translate-x-1/2 flex gap-3"><div className="w-px h-4 bg-white/50" /><div className="w-px h-4 bg-white/50" /></div>
      </div>
      {FORMATION.map((slot) => {
        const id = assign[slot.id];
        const p = id ? byId.get(id) : null;
        return (
          <div key={slot.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
            {p ? (
              <div className="relative flex flex-col items-center w-[58px]">
                {captainId === id && <span className="absolute -top-1 -right-1 bg-yellow-400 text-black rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black z-10">C</span>}
                <button onClick={() => onSlot(slot)} className="flex flex-col items-center">
                  <ClubLogo noLink team={p.team} className="w-8 h-8 rounded-full ring-2 ring-white/20" />
                  <span className="text-[9px] font-bold text-white text-center leading-none mt-0.5 truncate w-[58px]">{p.name.split(" ").slice(-1)[0]}</span>
                  <span className="text-[8px] text-emerald-200/90 tabular-nums">{money(p.price)}</span>
                </button>
                <button onClick={() => onCaptain(id!)} className={`mt-0.5 w-4 h-3.5 rounded text-[8px] font-black leading-none ${captainId === id ? "bg-yellow-400 text-black" : "bg-white/20 text-white/80"}`}>C</button>
              </div>
            ) : (
              <button onClick={() => onSlot(slot)} className="flex flex-col items-center justify-center w-[52px] h-[52px] rounded-full border-2 border-dashed border-white/40 text-white/70 hover:border-white/70">
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

function SlotCard({ label, icon, id, byId, onClick, accent }: {
  label: string; icon: React.ReactNode; id: string | null; byId: Map<string, PP>; onClick: () => void; accent: "orange" | "yellow";
}) {
  const p = id ? byId.get(id) : null;
  return (
    <button onClick={onClick} className={`rounded-xl border p-3 text-left flex items-center gap-3 ${accent === "orange" ? "border-orange-500/40 bg-orange-500/5" : "border-yellow-500/40 bg-yellow-500/5"}`}>
      {p ? <ClubLogo noLink team={p.team} className="w-9 h-9 rounded-full flex-shrink-0" /> : <div className="w-9 h-9 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground">+</div>}
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon}{label}</p>
        <p className="text-sm font-semibold truncate">{p ? p.name : "Elegir"}</p>
        {p && <p className="text-[10px] text-muted-foreground">{money(p.price)}</p>}
      </div>
    </button>
  );
}

// ── Picker modal (por posición) ──────────────────────────────────────────────
function PickerModal({ market, byId, picker, q, setQ, onPick, onClose, chosenIds, clubCount, maxClub, remaining }: {
  market: PP[]; byId: Map<string, PP>; picker: { slotId: string; position: Position } | "supersub";
  q: string; setQ: (s: string) => void; onPick: (id: string) => void; onClose: () => void;
  chosenIds: string[]; clubCount: (slug: string, exclude?: string) => number; maxClub: number; remaining: number;
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
          <h3 className="font-bold">{isSub ? "Elige tu Super Sub" : `Elige ${position}`}</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="p-3 border-b border-border">
          <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="w-full pl-8 pr-3 py-2 rounded-lg bg-muted/50 text-sm outline-none" /></div>
        </div>
        <div className="overflow-y-auto p-2 space-y-1">
          {list.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sin jugadores para este puesto</p>}
          {list.map((p) => {
            const tooExpensive = p.price > remaining + 0.001 && !chosenIds.length;
            const clubFull = clubCount(p.teamSlug) >= maxClub;
            const disabled = clubFull;
            return (
              <button key={p.arusaId} disabled={disabled} onClick={() => onPick(p.arusaId)}
                className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left ${disabled ? "opacity-40" : "hover:bg-muted/40"}`}>
                <ClubLogo noLink team={p.team} className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-sm truncate">{p.name}</p><p className="text-[10px] text-muted-foreground">{p.team}{p.primary ? ` · ${POSITION_SHORT[p.primary]}` : ""} · {p.points}pts{clubFull ? " · club lleno" : ""}</p></div>
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
