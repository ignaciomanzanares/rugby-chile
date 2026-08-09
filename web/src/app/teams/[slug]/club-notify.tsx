"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import {
  pushSupported,
  iosNeedsInstall,
  getExistingSubscription,
  ensureSubscription,
  getFollowedClubs,
  setClubFollow,
  pushErrorMessage,
} from "@/lib/push-client";

/** Botón para seguir/dejar las notificaciones de un club puntual. */
export function ClubNotifyButton({ clubSlug, clubName }: { clubSlug: string; clubName: string }) {
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok = pushSupported();
    setSupported(ok);
    setNeedsInstall(iosNeedsInstall());
    if (!ok) { setReady(true); return; }
    getExistingSubscription()
      .then(async (sub) => {
        if (sub) {
          const clubs = await getFollowedClubs(sub.endpoint);
          setFollowing(clubs.includes(clubSlug));
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [clubSlug]);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const sub = await ensureSubscription();
      await setClubFollow(sub, clubSlug, !following);
      setFollowing((f) => !f);
    } catch (e) {
      setError(pushErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  if (needsInstall) {
    return (
      <p className="mt-4 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 max-w-sm">
        En iPhone, primero instalá la app (Compartir → “Agregar a inicio”) para poder activar las notificaciones de {clubName}.
      </p>
    );
  }
  if (!supported) return null;

  return (
    <div className="mt-4">
      <button
        onClick={toggle}
        disabled={busy}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
          following
            ? "border border-amber-500/40 bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
            : "bg-amber-500 hover:bg-amber-400 text-zinc-950"
        }`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : following ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {following ? `Siguiendo a ${clubName} ✓` : `Activar notificaciones de ${clubName}`}
      </button>
      {following && (
        <p className="text-[11px] text-muted-foreground/70 mt-1.5">
          Recibís aviso cuando {clubName} arranca un partido y cuando termina. Tocá de nuevo para dejar de seguir.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-400 max-w-sm">{error}</p>}
    </div>
  );
}
