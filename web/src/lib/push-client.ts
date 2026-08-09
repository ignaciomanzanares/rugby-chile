const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// iOS solo permite push cuando la PWA está instalada (agregada a inicio).
export function iosNeedsInstall(): boolean {
  if (typeof navigator === "undefined") return false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIOS && !standalone;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Devuelve la suscripción del navegador, creándola (permiso + VAPID) si falta. */
export async function ensureSubscription(): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Diste permiso denegado a las notificaciones.");
  const res = await fetch(`${API_URL}/api/v1/push/public-key`);
  const { key, enabled } = await res.json();
  if (!enabled || !key) throw new Error("El servidor todavía no tiene push configurado.");
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });
}

export async function getFollowedClubs(endpoint: string): Promise<string[]> {
  try {
    const r = await fetch(`${API_URL}/api/v1/push/preferences?endpoint=${encodeURIComponent(endpoint)}`);
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.clubs) ? d.clubs : [];
  } catch {
    return [];
  }
}

export async function setClubFollow(sub: PushSubscription, clubSlug: string, on: boolean): Promise<void> {
  await fetch(`${API_URL}/api/v1/push/club`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ subscription: sub.toJSON(), clubSlug, on }),
  });
}

// Mensaje amable para el error típico de Brave (bloquea el servicio de push).
export function pushErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (/push service|AbortError|registration failed/i.test(msg)) {
    return "Tu navegador bloqueó el push. Si usás Brave: brave://settings/privacy → activá “Use Google services for push messaging”, reiniciá y reintentá. En el celular (app instalada) funciona sin esto.";
  }
  return msg || "No se pudo activar.";
}
