"use client";

import { useEffect } from "react";

// Registra el service worker (/sw.js) en todos los clientes para habilitar la
// caché offline. La suscripción a push es aparte (opt-in con un botón).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    };
    // Cuando un SW nuevo toma control (tras un deploy), recarga una vez para que
    // la PWA no siga corriendo código viejo. Guard para evitar loops.
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);
  return null;
}
