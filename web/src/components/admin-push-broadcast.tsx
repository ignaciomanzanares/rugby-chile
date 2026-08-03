"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Formulario admin para mandar una notificación push a todos los suscriptos.
export function AdminPushBroadcast() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!title.trim()) return;
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/push/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, body, url: url || "/" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo enviar");
      setResult(`Enviadas: ${data.sent} · Expiradas limpiadas: ${data.pruned} · Total: ${data.total}`);
      setTitle("");
      setBody("");
      setUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-amber-500 transition-colors";

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-bold text-sm uppercase tracking-widest">Enviar notificación</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Push a todos los que activaron avisos</p>
      </div>
      <div className="p-5 space-y-3">
        <input className={input} placeholder="Título (ej: Final del partido)" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        <input className={input} placeholder="Mensaje (ej: Old Reds 24 - 17 DOBS)" value={body} maxLength={140} onChange={(e) => setBody(e.target.value)} />
        <input className={input} placeholder="Link (opcional, ej: /live)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={send}
            disabled={busy || !title.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
          </button>
          {result && <span className="text-xs text-emerald-400">{result}</span>}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </div>
    </div>
  );
}
