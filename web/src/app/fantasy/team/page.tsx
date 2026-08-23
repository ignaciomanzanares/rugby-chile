"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trophy, Clock, Wallet, Star, ShieldHalf, ArrowLeftRight, Zap, Search, Check, X, AlertCircle } from "lucide-react";
import { ClubLogo } from "@/components/club-logo";
import {
  fetchState, fetchMarket, saveSquad, saveLineup, makeTransfers, money,
  type Division, type FantasyState, type MarketPlayer, type FantasyRules,
} from "@/lib/fantasy-api";

const DIVISIONS: { key: Division; label: string }[] = [
  { key: "primera", label: "Primera" },
  { key: "intermedia", label: "Intermedia" },
  { key: "pre-intermedia", label: "Pre-Inter" },
];

type Mode = "view" | "build" | "transfer";

function useCountdown(deadline: string | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  if (!deadline) return "";
  const ms = Date.parse(deadline) - now;
  if (ms <= 0) return "cerrada";
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export default function FantasyTeamPage() {
  const [division, setDivision] = useState<Division>("primera");
  const [state, setState] = useState<FantasyState | null>(null);
  const [market, setMarket] = useState<MarketPlayer[]>([]);
  const [rules, setRules] = useState<FantasyRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");

  // build/transfer selection
  const [picked, setPicked] = useState<string[]>([]);       // arusaIds del plantel en construcción (orden = 15 titulares + 4 banca)
  const [teamName, setTeamName] = useState("Mi Equipo");
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceId, setViceId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const byId = useMemo(() => new Map(market.map((p) => [p.arusaId, p])), [market]);

  async function load(div: Division) {
    setLoading(true); setErr(null);
    try {
      const [mkt, st] = await Promise.all([fetchMarket(div), fetchState(div).catch((e) => { throw e; })]);
      setMarket(mkt.players); setRules(mkt.rules); setState(st);
      if (st.squad && st.roster) {
        setTeamName(st.squad.teamName);
        setCaptainId(st.currentLineup?.captainId ?? st.squad.captainId);
        setViceId(st.currentLineup?.viceCaptainId ?? st.squad.viceCaptainId);
        setMode("view");
      } else {
        setMode("build"); setPicked([]);
      }
    } catch (e) {
      // fetchState puede tirar 401 (sin sesión) — igual mostramos el mercado.
      setErr((e as Error).message);
      try { const mkt = await fetchMarket(div); setMarket(mkt.players); setRules(mkt.rules); } catch {}
    } finally { setLoading(false); }
  }

  useEffect(() => { load(division); /* eslint-disable-next-line */ }, [division]);

  const cost = picked.reduce((s, id) => s + (byId.get(id)?.price ?? 0), 0);
  const budget = rules?.BUDGET ?? 1000;
  const remaining = budget - cost;

  function togglePick(id: string) {
    setMsg(null);
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= (rules?.SQUAD_SIZE ?? 19)) { setMsg("Ya tenés 19 jugadores"); return prev; }
      const p = byId.get(id);
      if (p) {
        const clubCount = prev.filter((x) => byId.get(x)?.teamSlug === p.teamSlug).length;
        if (clubCount >= (rules?.MAX_PER_CLUB ?? 3)) { setMsg(`Máximo ${rules?.MAX_PER_CLUB ?? 3} por club`); return prev; }
        if (cost + p.price > budget) { setMsg("Te pasás del presupuesto"); return prev; }
      }
      return [...prev, id];
    });
  }

  async function submitSquad() {
    if (picked.length !== (rules?.SQUAD_SIZE ?? 19)) { setMsg(`Elegí ${rules?.SQUAD_SIZE ?? 19} jugadores (${picked.length})`); return; }
    setBusy(true); setMsg(null);
    try {
      await saveSquad({
        division, teamName,
        playerIds: picked.map((id) => { const p = byId.get(id)!; return { arusaId: id, clubSlug: p.teamSlug, playerName: p.name, purchasePrice: p.price }; }),
        captainId: captainId ?? picked[0], viceCaptainId: viceId ?? picked[1],
      });
      await load(division);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const gw = state?.gameweek;
  const countdown = useCountdown(gw?.deadline ?? null);

  return (
    <div className="min-h-screen">
      <section className="border-b border-border bg-gradient-to-b from-emerald-950/20 to-transparent">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="h-5 w-5 text-emerald-500" />
            <h1 className="text-2xl font-black tracking-tight">FANTASY TOP 10</h1>
          </div>
          <p className="text-muted-foreground text-sm">Armá tu equipo de 19 (15 titulares + 4 banca) · Temporada 2026</p>

          <div className="flex items-center gap-1 mt-4 p-1 rounded-xl border border-border bg-card w-fit">
            {DIVISIONS.map((d) => (
              <button key={d.key} onClick={() => setDivision(d.key)}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${division === d.key ? "bg-emerald-600 text-white" : "text-muted-foreground hover:text-foreground"}`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-6">
        {loading && <div className="rounded-xl border border-border p-10 text-center text-muted-foreground animate-pulse">Cargando fantasy…</div>}

        {!loading && err && !state?.squad && mode !== "build" && (
          <div className="rounded-xl border border-border p-8 text-center space-y-3">
            <AlertCircle className="h-6 w-6 text-amber-500 mx-auto" />
            <p className="text-muted-foreground">{err}</p>
            <Link href="/login" className="inline-block px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold">Iniciar sesión</Link>
          </div>
        )}

        {!loading && (mode === "build" || mode === "transfer") && rules && (
          <BuildView
            market={market} byId={byId} picked={picked} rules={rules} cost={cost} remaining={remaining}
            q={q} setQ={setQ} togglePick={togglePick} teamName={teamName} setTeamName={setTeamName}
            captainId={captainId} setCaptainId={setCaptainId} viceId={viceId} setViceId={setViceId}
            msg={msg} busy={busy} onSubmit={submitSquad} onCancel={state?.squad ? () => { setMode("view"); setPicked([]); } : undefined}
          />
        )}

        {!loading && mode === "view" && state?.squad && state.roster && rules && (
          <ManageView
            state={state} byId={byId} rules={rules} countdown={countdown} division={division}
            onEditSquad={() => { setPicked(state.roster!.map((r) => r.arusaId)); setMode("build"); }}
            reload={() => load(division)} setMsg={setMsg} msg={msg}
          />
        )}
      </div>
    </div>
  );
}

// ── Build / edit squad (mercado + presupuesto) ──────────────────────────────────
function BuildView(props: {
  market: MarketPlayer[]; byId: Map<string, MarketPlayer>; picked: string[]; rules: FantasyRules;
  cost: number; remaining: number; q: string; setQ: (s: string) => void; togglePick: (id: string) => void;
  teamName: string; setTeamName: (s: string) => void;
  captainId: string | null; setCaptainId: (s: string | null) => void; viceId: string | null; setViceId: (s: string | null) => void;
  msg: string | null; busy: boolean; onSubmit: () => void; onCancel?: () => void;
}) {
  const { market, byId, picked, rules, cost, remaining, q, setQ, togglePick, teamName, setTeamName, msg, busy, onSubmit, onCancel } = props;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return market.filter((p) => !s || p.name.toLowerCase().includes(s) || p.team.toLowerCase().includes(s)).slice(0, 200);
  }, [market, q]);
  const pct = Math.min(100, (cost / rules.BUDGET) * 100);

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      {/* selección actual */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Nombre del equipo"
              className="bg-transparent font-bold text-lg outline-none border-b border-transparent focus:border-border flex-1" />
            <span className="text-sm font-semibold tabular-nums">{picked.length}/{rules.SQUAD_SIZE}</span>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Presupuesto</span><span className={`font-semibold tabular-nums ${remaining < 0 ? "text-red-500" : "text-emerald-400"}`}>{money(remaining)} libres</span></div>
            <div className="h-2 rounded-full bg-muted overflow-hidden"><div className={`h-full ${pct > 100 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></div>
          </div>
          {msg && <p className="text-xs text-amber-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{msg}</p>}
          <div className="flex items-center gap-2">
            <button onClick={onSubmit} disabled={busy || picked.length !== rules.SQUAD_SIZE}
              className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
              {busy ? "Guardando…" : "Guardar equipo"}
            </button>
            {onCancel && <button onClick={onCancel} className="px-4 py-2.5 rounded-lg border border-border text-sm">Cancelar</button>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Tu plantel · primeros 15 titulares, últimos 4 banca</p>
          {picked.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Elegí jugadores del mercado →</p>}
          <div className="grid grid-cols-1 gap-1">
            {picked.map((id, i) => { const p = byId.get(id); if (!p) return null; return (
              <div key={id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${i < rules.STARTERS ? "bg-card/60" : "bg-muted/40"}`}>
                <span className="text-[10px] font-bold w-5 text-muted-foreground">{i < rules.STARTERS ? i + 1 : "B"}</span>
                <ClubLogo team={p.team} className="w-5 h-5 rounded-full flex-shrink-0" />
                <span className="text-sm flex-1 truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{money(p.price)}</span>
                <button onClick={() => togglePick(id)} className="text-muted-foreground hover:text-red-500"><X className="h-4 w-4" /></button>
              </div>
            ); })}
          </div>
        </div>
      </div>

      {/* mercado */}
      <div className="rounded-xl border border-border bg-card p-3 h-fit lg:sticky lg:top-4">
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar jugador o club"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-muted/50 text-sm outline-none" />
        </div>
        <div className="space-y-1 max-h-[70vh] overflow-y-auto">
          {filtered.map((p) => { const sel = picked.includes(p.arusaId); return (
            <button key={p.arusaId} onClick={() => togglePick(p.arusaId)}
              className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${sel ? "bg-emerald-600/20 border border-emerald-600/40" : "hover:bg-muted/40 border border-transparent"}`}>
              <ClubLogo team={p.team} className="w-6 h-6 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">{p.team} · {p.matches}pj · {p.points}pts</p>
              </div>
              <span className="text-xs font-semibold tabular-nums">{money(p.price)}</span>
              {sel ? <Check className="h-4 w-4 text-emerald-500" /> : <span className="w-4" />}
            </button>
          ); })}
        </div>
      </div>
    </div>
  );
}

// ── Manage (cancha 15+4 + capitán + fecha + chips + acciones) ────────────────────
function ManageView(props: {
  state: FantasyState; byId: Map<string, MarketPlayer>; rules: FantasyRules; countdown: string; division: Division;
  onEditSquad: () => void; reload: () => void; setMsg: (s: string | null) => void; msg: string | null;
}) {
  const { state, byId, rules, countdown, division, onEditSquad, reload, setMsg, msg } = props;
  const roster = state.roster!;
  const line = state.currentLineup;
  const starters = line?.starters ?? roster.slice(0, rules.STARTERS).map((r) => r.arusaId);
  const bench = line?.bench ?? roster.slice(rules.STARTERS).map((r) => r.arusaId);
  const captainId = line?.captainId ?? state.squad!.captainId;
  const nameOf = (id: string) => byId.get(id)?.name ?? roster.find((r) => r.arusaId === id)?.playerName ?? id;
  const teamOf = (id: string) => byId.get(id)?.team ?? "";
  const priceOf = (id: string) => byId.get(id)?.price ?? roster.find((r) => r.arusaId === id)?.price ?? 0;

  const [savingCap, setSavingCap] = useState(false);
  async function setCaptain(id: string) {
    if (state.gameweek.locked) { setMsg("La fecha ya empezó"); return; }
    setSavingCap(true); setMsg(null);
    try {
      await saveLineup({ division, starters, bench, captainId: id, viceCaptainId: state.squad!.viceCaptainId ?? bench[0] ?? undefined, chip: line?.chip ?? null });
      reload();
    } catch (e) { setMsg((e as Error).message); } finally { setSavingCap(false); }
  }

  const Player = ({ id, isBench }: { id: string; isBench?: boolean }) => (
    <button onClick={() => setCaptain(id)} disabled={savingCap}
      className={`relative flex flex-col items-center gap-1 rounded-lg px-1.5 py-2 min-w-[64px] ${isBench ? "bg-muted/40" : "bg-emerald-950/30 border border-emerald-900/40"}`}>
      {captainId === id && <span className="absolute -top-1 -right-1 bg-yellow-400 text-black rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black">C</span>}
      <ClubLogo team={teamOf(id)} className="w-8 h-8 rounded-full" />
      <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 max-w-[64px]">{nameOf(id).split(" ")[0]}</span>
      <span className="text-[9px] text-muted-foreground tabular-nums">{money(priceOf(id))}</span>
    </button>
  );

  return (
    <div className="space-y-5">
      {/* barra superior: fecha, puntos, banco */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Puntos totales</p>
          <p className="text-2xl font-black tabular-nums">{state.overallPoints ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Fecha {state.gameweek.round}</p>
          <p className={`text-lg font-bold ${state.gameweek.locked ? "text-red-500" : "text-emerald-400"}`}>{state.gameweek.locked ? "En juego" : countdown || "—"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" />Banco</p>
          <p className="text-lg font-bold tabular-nums">{money(state.bank ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><ArrowLeftRight className="h-3 w-3" />Transfers libres</p>
          <p className="text-lg font-bold tabular-nums">{state.freeTransfers ?? 1}</p>
        </div>
      </div>

      {msg && <p className="text-xs text-amber-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{msg}</p>}

      {/* acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onEditSquad} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1.5"><ArrowLeftRight className="h-4 w-4" />Transferencias</button>
        <Link href="/fantasy/leaderboard" className="px-4 py-2 rounded-lg border border-border text-sm font-semibold flex items-center gap-1.5"><Trophy className="h-4 w-4" />Ranking</Link>
        <span className="text-xs text-muted-foreground ml-auto">Tocá un jugador para hacerlo capitán (C ×2)</span>
      </div>

      {/* cancha */}
      <div className="rounded-2xl border border-emerald-900/40 bg-gradient-to-b from-emerald-950/40 to-emerald-950/10 p-4">
        <p className="text-[10px] uppercase tracking-widest text-emerald-400/70 mb-3 flex items-center gap-1"><ShieldHalf className="h-3 w-3" />Titulares</p>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 justify-items-center">
          {starters.map((id) => <Player key={id} id={id} />)}
        </div>
        <div className="border-t border-emerald-900/40 mt-4 pt-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Banca</p>
          <div className="grid grid-cols-4 gap-2 justify-items-center">
            {bench.map((id) => <Player key={id} id={id} isBench />)}
          </div>
        </div>
      </div>

      {/* chips */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1"><Zap className="h-3.5 w-3.5" />Chips (una vez por temporada)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          {[
            ["wildcard", "Comodín", state.chips?.wildcard],
            ["tripleCaptain", "Triple Capitán", state.chips?.tripleCaptain],
            ["benchBoost", "Bench Boost", state.chips?.benchBoost],
            ["freeHit", "Free Hit", state.chips?.freeHit],
          ].map(([k, label, avail]) => (
            <div key={k as string} className={`rounded-lg border p-2 ${avail ? "border-emerald-600/40 text-foreground" : "border-border text-muted-foreground/50 line-through"}`}>
              <Star className={`h-4 w-4 mx-auto mb-1 ${avail ? "text-yellow-400" : "text-muted-foreground/40"}`} />
              {label as string}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Los chips se activan al hacer transferencias o guardar la alineación (próximamente en la UI).</p>
      </div>
    </div>
  );
}
