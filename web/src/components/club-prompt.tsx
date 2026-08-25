"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
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

// Banner "¿A qué club apoyás?" para usuarios logueados que todavía no eligieron
// club (los que se registraron antes de que se guardara). Se oculta solo cuando
// ya tienen uno.
export function ClubPrompt() {
  const { user, setClub } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!user || user.clubSlug || done) return null;

  async function pick(slug: string) {
    setSaving(slug);
    try { await setClub(slug); setDone(true); }
    catch { setSaving(null); }
  }

  return (
    <div className="rounded-2xl border border-red-600/30 bg-gradient-to-br from-red-600/10 to-transparent p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Heart className="h-4 w-4 text-red-500" />
        <h3 className="font-black text-sm uppercase tracking-wide">¿A qué club apoyás?</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Elegí tu club para personalizar tu experiencia. Podés cambiarlo cuando quieras.</p>
      <div className="grid grid-cols-5 gap-2">
        {CLUBS.map((c) => (
          <button key={c.slug} onClick={() => pick(c.slug)} disabled={!!saving} title={c.label}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors ${saving === c.slug ? "border-red-500 bg-red-500/10" : "border-border bg-card hover:border-red-500/50"} disabled:opacity-60`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/clubs/${c.slug}.jpg`} alt="" className="w-9 h-9 rounded-full object-cover bg-white"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
            <span className="text-[9px] font-semibold text-center leading-tight">{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
