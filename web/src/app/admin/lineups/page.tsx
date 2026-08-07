"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Trash2, Users, ImageUp, Loader2 } from "lucide-react";
import { nextFechaNumber, ROUNDS, type DivisionKey } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Redimensiona la foto en el cliente (máx 1500px, JPEG) antes de subirla: baja
// el peso del request y el costo del modelo. `imageOrientation:"from-image"`
// respeta la rotación EXIF de las fotos de celular (iOS).
async function fileToResizedDataUrl(file: File, maxDim = 1500, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() =>
    createImageBitmap(file),
  );
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

const DIVISIONS = [
  { key: "PRIMERA",        label: "Primera" },
  { key: "INTERMEDIA",     label: "Intermedia" },
  { key: "PRE_INTERMEDIA", label: "Pre-Intermedia" },
];

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
  const [photoStatus, setPhotoStatus] = useState<"idle" | "reading" | "error">("idle");
  const [photoError, setPhotoError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Merge: solo pisa un casillero cuando la fuente trae un nombre, así una
  // lectura parcial no borra lo que ya completaste a mano.
  const fill = (ps: string[], pss: string[]) => {
    onStartersChange(starters.map((cur, i) => ps[i] || cur));
    onSubsChange(subs.map((cur, i) => pss[i] || cur));
  };

  const readPhoto = async (file: File) => {
    setPhotoStatus("reading");
    setPhotoError("");
    try {
      const image = await fileToResizedDataUrl(file);
      const r = await fetch(`${API_URL}/api/v1/lineups/parse-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ image }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "No se pudo leer la foto");
      fill(data.starters ?? [], data.subs ?? []);
      setPhotoStatus("idle");
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "Error leyendo la foto");
      setPhotoStatus("error");
    }
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

      {/* Autocompletar: foto (visión) o pegar texto — después se edita a mano. */}
      <div className="mb-3 rounded-lg border border-dashed border-border bg-muted/30 p-2.5">
        {/* Foto de la nómina → autocompletar */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readPhoto(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={photoStatus === "reading"}
          className="w-full inline-flex items-center justify-center gap-2 px-2.5 py-2 rounded-md bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
        >
          {photoStatus === "reading" ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo foto…</>
          ) : (
            <><ImageUp className="h-3.5 w-3.5" /> Leer de una foto</>
          )}
        </button>
        <p className="text-[10px] text-muted-foreground mt-1">
          Sube la foto de la nómina y se llena solo · después revisas y corriges a mano
        </p>
        {photoStatus === "error" && <p className="text-[10px] text-red-400 mt-1">{photoError}</p>}
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
  const [round, setRound] = useState<number>(() => nextFechaNumber());
  const firstMatch = ROUNDS.PRIMERA.find((r) => r.round === nextFechaNumber())?.matches[0];
  const [homeTeam, setHomeTeam] = useState(firstMatch?.home ?? "COBS");
  const [awayTeam, setAwayTeam] = useState(firstMatch?.away ?? "Old Boys");

  // Partidos reales de la fecha/división elegida: solo se puede editar la
  // formación de un cruce que existe en el fixture (no inventar partidos).
  const fixtures = ROUNDS[division as DivisionKey]?.find((r) => r.round === round)?.matches ?? [];

  // Al cambiar de fecha o división, apuntá al primer partido válido del fixture
  // si el cruce actual no existe en esa fecha.
  useEffect(() => {
    if (fixtures.length === 0) return;
    if (!fixtures.some((m) => m.home === homeTeam && m.away === awayTeam)) {
      setHomeTeam(fixtures[0].home);
      setAwayTeam(fixtures[0].away);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [division, round]);

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
            <p className="text-muted-foreground text-xs">Carga las formaciones antes de cada fecha — pega la nómina y ajusta</p>
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
              {(ROUNDS[division as DivisionKey] ?? []).map((r) => (
                <option key={r.round} value={r.round}>Fecha {r.round}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Partido</label>
            <select
              className={selectClass}
              value={fixtures.some((m) => m.home === homeTeam && m.away === awayTeam) ? `${homeTeam}___${awayTeam}` : ""}
              onChange={(e) => {
                const [h, a] = e.target.value.split("___");
                setHomeTeam(h);
                setAwayTeam(a);
              }}
              disabled={fixtures.length === 0}
            >
              {fixtures.length === 0 && <option value="">Sin partidos en esta fecha</option>}
              {fixtures.map((m) => (
                <option key={`${m.home}___${m.away}`} value={`${m.home}___${m.away}`}>
                  {m.home} vs {m.away}
                </option>
              ))}
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
            <span className="self-center text-xs text-muted-foreground">No hay formación guardada — completa los datos y guarda</span>
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
