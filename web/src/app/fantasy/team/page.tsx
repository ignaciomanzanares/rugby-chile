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

        {!loading && mode === "build" && rules && (
          <BuildView
            market={market} byId={byId} picked={picked} rules={rules} cost={cost} remaining={remaining}
            q={q} setQ={setQ} togglePick={togglePick} teamName={teamName} setTeamName={setTeamName}
            captainId={captainId} setCaptainId={setCaptainId} viceId={viceId} setViceId={setViceId}
            msg={msg} busy={busy} onSubmit={submitSquad} onCancel={state?.squad ? () => { setMode("view"); setPicked([]); } : undefined}
          />
        )}

        {!loading && mode === "transfer" && state?.squad && state.roster && rules && (
          <TransferView
            state={state} byId={byId} market={market} rules={rules} division={division}
            reload={() => load(division)} onCancel={() => setMode("view")}
          />
        )}

        {!loading && mode === "view" && state?.squad && state.roster && rules && (
          <ManageView
            state={state} byId={byId} rules={rules} countdown={countdown} division={division}
            onTransfer={() => setMode("transfer")}
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

// ── Manage (cancha 15+4 editable + capitán/vice + chips + guardar) ───────────────
function ManageView(props: {
  state: FantasyState; byId: Map<string, MarketPlayer>; rules: FantasyRules; countdown: string; division: Division;
  onTransfer: () => void; reload: () => void; setMsg: (s: string | null) => void; msg: string | null;
}) {
  const { state, byId, rules, countdown, division, onTransfer, reload, setMsg, msg } = props;
  const roster = state.roster!;
  const line = state.currentLineup;
  const locked = state.gameweek.locked;

  const nameOf = (id: string) => byId.get(id)?.name ?? roster.find((r) => r.arusaId === id)?.playerName ?? id;
  const teamOf = (id: string) => byId.get(id)?.team ?? "";
  const priceOf = (id: string) => byId.get(id)?.price ?? roster.find((r) => r.arusaId === id)?.price ?? 0;

  // Alineación editable localmente; se persiste al Guardar.
  const [starters, setStarters] = useState<string[]>(line?.starters ?? roster.slice(0, rules.STARTERS).map((r) => r.arusaId));
  const [bench, setBench] = useState<string[]>(line?.bench ?? roster.slice(rules.STARTERS).map((r) => r.arusaId));
  const [captainId, setCaptainId] = useState<string | null>(line?.captainId ?? state.squad!.captainId);
  const [viceId, setViceId] = useState<string | null>(line?.viceCaptainId ?? state.squad!.viceCaptainId);
  const [chip, setChip] = useState<string | null>(line?.chip ?? null);
  const [sel, setSel] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function tapPlayer(id: string) {
    if (locked) { setMsg("La fecha ya empezó — no se puede cambiar"); return; }
    setMsg(null);
    if (sel == null) { setSel(id); return; }
    if (sel === id) { setSel(null); return; }
    // Swap posiciones en la lista combinada (primeros 15 titulares + 4 banca).
    const combined = [...starters, ...bench];
    const i = combined.indexOf(sel), j = combined.indexOf(id);
    if (i >= 0 && j >= 0) {
      [combined[i], combined[j]] = [combined[j], combined[i]];
      setStarters(combined.slice(0, rules.STARTERS));
      setBench(combined.slice(rules.STARTERS));
      setDirty(true);
    }
    setSel(null);
  }
  function makeCaptain(id: string) { if (locked) return; setCaptainId(id); if (viceId === id) setViceId(null); setDirty(true); }
  function makeVice(id: string) { if (locked) return; setViceId(id); if (captainId === id) setCaptainId(null); setDirty(true); }
  function toggleChip(c: string) { if (locked) return; setChip((prev) => (prev === c ? null : c)); setDirty(true); }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      await saveLineup({ division, starters, bench, captainId: captainId ?? undefined, viceCaptainId: viceId ?? undefined, chip });
      setDirty(false); reload();
    } catch (e) { setMsg((e as Error).message); } finally { setSaving(false); }
  }

  const Player = ({ id, isBench }: { id: string; isBench?: boolean }) => (
    <div className={`relative flex flex-col items-center gap-1 rounded-lg px-1.5 py-2 min-w-[66px] transition-colors ${
      sel === id ? "ring-2 ring-emerald-400 bg-emerald-600/20" : isBench ? "bg-muted/40" : "bg-emerald-950/30 border border-emerald-900/40"}`}>
      {captainId === id && <span className="absolute -top-1 -right-1 bg-yellow-400 text-black rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black z-10">C</span>}
      {viceId === id && <span className="absolute -top-1 -right-1 bg-sky-400 text-black rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black z-10">V</span>}
      <button onClick={() => tapPlayer(id)} className="flex flex-col items-center gap-1">
        <ClubLogo team={teamOf(id)} className="w-8 h-8 rounded-full" />
        <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 max-w-[64px]">{nameOf(id).split(" ")[0]}</span>
        <span className="text-[9px] text-muted-foreground tabular-nums">{money(priceOf(id))}</span>
      </button>
      {!locked && (
        <div className="flex gap-1">
          <button onClick={() => makeCaptain(id)} className={`w-4 h-4 rounded text-[9px] font-black ${captainId === id ? "bg-yellow-400 text-black" : "bg-muted text-muted-foreground"}`}>C</button>
          <button onClick={() => makeVice(id)} className={`w-4 h-4 rounded text-[9px] font-black ${viceId === id ? "bg-sky-400 text-black" : "bg-muted text-muted-foreground"}`}>V</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Puntos totales</p><p className="text-2xl font-black tabular-nums">{state.overallPoints ?? 0}</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Fecha {state.gameweek.round}</p><p className={`text-lg font-bold ${locked ? "text-red-500" : "text-emerald-400"}`}>{locked ? "En juego" : countdown || "—"}</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" />Banco</p><p className="text-lg font-bold tabular-nums">{money(state.bank ?? 0)}</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><ArrowLeftRight className="h-3 w-3" />Transfers libres</p><p className="text-lg font-bold tabular-nums">{state.freeTransfers ?? 1}</p></div>
      </div>

      {msg && <p className="text-xs text-amber-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{msg}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onTransfer} disabled={locked} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40"><ArrowLeftRight className="h-4 w-4" />Transferencias</button>
        <Link href="/fantasy/leaderboard" className="px-4 py-2 rounded-lg border border-border text-sm font-semibold flex items-center gap-1.5"><Trophy className="h-4 w-4" />Ranking</Link>
        {dirty && <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold ml-auto">{saving ? "Guardando…" : "Guardar alineación"}</button>}
        {!dirty && <span className="text-[11px] text-muted-foreground ml-auto">{locked ? "Fecha cerrada" : "Tocá 2 jugadores para intercambiarlos · C capitán · V vice"}</span>}
      </div>

      <div className="rounded-2xl border border-emerald-900/40 bg-gradient-to-b from-emerald-950/40 to-emerald-950/10 p-4">
        <p className="text-[10px] uppercase tracking-widest text-emerald-400/70 mb-3 flex items-center gap-1"><ShieldHalf className="h-3 w-3" />Titulares</p>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 justify-items-center">{starters.map((id) => <Player key={id} id={id} />)}</div>
        <div className="border-t border-emerald-900/40 mt-4 pt-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Banca {chip === "bench_boost" && <span className="text-yellow-400 ml-1">· Bench Boost activo</span>}</p>
          <div className="grid grid-cols-4 gap-2 justify-items-center">{bench.map((id) => <Player key={id} id={id} isBench />)}</div>
        </div>
      </div>

      {/* chips: bench_boost y triple_captain se activan acá (guardando la alineación) */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1"><Zap className="h-3.5 w-3.5" />Chips (una vez por temporada)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          {([
            ["bench_boost", "Bench Boost", state.chips?.benchBoost, true],
            ["triple_captain", "Triple Capitán", state.chips?.tripleCaptain, true],
            ["wildcard", "Comodín", state.chips?.wildcard, false],
            ["free_hit", "Free Hit", state.chips?.freeHit, false],
          ] as const).map(([key, label, avail, here]) => {
            const active = chip === key;
            const usable = avail && here && !locked;
            return (
              <button key={key} disabled={!usable} onClick={() => usable && toggleChip(key)}
                className={`rounded-lg border p-2 transition-colors ${active ? "border-yellow-400 bg-yellow-400/10 text-foreground" : avail ? "border-emerald-600/40 text-foreground" : "border-border text-muted-foreground/50 line-through"} ${usable ? "cursor-pointer" : "cursor-default"}`}>
                <Star className={`h-4 w-4 mx-auto mb-1 ${active ? "text-yellow-400" : avail ? "text-yellow-400/70" : "text-muted-foreground/40"}`} />
                {label}
                {!here && avail && <span className="block text-[9px] text-muted-foreground">en transferencias</span>}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Bench Boost / Triple Capitán: activá y tocá <b>Guardar alineación</b>. Comodín / Free Hit: en <b>Transferencias</b>.</p>
      </div>
    </div>
  );
}

// ── Transferencias (vender/comprar con presupuesto + hits + chips) ───────────────
function TransferView(props: {
  state: FantasyState; byId: Map<string, MarketPlayer>; market: MarketPlayer[]; rules: FantasyRules; division: Division;
  reload: () => void; onCancel: () => void;
}) {
  const { state, byId, market, rules, division, reload, onCancel } = props;
  const roster = state.roster!;
  const bank = state.bank ?? 0;
  const freeTransfers = state.freeTransfers ?? 1;

  const [out, setOut] = useState<string[]>([]);
  const [buys, setBuys] = useState<MarketPlayer[]>([]);
  const [chip, setChip] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const priceOf = (id: string) => byId.get(id)?.price ?? roster.find((r) => r.arusaId === id)?.price ?? 0;
  const sold = out.reduce((s, id) => s + priceOf(id), 0);
  const bought = buys.reduce((s, p) => s + p.price, 0);
  const newBank = bank + sold - bought;
  const nTransfers = out.length;
  const isChip = chip === "wildcard" || chip === "free_hit";
  const hits = isChip ? 0 : Math.max(0, nTransfers - freeTransfers) * rules.HIT_COST;

  const rosterIds = new Set(roster.map((r) => r.arusaId));
  const buyIds = new Set(buys.map((p) => p.arusaId));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return market
      .filter((p) => !rosterIds.has(p.arusaId) && !buyIds.has(p.arusaId))
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.team.toLowerCase().includes(s))
      .slice(0, 150);
  }, [market, q, out, buys]); // eslint-disable-line

  function toggleSell(id: string) {
    setMsg(null);
    setOut((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    // si al vender queda desbalanceado, recortamos compras de más
    setBuys((prev) => prev.slice(0, Math.max(0, (out.includes(id) ? out.length - 1 : out.length + 1))));
  }
  function addBuy(p: MarketPlayer) {
    setMsg(null);
    if (buys.length >= out.length) { setMsg("Primero marcá a quién vender"); return; }
    // límite de club sobre el plantel resultante
    const resulting = roster.filter((r) => !out.includes(r.arusaId)).map((r) => r.clubSlug).concat([...buys, p].map((b) => b.teamSlug));
    const count = resulting.filter((t) => t === p.teamSlug).length;
    if (count > rules.MAX_PER_CLUB) { setMsg(`Máximo ${rules.MAX_PER_CLUB} por club`); return; }
    if (bank + sold - (bought + p.price) < 0) { setMsg("No te alcanza el presupuesto"); return; }
    setBuys((prev) => [...prev, p]);
  }

  async function confirm() {
    if (out.length === 0) { setMsg("No marcaste transferencias"); return; }
    if (out.length !== buys.length) { setMsg("Elegí un reemplazo por cada jugador que vendés"); return; }
    if (newBank < 0) { setMsg("Te pasás del presupuesto"); return; }
    setBusy(true); setMsg(null);
    try {
      await makeTransfers({ division, out, in: buys.map((p) => ({ arusaId: p.arusaId, clubSlug: p.teamSlug, playerName: p.name })), chip });
      reload(); onCancel();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-emerald-500" />Transferencias · Fecha {state.gameweek.round}</h2>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-border text-sm">Volver</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] uppercase text-muted-foreground">Banco tras cambios</p><p className={`text-lg font-bold tabular-nums ${newBank < 0 ? "text-red-500" : "text-emerald-400"}`}>{money(newBank)}</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] uppercase text-muted-foreground">Transferencias</p><p className="text-lg font-bold tabular-nums">{nTransfers}</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] uppercase text-muted-foreground">Libres</p><p className="text-lg font-bold tabular-nums">{isChip ? "∞" : freeTransfers}</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] uppercase text-muted-foreground">Costo (hits)</p><p className={`text-lg font-bold tabular-nums ${hits > 0 ? "text-red-500" : ""}`}>{hits > 0 ? `−${hits}` : "0"}</p></div>
      </div>

      {msg && <p className="text-xs text-amber-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{msg}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        {([["wildcard", "Comodín", state.chips?.wildcard], ["free_hit", "Free Hit", state.chips?.freeHit]] as const).map(([k, label, avail]) => (
          <button key={k} disabled={!avail} onClick={() => setChip((prev) => prev === k ? null : k)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 ${chip === k ? "border-yellow-400 bg-yellow-400/10" : avail ? "border-emerald-600/40" : "border-border text-muted-foreground/50 line-through"}`}>
            <Star className="h-3.5 w-3.5 text-yellow-400" />{label}{chip === k && " ✓"}
          </button>
        ))}
        <span className="text-[11px] text-muted-foreground">Comodín/Free Hit: transferencias sin costo</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* vender */}
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Tu plantel · tocá para vender</p>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {roster.map((r) => { const selling = out.includes(r.arusaId); return (
              <button key={r.arusaId} onClick={() => toggleSell(r.arusaId)}
                className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left border ${selling ? "bg-red-600/15 border-red-600/40" : "border-transparent hover:bg-muted/40"}`}>
                <ClubLogo team={byId.get(r.arusaId)?.team ?? ""} className="w-6 h-6 rounded-full flex-shrink-0" />
                <span className="text-sm flex-1 truncate">{byId.get(r.arusaId)?.name ?? r.playerName}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{money(priceOf(r.arusaId))}</span>
                {selling && <X className="h-4 w-4 text-red-500" />}
              </button>
            ); })}
          </div>
        </div>

        {/* comprar */}
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Comprar ({buys.length}/{out.length})</p>
          </div>
          {buys.length > 0 && (
            <div className="space-y-1 mb-2">
              {buys.map((p) => (
                <div key={p.arusaId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-emerald-600/15 border border-emerald-600/40">
                  <ClubLogo team={p.team} className="w-6 h-6 rounded-full flex-shrink-0" />
                  <span className="text-sm flex-1 truncate">{p.name}</span>
                  <span className="text-xs tabular-nums">{money(p.price)}</span>
                  <button onClick={() => setBuys((prev) => prev.filter((x) => x.arusaId !== p.arusaId))}><X className="h-4 w-4 text-muted-foreground hover:text-red-500" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar reemplazo" className="w-full pl-8 pr-3 py-2 rounded-lg bg-muted/50 text-sm outline-none" />
          </div>
          <div className="space-y-1 max-h-[45vh] overflow-y-auto">
            {filtered.map((p) => (
              <button key={p.arusaId} onClick={() => addBuy(p)} className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/40 border border-transparent">
                <ClubLogo team={p.team} className="w-6 h-6 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-sm truncate">{p.name}</p><p className="text-[10px] text-muted-foreground">{p.team} · {p.points}pts</p></div>
                <span className="text-xs font-semibold tabular-nums">{money(p.price)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={confirm} disabled={busy || out.length === 0 || out.length !== buys.length || newBank < 0}
        className="w-full py-3 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed">
        {busy ? "Confirmando…" : hits > 0 ? `Confirmar (${nTransfers} cambios · −${hits} pts)` : `Confirmar ${nTransfers} cambio${nTransfers === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
