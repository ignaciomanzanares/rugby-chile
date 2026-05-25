"use client";

import { useState } from "react";
import { Save, Trash2, Users, RefreshCw } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const CLUBS = [
  "COBS", "Old Boys", "PWCC", "Old Macks", "Stade Francais",
  "Sporting RC", "DOBS", "UC", "Old Johns", "Old Reds",
];
const DIVISIONS = [
  { key: "PRIMERA",        label: "Primera" },
  { key: "INTERMEDIA",     label: "Intermedia" },
  { key: "PRE_INTERMEDIA", label: "Pre-Intermedia" },
];
const ROUNDS = Array.from({ length: 9 }, (_, i) => i + 1);

const POSITIONS = [
  "1. Pilar izquierdo", "2. Talonador", "3. Pilar derecho",
  "4. Segundo línea", "5. Segundo línea",
  "6. Ala ciega", "7. Ala abierta", "8. Octavo",
  "9. Medio scrum", "10. Apertura",
  "11. Ala izquierdo", "12. Centro", "13. Centro",
  "14. Ala derecho", "15. Zaguero",
];

const inputClass = "w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500";
const selectClass = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500";

function LineupEditor({
  label,
  starters,
  subs,
  onStartersChange,
  onSubsChange,
}: {
  label: string;
  starters: string[];
  subs: string[];
  onStartersChange: (v: string[]) => void;
  onSubsChange: (v: string[]) => void;
}) {
  const updateStarter = (i: number, val: string) => {
    const next = [...starters];
    next[i] = val;
    onStartersChange(next);
  };
  const updateSub = (i: number, val: string) => {
    const next = [...subs];
    next[i] = val;
    onSubsChange(next);
  };

  return (
    <div>
      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">{label}</p>
      <div className="space-y-1 mb-3">
        {POSITIONS.map((pos, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 w-28 flex-shrink-0">{pos}</span>
            <input
              className={inputClass}
              value={starters[i] ?? ""}
              onChange={(e) => updateStarter(i, e.target.value)}
              placeholder="Nombre jugador"
            />
          </div>
        ))}
      </div>
      <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Suplentes</p>
      <div className="space-y-1">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 w-6 flex-shrink-0">{i + 16}.</span>
            <input
              className={inputClass}
              value={subs[i] ?? ""}
              onChange={(e) => updateSub(i, e.target.value)}
              placeholder="Nombre jugador"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LineupsAdminPage() {
  const [division, setDivision] = useState("PRIMERA");
  const [round, setRound] = useState(5);
  const [homeTeam, setHomeTeam] = useState("COBS");
  const [awayTeam, setAwayTeam] = useState("Old Boys");

  const emptyStarters = () => Array(15).fill("");
  const emptySubs = () => Array(8).fill("");

  const [homeStarters, setHomeStarters] = useState<string[]>(emptyStarters());
  const [homeSubs, setHomeSubs] = useState<string[]>(emptySubs());
  const [awayStarters, setAwayStarters] = useState<string[]>(emptyStarters());
  const [awaySubs, setAwaySubs] = useState<string[]>(emptySubs());

  const [crawlStatus, setCrawlStatus] = useState<"idle" | "loading" | "done">("idle");
  const [status, setStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "not_found">("idle");

  async function loadLineup() {
    setLoadStatus("loading");
    try {
      const r = await fetch(
        `${API_URL}/api/v1/lineups?division=${division}&round=${round}&home=${encodeURIComponent(homeTeam)}&away=${encodeURIComponent(awayTeam)}`,
        { credentials: "include" },
      );
      const data = await r.json();
      if (!data) {
        setHomeStarters(emptyStarters());
        setHomeSubs(emptySubs());
        setAwayStarters(emptyStarters());
        setAwaySubs(emptySubs());
        setLoadStatus("not_found");
        return;
      }
      setHomeStarters(data.homeStarters ?? emptyStarters());
      setHomeSubs(data.homeSubs ?? emptySubs());
      setAwayStarters(data.awayStarters ?? emptyStarters());
      setAwaySubs(data.awaySubs ?? emptySubs());
      setLoadStatus("idle");
    } catch {
      setLoadStatus("not_found");
    }
  }

  async function triggerCrawl() {
    setCrawlStatus("loading");
    try {
      await fetch(`${API_URL}/api/v1/lineups/crawl`, { method: "POST", credentials: "include" });
      setCrawlStatus("done");
      setTimeout(() => setCrawlStatus("idle"), 4000);
    } catch {
      setCrawlStatus("idle");
    }
  }

  async function save() {
    setStatus("loading");
    try {
      const r = await fetch(`${API_URL}/api/v1/lineups`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          division,
          round,
          homeTeam,
          awayTeam,
          homeStarters: homeStarters.filter(Boolean),
          homeSubs: homeSubs.filter(Boolean),
          awayStarters: awayStarters.filter(Boolean),
          awaySubs: awaySubs.filter(Boolean),
        }),
      });
      if (!r.ok) throw new Error();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  async function deleteLineup() {
    if (!confirm("¿Eliminar la formación de este partido?")) return;
    try {
      await fetch(
        `${API_URL}/api/v1/lineups?division=${division}&round=${round}&home=${encodeURIComponent(homeTeam)}&away=${encodeURIComponent(awayTeam)}`,
        { method: "DELETE", credentials: "include" },
      );
      setHomeStarters(emptyStarters());
      setHomeSubs(emptySubs());
      setAwayStarters(emptyStarters());
      setAwaySubs(emptySubs());
      setLoadStatus("not_found");
    } catch {
      alert("Error al eliminar");
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-red-500" />
          <div>
            <h1 className="text-xl font-black">Formaciones</h1>
            <p className="text-zinc-500 text-xs">Carga las formaciones antes de cada fecha</p>
          </div>
        </div>
        <button
          onClick={triggerCrawl}
          disabled={crawlStatus === "loading"}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-semibold text-zinc-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${crawlStatus === "loading" ? "animate-spin" : ""}`} />
          {crawlStatus === "loading" ? "Buscando en Instagram…" : crawlStatus === "done" ? "¡Iniciado!" : "Buscar en Instagram ahora"}
        </button>
      </div>

      {/* Match selector */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-6">
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Seleccionar partido</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">División</label>
            <select className={selectClass} value={division} onChange={(e) => setDivision(e.target.value)}>
              {DIVISIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Fecha</label>
            <select className={selectClass} value={round} onChange={(e) => setRound(Number(e.target.value))}>
              {ROUNDS.map((r) => <option key={r} value={r}>Fecha {r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Local</label>
            <select className={selectClass} value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)}>
              {CLUBS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Visitante</label>
            <select className={selectClass} value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)}>
              {CLUBS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadLineup}
            disabled={loadStatus === "loading"}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-semibold text-zinc-300 transition-colors disabled:opacity-50"
          >
            {loadStatus === "loading" ? "Cargando…" : "Cargar formación existente"}
          </button>
          {loadStatus === "not_found" && (
            <span className="self-center text-xs text-zinc-500">No hay formación guardada — completá los datos y guardá</span>
          )}
        </div>
      </div>

      {/* Lineup editors */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <LineupEditor
            label={`Local: ${homeTeam}`}
            starters={homeStarters}
            subs={homeSubs}
            onStartersChange={setHomeStarters}
            onSubsChange={setHomeSubs}
          />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <LineupEditor
            label={`Visitante: ${awayTeam}`}
            starters={awayStarters}
            subs={awaySubs}
            onStartersChange={setAwayStarters}
            onSubsChange={setAwaySubs}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={status === "loading"}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {status === "loading" ? "Guardando…" : status === "saved" ? "¡Guardado!" : "Guardar formación"}
        </button>
        <button
          onClick={deleteLineup}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-700 hover:border-red-700 text-zinc-400 hover:text-red-400 font-semibold text-sm transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar
        </button>
        {status === "error" && <span className="self-center text-xs text-red-400">Error al guardar. ¿Estás logueado como admin?</span>}
      </div>
    </div>
  );
}
