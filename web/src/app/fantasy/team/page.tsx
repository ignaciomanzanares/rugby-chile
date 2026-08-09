"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  getAllFantasyPlayers,
  buildRandomSquad,
  validateAssignments,
  emptyAssignments,
  assignToFormation,
  assignedPlayers,
  playsPosition,
  budgetUsed,
  BUDGET,
  SQUAD_SIZE,
  MAX_PER_CLUB,
  POSITION_LABELS,
  POSITION_SHORT,
  DIVISION_LABELS,
  type Assignments,
  type FantasyPlayer,
  type FormationSlot,
  type Division,
} from "@/lib/fantasy";
import { FantasyPitch } from "@/components/fantasy-pitch";
import { clubLogo } from "@/lib/tournament";
import { useArusaPlayerStats } from "@/lib/use-arusa-player-stats";
import Link from "next/link";
import { Shuffle, Trash2, Trophy } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function FantasyTeamInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const division = (searchParams.get("division") ?? "primera") as Division;

  const [assignments, setAssignments] = useState<Assignments>(emptyAssignments);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("Mi Equipo");
  const [pickerSlot, setPickerSlot] = useState<FormationSlot | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingSquad, setLoadingSquad] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  // Stats EN VIVO de arusa (3 divisiones) para armar el pool con tries/PJ y
  // precios al día. Mientras no cargan las 3, se usa el dataset estático como
  // fallback (el pool nunca queda vacío).
  const { players: pStats } = useArusaPlayerStats("PRIMERA");
  const { players: iStats } = useArusaPlayerStats("INTERMEDIA");
  const { players: preStats } = useArusaPlayerStats("PRE_INTERMEDIA");
  const liveSource = useMemo(
    () => (pStats && iStats && preStats ? { PRIMERA: pStats, INTERMEDIA: iStats, PRE_INTERMEDIA: preStats } : undefined),
    [pStats, iStats, preStats],
  );
  const allPlayers = useMemo(() => getAllFantasyPlayers(division, liveSource), [division, liveSource]);

  useEffect(() => {
    if (!loading && !user) router.push("/login?from=/fantasy/team");
  }, [loading, user, router]);

  // Carga el equipo guardado y lo sienta en la cancha — UNA sola vez por
  // división. Antes dependía de `allPlayers`, que cambia con cada poll de stats
  // (cada 60s), así que reejecutaba esto y volvía a cargar el equipo guardado,
  // pisando lo que el usuario acababa de vaciar/editar (ese era el bug del
  // "vaciar equipo" que volvía solo). El ref lo evita.
  const seededDivRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch(`${API_URL}/api/v1/fantasy/squad?division=${division}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (seededDivRef.current === division) return; // ya sembrado: no pisar edits
        if (allPlayers.length === 0) return;           // pool aún no listo, reintenta
        seededDivRef.current = division;
        if (data.squad && data.players?.length > 0) {
          setTeamName(data.squad.teamName ?? "Mi Equipo");
          setCaptainId(data.squad.captainId ?? null);
          setViceCaptainId(data.squad.viceCaptainId ?? null);
          const playerMap = new Map(allPlayers.map((p) => [p.id, p]));
          const loaded = data.players
            .map((sp: { arusaId: string }) => playerMap.get(sp.arusaId))
            .filter(Boolean) as FantasyPlayer[];
          setAssignments(assignToFormation(loaded));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingSquad(false); });
    return () => { cancelled = true; };
  }, [user, allPlayers, division]);

  // Cuando el pool se actualiza (live/poll), refresca EN EL LUGAR los precios de
  // los jugadores ya puestos, sin re-cargar el equipo guardado ni tocar los
  // slots vacíos (respeta lo que el usuario vació/editó).
  useEffect(() => {
    if (seededDivRef.current == null) return;
    setAssignments((prev) => {
      const map = new Map(allPlayers.map((p) => [p.id, p]));
      let changed = false;
      const next = { ...prev };
      for (const [id, cur] of Object.entries(prev)) {
        if (!cur) continue;
        const fresh = map.get(cur.id);
        if (fresh && fresh !== cur) { next[id] = fresh; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [allPlayers]);

  const squad = useMemo(() => assignedPlayers(assignments), [assignments]);
  const budget = budgetUsed(squad);
  const overBudget = budget > BUDGET;
  const assignedIds = useMemo(() => new Set(squad.map((p) => p.id)), [squad]);

  const clubCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of squad) c[p.clubSlug] = (c[p.clubSlug] ?? 0) + 1;
    return c;
  }, [squad]);

  // Candidates for the open picker slot: right position, not already on the
  // pitch (except the one in this slot), matching the search.
  const candidates = useMemo(() => {
    if (!pickerSlot) return [];
    const current = assignments[pickerSlot.id];
    const q = search.trim().toLowerCase();
    return allPlayers.filter(
      (p) =>
        playsPosition(p, pickerSlot.position) &&
        (!assignedIds.has(p.id) || p.id === current?.id) &&
        (!q || p.name.toLowerCase().includes(q) || p.clubName.toLowerCase().includes(q)),
    );
  }, [pickerSlot, assignments, allPlayers, assignedIds, search]);

  function openSlot(slot: FormationSlot) {
    setSearch("");
    setPickerSlot(slot);
  }

  function assignPlayer(player: FantasyPlayer) {
    if (!pickerSlot) return;
    setAssignments((prev) => ({ ...prev, [pickerSlot.id]: player }));
    setPickerSlot(null);
  }

  function clearSlot(slotId: string) {
    const removed = assignments[slotId];
    setAssignments((prev) => ({ ...prev, [slotId]: null }));
    if (removed) {
      if (captainId === removed.id) setCaptainId(null);
      if (viceCaptainId === removed.id) setViceCaptainId(null);
    }
    setPickerSlot(null);
  }

  function setCaptain(id: string) {
    setCaptainId((c) => (c === id ? null : id));
    setViceCaptainId((v) => (v === id ? null : v));
    setPickerSlot(null);
  }
  function setVice(id: string) {
    setViceCaptainId((v) => (v === id ? null : id));
    setCaptainId((c) => (c === id ? null : c));
    setPickerSlot(null);
  }

  function canAddClub(player: FantasyPlayer): boolean {
    const current = pickerSlot ? assignments[pickerSlot.id] : null;
    if (current?.clubSlug === player.clubSlug) return true; // swapping within same club
    return (clubCounts[player.clubSlug] ?? 0) < MAX_PER_CLUB;
  }

  const validationError = validateAssignments(assignments);
  const canSave = !validationError && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${API_URL}/api/v1/fantasy/squad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          teamName,
          division,
          playerIds: squad.map((p) => ({
            arusaId: p.id,
            clubSlug: p.clubSlug,
            playerName: p.name,
            purchasePrice: Math.round(p.price * 10),
          })),
          captainId,
          viceCaptainId,
        }),
      });
      const data = await res.json();
      if (!res.ok) setSaveError(data.error ?? "Error al guardar");
      else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      setSaveError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  function doClearTeam() {
    setAssignments(emptyAssignments());
    setCaptainId(null);
    setViceCaptainId(null);
    setSaveError(null);
    setSaveSuccess(false);
    setConfirmClear(false);
  }

  function randomTeam() {
    const a = buildRandomSquad(allPlayers);
    if (!a) {
      setSaveError("No se pudo armar un equipo aleatorio bajo presupuesto. Probá de nuevo.");
      return;
    }
    setAssignments(a);
    setCaptainId(null);
    setViceCaptainId(null);
    setSaveError(null);
    setSaveSuccess(false);
  }

  if (loading || loadingSquad) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Cargando...</div>
      </div>
    );
  }
  if (!user) return null;

  const pickerCurrent = pickerSlot ? assignments[pickerSlot.id] : null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold text-amber-500/70 uppercase tracking-widest">
              {DIVISION_LABELS[division] ?? division}
            </span>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="bg-transparent text-xl font-black text-foreground border-b border-border focus:border-amber-500 outline-none pb-0.5 max-w-[200px]"
              maxLength={50}
            />
          </div>
          <div className="flex items-center gap-3 md:gap-4 text-sm">
            <div className="text-right leading-tight">
              <div className={`font-semibold tabular-nums ${overBudget ? "text-red-400" : "text-emerald-400"}`}>
                ${budget.toFixed(1)}M / ${BUDGET}M
              </div>
              <div className="text-muted-foreground font-medium tabular-nums text-xs">
                {squad.length}/{SQUAD_SIZE}
              </div>
            </div>
            <Link
              href={`/fantasy/leaderboard?division=${division}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-600/40 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 font-semibold transition-colors flex-shrink-0"
            >
              <Trophy className="h-4 w-4" /> <span className="hidden sm:inline">Tabla</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Pitch */}
      <div className="max-w-5xl mx-auto px-4 pt-5">
        <p className="text-center text-xs text-muted-foreground mb-3">
          Toca una posición para elegir jugador · Capitán (C) puntúa doble, Vice (V) ×1.5
        </p>
        <FantasyPitch
          assignments={assignments}
          captainId={captainId}
          viceCaptainId={viceCaptainId}
          onSlotClick={openSlot}
        />

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-600" /> Forwards</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400" /> Backs</span>
        </div>

        {/* Acciones rápidas: equipo aleatorio (bajo presupuesto) / vaciar */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={randomTeam}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-600/40 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 text-sm font-semibold transition-colors"
          >
            <Shuffle className="h-4 w-4" /> Equipo aleatorio
          </button>
          <button
            onClick={() => setConfirmClear(true)}
            disabled={squad.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border hover:border-red-700 text-muted-foreground hover:text-red-400 text-sm font-semibold transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground disabled:hover:border-border"
          >
            <Trash2 className="h-4 w-4" /> Vaciar equipo
          </button>
        </div>
      </div>

      {/* Confirmación de vaciar equipo (modal con estilo del sitio, no el confirm nativo) */}
      {confirmClear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setConfirmClear(false)}
        >
          <div
            className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-full bg-red-600/15 text-red-400 flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </div>
              <h3 className="font-black text-foreground text-lg">Vaciar equipo</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Se quitan los {squad.length} jugadores del equipo. Podés volver a armarlo cuando quieras.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmClear(false)}
                className="px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 text-sm font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={doClearTeam}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Vaciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Picker modal */}
      {pickerSlot && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setPickerSlot(null)}>
          <div
            className="w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <h3 className="font-black text-foreground">{POSITION_LABELS[pickerSlot.position]}</h3>
                <span className="text-[10px] font-bold text-amber-500/70 uppercase tracking-widest">{POSITION_SHORT[pickerSlot.position]}</span>
              </div>
              <button onClick={() => setPickerSlot(null)} className="w-8 h-8 rounded-full bg-muted hover:bg-secondary text-muted-foreground flex items-center justify-center">×</button>
            </div>

            {/* Current player actions */}
            {pickerCurrent && (
              <div className="px-4 py-3 border-b border-border bg-amber-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-sm text-foreground truncate">{pickerCurrent.name}</span>
                  <span className="text-amber-400 font-black text-sm tabular-nums ml-auto">${pickerCurrent.price.toFixed(1)}M</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setCaptain(pickerCurrent.id)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${captainId === pickerCurrent.id ? "bg-amber-500 text-zinc-950" : "bg-muted text-foreground hover:bg-secondary"}`}>Capitán</button>
                  <button onClick={() => setVice(pickerCurrent.id)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${viceCaptainId === pickerCurrent.id ? "bg-amber-400/30 text-amber-300 border border-amber-500/50" : "bg-muted text-foreground hover:bg-secondary"}`}>Vice</button>
                  <button onClick={() => clearSlot(pickerSlot.id)} className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-red-900/40 text-red-300 hover:bg-red-900/60 transition-colors">Quitar</button>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="px-4 py-2 border-b border-border">
              <input
                type="text"
                placeholder="Buscar jugador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Candidate list */}
            <div className="overflow-y-auto flex-1">
              {candidates.length === 0 ? (
                <p className="text-center text-muted-foreground/70 py-10 text-sm">No hay jugadores disponibles</p>
              ) : (
                candidates.map((p) => {
                  const clubOk = canAddClub(p);
                  const isCurrent = p.id === pickerCurrent?.id;
                  const wouldOverBudget = budget - (pickerCurrent?.price ?? 0) + p.price > BUDGET;
                  const logo = clubLogo(p.clubName);
                  return (
                    <button
                      key={p.id}
                      onClick={() => clubOk && assignPlayer(p)}
                      disabled={!clubOk && !isCurrent}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 border-b border-border/60 text-left transition-colors ${
                        isCurrent ? "bg-amber-500/10" : clubOk ? "hover:bg-muted" : "opacity-40 cursor-not-allowed"
                      }`}
                    >
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" className="w-7 h-7 rounded-full object-cover ring-1 ring-border flex-shrink-0" />
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-muted flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-foreground truncate">{p.name}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{p.clubName}</span>
                          {!clubOk && <span className="text-red-400">Club lleno</span>}
                          <span className="text-muted-foreground/70">{p.stats.tries}T · {p.stats.matches}PJ</span>
                        </div>
                      </div>
                      <span className={`font-black text-sm tabular-nums ${wouldOverBudget ? "text-red-400" : "text-amber-400"}`}>
                        ${p.price.toFixed(1)}M
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sticky bottom save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border px-4 py-4">
        <div className="max-w-5xl mx-auto flex flex-col gap-2">
          {(validationError || saveError) && (
            <p className="text-red-400 text-xs text-center">{saveError ?? validationError}</p>
          )}
          {saveSuccess && <p className="text-emerald-400 text-xs text-center">Equipo guardado correctamente</p>}
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full py-3.5 rounded-lg font-black text-base transition-colors ${
              canSave ? "bg-red-600 hover:bg-red-500 text-white" : "bg-muted text-muted-foreground/70 cursor-not-allowed"
            }`}
          >
            {saving ? "Guardando..." : "Guardar equipo"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FantasyTeamPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <FantasyTeamInner />
    </Suspense>
  );
}
