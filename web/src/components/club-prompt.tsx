"use client";

import { useState, useEffect } from "react";
import { X, Heart, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";

const CLUBS = [
  { slug: "cobs", label: "COBS" },
  { slug: "old-boys", label: "Old Boys" },
  { slug: "pwcc", label: "PWCC" },
  { slug: "old-macks", label: "Old Macks" },
  { slug: "stade-francais", label: "Stade Français" },
  { slug: "sporting-rc", label: "Sporting RC" },
  { slug: "dobs", label: "DOBS" },
  { slug: "uc", label: "UC" },
  { slug: "old-johns", label: "Old Johns" },
  { slug: "old-reds", label: "Old Reds" },
];

function ClubLogo({ slug, size = 36 }: { slug: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/clubs/${slug}.jpg`} alt="" style={{ width: size, height: size }}
    className="rounded-full object-cover bg-white"
    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />;
}

// Popup en el panel principal para usuarios logueados que todavía no eligieron
// club. Al elegir uno se guarda y el popup desaparece. Se puede cerrar sin
// elegir (vuelve a aparecer en otra sesión). El club se cambia luego en el perfil.
export function ClubPromptModal() {
  const { user, setClub } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(true); // true hasta chequear sessionStorage (evita flash)
  const [done, setDone] = useState(false);           // cierre inmediato al elegir

  useEffect(() => {
    setDismissed(sessionStorage.getItem("clubPromptDismissed") === "1");
  }, []);

  if (!user || user.clubSlug || dismissed || done) return null;

  const close = () => { try { sessionStorage.setItem("clubPromptDismissed", "1"); } catch { /* no-op */ } setDismissed(true); };

  async function pick(slug: string) {
    setSaving(slug);
    try { await setClub(slug); setDone(true); } // cierra al toque, sin depender del re-render del contexto
    catch { setSaving(null); }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={close}>
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={close} aria-label="Cerrar" className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        <div className="flex items-center gap-2 mb-1"><Heart className="h-5 w-5 text-red-500" /><h3 className="font-black text-lg tracking-tight">¿A qué club apoyas?</h3></div>
        <p className="text-sm text-muted-foreground mb-5">Elige tu club para personalizar tu experiencia. Puedes cambiarlo cuando quieras desde tu perfil.</p>
        <div className="grid grid-cols-5 gap-2">
          {CLUBS.map((c) => (
            <button key={c.slug} onClick={() => pick(c.slug)} disabled={!!saving} title={c.label}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors ${saving === c.slug ? "border-red-500 bg-red-500/10" : "border-border hover:border-red-500/50"} disabled:opacity-60`}>
              <ClubLogo slug={c.slug} />
              <span className="text-[9px] font-semibold text-center leading-tight">{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Selector de club para el perfil: muestra el actual y permite cambiarlo.
export function ClubSelect() {
  const { user, setClub } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);

  if (!user) return null;

  async function pick(slug: string) {
    if (user!.clubSlug === slug) return;
    setSaving(slug);
    try { await setClub(slug); } finally { setSaving(null); }
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {CLUBS.map((c) => {
        const active = user.clubSlug === c.slug;
        return (
          <button key={c.slug} onClick={() => pick(c.slug)} disabled={!!saving} title={c.label}
            className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors ${active ? "border-red-500 bg-red-500/10" : "border-border hover:border-red-500/50"} disabled:opacity-60`}>
            {active && <span className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center"><Check className="h-2.5 w-2.5" /></span>}
            <ClubLogo slug={c.slug} size={32} />
            <span className="text-[9px] font-semibold text-center leading-tight">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
