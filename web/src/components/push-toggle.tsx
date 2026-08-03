"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Loader2, Share } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsInstall, setNeedsInstall] = useState(false); // iOS sin instalar

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    // iOS solo permite push si la PWA está instalada en la pantalla de inicio.
    if (isIOS && !standalone) setNeedsInstall(true);
    if (ok) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscribed(!!sub))
        .catch(() => {});
    }
  }, []);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Diste permiso denegado a las notificaciones.");
      const res = await fetch(`${API_URL}/api/v1/push/public-key`);
      const { key, enabled } = await res.json();
      if (!enabled || !key) throw new Error("El servidor todavía no tiene push configurado.");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await fetch(`${API_URL}/api/v1/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setSubscribed(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // Brave desactiva por defecto el servicio de push de Google → este error.
      if (/push service|AbortError|registration failed/i.test(msg)) {
        setError(
          "Tu navegador bloqueó el push. Si usas Brave: entra a brave://settings/privacy y activa “Use Google services for push messaging”, reinicia Brave y reintenta. En el celular (app instalada) funciona sin esto.",
        );
      } else {
        setError(msg || "No se pudo activar.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${API_URL}/api/v1/push/unsubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo desactivar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 md:p-6">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-amber-400/15 text-amber-400 flex items-center justify-center flex-shrink-0">
          {subscribed ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-foreground">Notificaciones</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Avisos cuando empieza un partido en vivo y resultados del torneo.
          </p>

          {needsInstall ? (
            <p className="mt-3 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 flex items-start gap-2">
              <Share className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                En iPhone, primero instala la app: toca <b>Compartir</b> y luego <b>“Agregar a inicio”</b>.
                Después vas a poder activar las notificaciones desde acá.
              </span>
            </p>
          ) : !supported ? (
            <p className="mt-3 text-xs text-muted-foreground">Tu navegador no soporta notificaciones push.</p>
          ) : (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                onClick={subscribed ? unsubscribe : subscribe}
                disabled={busy}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                  subscribed
                    ? "border border-border bg-muted hover:bg-secondary text-muted-foreground"
                    : "bg-amber-500 hover:bg-amber-400 text-zinc-950"
                }`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : subscribed ? <Bell className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
                {subscribed ? "Desactivar" : "Activar notificaciones"}
              </button>
              {subscribed && <span className="text-xs text-emerald-400 font-semibold">Activadas ✓</span>}
            </div>
          )}

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
