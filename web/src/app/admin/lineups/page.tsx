"use client";

import { useState } from "react";
import { Save, Trash2, Users, Wand2 } from "lucide-react";

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
const ROUNDS = Array.from({ length: 18 }, (_, i) => i + 1);

const POSITIONS = [
  "1. Pilar izquierdo", "2. Talonador", "3. Pilar derecho",
  "4. Segundo línea", "5. Segundo línea",
  "6. Ala ciega", "7. Ala abierta", "8. Octavo",
  "9. Medio scrum", "10. Apertura",
  "11. Ala izquierdo", "12. Centro", "13. Centro",
  "14. Ala derecho", "15. Zaguero",
];

const inputClass = "w-full bg-muted border border-border rounded px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-red-500";
const selectClass = "w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-red-500";

// Parse a free-form nómina pasted from anywhere (a club's post, a message, a
// PDF…) into 15 starters + 8 subs. Handles numbered lists ("1. Juan Pérez",
// "9) Pedro Soto", "12 - Ana Rojas") on separate lines or split by "/" or ";",
// and falls back to sequential order when the text has no numbers.
export function parseLineupText(raw: string): { starters: string[]; subs: string[] } {
  const starters = Array(15).fill("");
  const subs = Array(8).fill("");
  const chunks = raw.split(/[\n;/]+/).map((s) => s.trim()).filter(Boolean);

  const place = (jersey: number, name: string) => {
    const clean = name.replace(/\s+/g, " ").trim();
    if (!clean) return;
    if (jersey >= 1 && jersey <= 15) starters[jersey - 1] = clean;
    else if (jersey >= 16 && jersey <= 23) subs[jersey - 16] = clean;
  };

  // Collect entries that start with a jersey number (1-23).
  const numbered: Array<[number, string]> = [];
  for (const c of chunks) {
    const m = c.match(/^(\d{1,2})\s*[.)\-–:]\s*(.+)$/) || c.match(/^(\d{1,2})\s+(\D.+)$/);
    if (m) {
      const j = Number(m[1]);
      if (j >= 1 && j <= 23) numbered.push([j, m[2]]);
    }
  }

  if (numbered.length >= 5) {
    for (const [j, n] of numbered) place(j, n);
  } else {
    // No reliable numbering — take the chunks in order, stripping any stray prefix.
    chunks.forEach((c, i) => place(i + 1, c.replace(/^\d{1,2}\s*[.)\-–:]?\s*/, "")));
  }

  return { starters, subs };
}

function LineupEditor({
  label,
  starters,
  subs,
  sourceUrl,
  onStartersChange,
  onSubsChange,
  onSourceUrlChange,
}: {
  label: string;
  starters: string[];
  subs: string[];
  sourceUrl: string;
  onStartersChange: (v: string[]) => void;
  onSubsChange: (v: string[]) => void;
  onSourceUrlChange: (v: string) => void;
}) {
  const [pasteText, setPasteText] = useState("");

  const applyPaste = () => {
    if (!pasteText.trim()) return;
    const { starters: ps, subs: pss } = parseLineupText(pasteText);
    // Only overwrite a slot when the paste actually provided a name, so a
    // partial paste doesn't wipe fields you already filled.
    onStartersChange(starters.map((cur, i) => ps[i] || cur));
    onSubsChange(subs.map((cur, i) => pss[i] || cur));
  };

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
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">{label}</p>

      {/* Paste-and-parse: the fast path — dump the whole nómina, then tweak. */}
      <div className="mb-3 rounded-lg border border-dashed border-border bg-muted/30 p-2.5">
        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
          Pegar nómina
        </label>
        <textarea
          className={`${inputClass} h-20 resize-y font-mono`}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"Pegá la formación completa, ej:\n1. Juan Pérez\n2. Pedro Soto\n…\no  1. Juan Pérez / 2. Pedro Soto / 3. …"}
        />
        <div className="flex items-center gap-2 mt-1.5">
          <button
            type="button"
            onClick={applyPaste}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
          >
            <Wand2 className="h-3.5 w-3.5" /> Rellenar campos
          </button>
          <span className="text-[10px] text-muted-foreground">Rellena los 15+8 · después podés editar a mano</span>
        </div>
      </div>

      <div className="space-y-1 mb-3">
        {POSITIONS.map((pos, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/70 w-28 flex-shrink-0">{pos}</span>
            <input
              className={inputClass}
              value={starters[i] ?? ""}
              onChange={(e) => updateStarter(i, e.target.value)}
              placeholder="Nombre jugador"
            />
          </div>
        ))}
      </div>
      <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-1">Suplentes</p>
      <div className="space-y-1 mb-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/70 w-6 flex-shrink-0">{i + 16}.</span>
            <input
              className={inputClass}
              value={subs[i] ?? ""}
              onChange={(e) => updateSub(i, e.target.value)}
              placeholder="Nombre jugador"
            />
          </div>
        ))}
      </div>

      <label className="block text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-1">
        URL de la fuente (opcional)
      </label>
      <input
        className={inputClass}
        value={sourceUrl}
        onChange={(e) => onSourceUrlChange(e.target.value)}
        placeholder="Link al post público del club (referencia)"
      />
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
  const [homeSourceUrl, setHomeSourceUrl] = useState("");
  const [awaySourceUrl, setAwaySourceUrl] = useState("");

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
        setHomeSourceUrl("");
        setAwaySourceUrl("");
        setLoadStatus("not_found");
        return;
      }
      setHomeStarters(data.homeStarters ?? emptyStarters());
      setHomeSubs(data.homeSubs ?? emptySubs());
      setAwayStarters(data.awayStarters ?? emptyStarters());
      setAwaySubs(data.awaySubs ?? emptySubs());
      setHomeSourceUrl(data.homeSourceUrl ?? "");
      setAwaySourceUrl(data.awaySourceUrl ?? "");
      setLoadStatus("idle");
    } catch {
      setLoadStatus("not_found");
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
          homeSourceUrl: homeSourceUrl.trim() || null,
          awaySourceUrl: awaySourceUrl.trim() || null,
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
      setHomeSourceUrl("");
      setAwaySourceUrl("");
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
            <p className="text-muted-foreground text-xs">Carga las formaciones antes de cada fecha — pegá la nómina y ajustá</p>
          </div>
        </div>
      </div>

      {/* Match selector */}
      <div className="rounded-xl border border-border bg-card/50 p-5 mb-6">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Seleccionar partido</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">División</label>
            <select className={selectClass} value={division} onChange={(e) => setDivision(e.target.value)}>
              {DIVISIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Fecha</label>
            <select className={selectClass} value={round} onChange={(e) => setRound(Number(e.target.value))}>
              {ROUNDS.map((r) => <option key={r} value={r}>Fecha {r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Local</label>
            <select className={selectClass} value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)}>
              {CLUBS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Visitante</label>
            <select className={selectClass} value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)}>
              {CLUBS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadLineup}
            disabled={loadStatus === "loading"}
            className="px-4 py-2 rounded-lg bg-muted hover:bg-secondary border border-border text-sm font-semibold text-foreground/80 transition-colors disabled:opacity-50"
          >
            {loadStatus === "loading" ? "Cargando…" : "Cargar formación existente"}
          </button>
          {loadStatus === "not_found" && (
            <span className="self-center text-xs text-muted-foreground">No hay formación guardada — completá los datos y guardá</span>
          )}
        </div>
      </div>

      {/* Lineup editors */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <LineupEditor
            label={`Local: ${homeTeam}`}
            starters={homeStarters}
            subs={homeSubs}
            sourceUrl={homeSourceUrl}
            onStartersChange={setHomeStarters}
            onSubsChange={setHomeSubs}
            onSourceUrlChange={setHomeSourceUrl}
          />
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <LineupEditor
            label={`Visitante: ${awayTeam}`}
            starters={awayStarters}
            subs={awaySubs}
            sourceUrl={awaySourceUrl}
            onStartersChange={setAwayStarters}
            onSubsChange={setAwaySubs}
            onSourceUrlChange={setAwaySourceUrl}
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
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:border-red-700 text-muted-foreground hover:text-red-400 font-semibold text-sm transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar
        </button>
        {status === "error" && <span className="self-center text-xs text-red-400">Error al guardar. ¿Estás logueado como admin?</span>}
      </div>
    </div>
  );
}
