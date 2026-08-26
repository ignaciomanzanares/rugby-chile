"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

// Evento beforeinstallprompt (Chrome/Android): permite disparar el instalador nativo.
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "top10_install_dismissed";

// Banner "Instala Top 10" para la PWA. Solo en MÓVIL, solo si NO está ya instalada.
// Android/Chrome: botón que dispara el instalador nativo (beforeinstallprompt).
// iOS/Safari: no hay ese evento → muestra el paso a paso (Compartir → Añadir).
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Ya instalada (abierta como app) → nunca mostrar.
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Solo móvil (pantalla chica / puntero táctil).
    const isMobile = window.matchMedia("(max-width: 768px)").matches || window.matchMedia("(pointer: coarse)").matches;
    if (!isMobile) return;

    // Ya lo cerró antes → respetarlo por 14 días.
    try {
      const d = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (d && Date.now() - d < 14 * 24 * 60 * 60 * 1000) return;
    } catch { /* no-op */ }

    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (ios) {
      setIsIOS(true);
      setShow(true); // iOS no dispara beforeinstallprompt → mostramos instrucciones
      return;
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* no-op */ }
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setDeferred(null);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="border-b border-red-600/20 bg-red-600/5">
      <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-red-600/15 text-red-500 flex items-center justify-center flex-shrink-0">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground leading-tight">Instala Top 10</p>
          {isIOS ? (
            <p className="text-xs text-muted-foreground leading-tight flex items-center gap-1 flex-wrap">
              Toca <Share className="h-3 w-3 inline" /> Compartir y luego <b className="font-semibold">Añadir a inicio</b>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground leading-tight">Acceso directo desde tu pantalla de inicio, más rápido y sin navegador</p>
          )}
        </div>
        {!isIOS && (
          <button onClick={install}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors">
            <Download className="h-4 w-4" /> Instalar
          </button>
        )}
        <button onClick={close} aria-label="Cerrar" className="flex-shrink-0 text-muted-foreground hover:text-foreground p-1">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
