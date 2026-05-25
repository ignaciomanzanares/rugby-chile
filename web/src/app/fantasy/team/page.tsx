"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  getAllFantasyPlayers,
  validateSquad,
  budgetUsed,
  BUDGET,
  SQUAD_SIZE,
  MAX_PER_CLUB,
  DIVISION_LABELS,
  type FantasyPlayer,
  type Division,
} from "@/lib/fantasy";
import { clubs } from "@/data/clubs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";



type CaptainState = "none" | "captain" | "vice";

function FantasyTeamInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const division = (searchParams.get("division") ?? "primera") as Division;

  const [activeTab, setActiveTab] = useState<"available" | "squad">("available");
  const [search, setSearch] = useState("");
  const [clubFilter, setClubFilter] = useState<string>("all");
  const [squad, setSquad] = useState<FantasyPlayer[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("Mi Equipo");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingSquad, setLoadingSquad] = useState(true);

  const allPlayers = useMemo(() => getAllFantasyPlayers(division), [division]);
  const clubSlugs = useMemo(() => [...new Set(clubs.map((c) => c.slug))], []);
  const clubNames = useMemo(() => Object.fromEntries(clubs.map((c) => [c.slug, c.name])), []);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?from=/fantasy/team");
    }
  }, [loading, user, router]);

  // Load existing squad
  useEffect(() => {
    if (!user) return;
    fetch(`${API_URL}/api/v1/fantasy/squad?division=${division}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.squad && data.players?.length > 0) {
          setTeamName(data.squad.teamName ?? "Mi Equipo");
          setCaptainId(data.squad.captainId ?? null);
          setViceCaptainId(data.squad.viceCaptainId ?? null);
          // Map saved players back to FantasyPlayer objects
          const playerMap = new Map(allPlayers.map((p) => [p.id, p]));
          const loaded: FantasyPlayer[] = [];
          for (const sp of data.players) {
            const fp = playerMap.get(sp.arusaId);
            if (fp) loaded.push(fp);
          }
          setSquad(loaded);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSquad(false));
  }, [user, allPlayers]);

  const squadIds = useMemo(() => new Set(squad.map((p) => p.id)), [squad]);

  const filteredPlayers = useMemo(() => {
    let result = allPlayers;
    if (clubFilter !== "all") result = result.filter((p) => p.clubSlug === clubFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.clubName.toLowerCase().includes(q));
    }
    return result;
  }, [allPlayers, clubFilter, search]);

  const budget = budgetUsed(squad);
  const overBudget = budget > BUDGET;

  // Club counts in squad
  const clubCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of squad) counts[p.clubSlug] = (counts[p.clubSlug] ?? 0) + 1;
    return counts;
  }, [squad]);

  function canAdd(player: FantasyPlayer): boolean {
    if (squadIds.has(player.id)) return false;
    if (squad.length >= SQUAD_SIZE) return false;
    if ((clubCounts[player.clubSlug] ?? 0) >= MAX_PER_CLUB) return false;
    return true;
  }

  function togglePlayer(player: FantasyPlayer) {
    if (squadIds.has(player.id)) {
      setSquad((prev) => prev.filter((p) => p.id !== player.id));
      if (captainId === player.id) setCaptainId(null);
      if (viceCaptainId === player.id) setViceCaptainId(null);
    } else if (canAdd(player)) {
      setSquad((prev) => [...prev, player]);
    }
  }

  // Cycle captain state: none → captain → vice → none
  function cycleCaptain(playerId: string) {
    if (captainId === playerId) {
      setCaptainId(null);
      setViceCaptainId(playerId);
    } else if (viceCaptainId === playerId) {
      setViceCaptainId(null);
    } else {
      setCaptainId(playerId);
      if (viceCaptainId === playerId) setViceCaptainId(null);
    }
  }

  function getCaptainState(playerId: string): CaptainState {
    if (captainId === playerId) return "captain";
    if (viceCaptainId === playerId) return "vice";
    return "none";
  }

  function removeFromSquad(playerId: string) {
    setSquad((prev) => prev.filter((p) => p.id !== playerId));
    if (captainId === playerId) setCaptainId(null);
    if (viceCaptainId === playerId) setViceCaptainId(null);
  }

  const validationError = validateSquad(squad);
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
      if (!res.ok) {
        setSaveError(data.error ?? "Error al guardar");
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      setSaveError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  if (loading || loadingSquad) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500 text-sm animate-pulse">Cargando...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-amber-500/70 uppercase tracking-widest">
                {DIVISION_LABELS[division] ?? division}
              </span>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="bg-transparent text-xl font-black text-white border-b border-zinc-700 focus:border-amber-500 outline-none pb-0.5 max-w-[200px]"
                maxLength={50}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className={`font-semibold tabular-nums ${overBudget ? "text-red-400" : "text-emerald-400"}`}>
              ${budget.toFixed(1)}M / ${BUDGET}M
            </div>
            <div className="text-zinc-400 font-medium">
              {squad.length}/{SQUAD_SIZE}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex gap-1 p-1 bg-zinc-900 rounded-lg border border-zinc-800 mb-6 max-w-sm">
          <button
            onClick={() => setActiveTab("available")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${
              activeTab === "available"
                ? "bg-amber-500 text-zinc-950"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Jugadores
          </button>
          <button
            onClick={() => setActiveTab("squad")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${
              activeTab === "squad"
                ? "bg-amber-500 text-zinc-950"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Mi Equipo ({squad.length}/{SQUAD_SIZE})
          </button>
        </div>

        {activeTab === "available" && (
          <div>
            {/* Search + filter */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <input
                type="text"
                placeholder="Buscar jugador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex gap-2 flex-wrap mb-5">
              <button
                onClick={() => setClubFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  clubFilter === "all"
                    ? "bg-amber-500 text-zinc-950 border-amber-500"
                    : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                Todos
              </button>
              {clubSlugs.map((slug) => (
                <button
                  key={slug}
                  onClick={() => setClubFilter(slug)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    clubFilter === slug
                      ? "bg-amber-500 text-zinc-950 border-amber-500"
                      : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {clubNames[slug] ?? slug}
                </button>
              ))}
            </div>

            {/* Player list */}
            <div className="grid gap-2">
              {filteredPlayers.map((player) => {
                const inSquad = squadIds.has(player.id);
                const addable = canAdd(player);
                const clubCount = clubCounts[player.clubSlug] ?? 0;
                const clubFull = clubCount >= MAX_PER_CLUB && !inSquad;
                return (
                  <button
                    key={player.id}
                    onClick={() => togglePlayer(player)}
                    disabled={!inSquad && !addable}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                      inSquad
                        ? "bg-amber-500/10 border-amber-500/50 hover:bg-amber-500/20"
                        : addable
                        ? "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                        : "bg-zinc-900/50 border-zinc-800/50 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white truncate">{player.name}</span>
                        {inSquad && (
                          <span className="text-[10px] font-bold bg-amber-500 text-zinc-950 px-1.5 rounded">
                            EN EQUIPO
                          </span>
                        )}
                        {captainId === player.id && (
                          <span className="text-[10px] font-black bg-amber-500 text-zinc-950 px-1.5 rounded">C</span>
                        )}
                        {viceCaptainId === player.id && (
                          <span className="text-[10px] font-black bg-amber-400/30 text-amber-400 border border-amber-500/50 px-1.5 rounded">VC</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-zinc-500">{player.clubName}</span>
                        {clubFull && <span className="text-xs text-red-400">Club lleno</span>}
                        <span className="text-xs text-zinc-600">
                          {player.stats.tries}T · {player.stats.conversions}C · {player.stats.penalties}P · {player.stats.matches}PJ
                        </span>
                      </div>
                    </div>
                    <div className="text-amber-400 font-black text-sm tabular-nums">${player.price.toFixed(1)}M</div>
                  </button>
                );
              })}
              {allPlayers.length === 0 ? (
                <div className="text-center py-16 text-zinc-600 text-sm space-y-2">
                  <p className="text-zinc-400 font-semibold">Datos de {DIVISION_LABELS[division]} no disponibles aún</p>
                  <p>Los datos de jugadores de esta categoría se agregarán próximamente.</p>
                </div>
              ) : filteredPlayers.length === 0 ? (
                <p className="text-center text-zinc-600 py-10 text-sm">No hay jugadores que coincidan</p>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === "squad" && (
          <div>
            {squad.length === 0 ? (
              <div className="text-center py-16 text-zinc-600 text-sm">
                <p className="mb-4">Tu equipo está vacío.</p>
                <button
                  onClick={() => setActiveTab("available")}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm transition-colors"
                >
                  Agregar jugadores
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 mb-3">
                  Toca el nombre del jugador para asignar Capitán (C) o Vice-Capitán (VC). Toca × para quitar.
                </p>
                {squad.map((player, i) => {
                  const state = getCaptainState(player.id);
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                        state === "captain"
                          ? "bg-amber-500/10 border-amber-500/50"
                          : state === "vice"
                          ? "bg-amber-400/5 border-amber-400/30"
                          : "bg-zinc-900 border-zinc-800"
                      }`}
                    >
                      <span className="text-zinc-600 text-xs w-5 text-right">{i + 1}</span>
                      <button
                        onClick={() => cycleCaptain(player.id)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white truncate">{player.name}</span>
                          {state === "captain" && (
                            <span className="text-[10px] font-black bg-amber-500 text-zinc-950 px-1.5 rounded shrink-0">C</span>
                          )}
                          {state === "vice" && (
                            <span className="text-[10px] font-black bg-amber-400/20 text-amber-400 border border-amber-500/40 px-1.5 rounded shrink-0">VC</span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">{player.clubName}</div>
                      </button>
                      <span className="text-amber-400 font-semibold text-sm tabular-nums">${player.price.toFixed(1)}M</span>
                      <button
                        onClick={() => removeFromSquad(player.id)}
                        className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-red-900/50 hover:text-red-400 text-zinc-500 flex items-center justify-center text-xs font-bold transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky bottom save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 px-4 py-4">
        <div className="max-w-5xl mx-auto flex flex-col gap-2">
          {(validationError || saveError) && (
            <p className="text-red-400 text-xs text-center">{saveError ?? validationError}</p>
          )}
          {saveSuccess && (
            <p className="text-emerald-400 text-xs text-center">Equipo guardado correctamente</p>
          )}
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full py-3.5 rounded-lg font-black text-base transition-colors ${
              canSave
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
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
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <FantasyTeamInner />
    </Suspense>
  );
}
