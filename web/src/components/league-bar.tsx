"use client";

import { useEffect, useState } from "react";
import { Users, Plus, LogIn, Check, Copy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchMyLeagues, createLeague, joinLeague, type League } from "@/lib/leagues";

/**
 * Barra de ligas para los leaderboards (predicciones y fantasy). "General" =
 * todos los usuarios (sin filtro). El usuario logueado puede crear una liga o
 * unirse con un código; al elegir una liga el leaderboard se filtra a sus
 * miembros. `value`=null es la general.
 */
export function LeagueBar({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [modal, setModal] = useState<null | "create" | "join">(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) { setLeagues([]); return; }
    fetchMyLeagues().then(setLeagues);
  }, [user]);

  const selected = value ? leagues.find((l) => l.id === value) : null;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const lg = modal === "create" ? await createLeague(name.trim()) : await joinLeague(code.trim());
      const fresh = await fetchMyLeagues();
      setLeagues(fresh);
      onChange(lg.id);
      setModal(null);
      setName("");
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal");
    } finally {
      setBusy(false);
    }
  }

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
      active ? "bg-amber-600 text-white" : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
    }`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Users className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <button onClick={() => onChange(null)} className={chip(value === null)}>General</button>
        {leagues.map((l) => (
          <button key={l.id} onClick={() => onChange(l.id)} className={chip(value === l.id)}>
            {l.name}{l.members ? ` · ${l.members}` : ""}
          </button>
        ))}
        {user && (
          <>
            <button onClick={() => { setModal("create"); setError(""); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-amber-400 border border-amber-600/40 hover:bg-amber-600/10 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Crear
            </button>
            <button onClick={() => { setModal("join"); setError(""); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-muted-foreground border border-border hover:text-foreground hover:border-foreground/30 transition-colors">
              <LogIn className="h-3.5 w-3.5" /> Unirse
            </button>
          </>
        )}
      </div>

      {/* Código de la liga seleccionada (para compartir) */}
      {selected && (
        <button
          onClick={() => { navigator.clipboard?.writeText(selected.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Copiar código para invitar"
        >
          Código: <span className="font-mono font-bold tracking-widest text-amber-400">{selected.code}</span>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}

      {!user && (
        <p className="text-xs text-muted-foreground/70">Iniciá sesión para crear o unirte a una liga privada.</p>
      )}

      {/* Modal crear / unirse */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-foreground text-lg mb-1">{modal === "create" ? "Crear liga" : "Unirse a una liga"}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {modal === "create" ? "Ponle un nombre; te damos un código para invitar a tus amigos." : "Ingresa el código que te compartieron."}
            </p>
            {modal === "create" ? (
              <input
                autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
                placeholder="Ej: Los cracks del Top 10"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-amber-500 mb-1"
                onKeyDown={(e) => e.key === "Enter" && name.trim() && submit()}
              />
            ) : (
              <input
                autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12}
                placeholder="CÓDIGO"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground font-mono tracking-widest focus:outline-none focus:border-amber-500 mb-1"
                onKeyDown={(e) => e.key === "Enter" && code.trim() && submit()}
              />
            )}
            {error && <p className="text-xs text-red-400 mb-1">{error}</p>}
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 text-sm font-semibold transition-colors">Cancelar</button>
              <button
                onClick={submit}
                disabled={busy || (modal === "create" ? !name.trim() : !code.trim())}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {busy ? "…" : modal === "create" ? "Crear" : "Unirse"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
