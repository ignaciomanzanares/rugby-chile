"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
};

// Modal de confirmación con el estilo del sitio (reemplaza al confirm() del
// navegador). Controlado: se muestra cuando `state` no es null.
export function ConfirmDialog({ state, onClose }: { state: ConfirmState | null; onClose: () => void }) {
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!state) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
              state.danger ? "bg-red-600/15 text-red-400" : "bg-amber-400/15 text-amber-400"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-black text-base text-foreground">{state.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{state.message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border bg-muted hover:bg-secondary text-sm font-semibold text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors ${
              state.danger ? "bg-red-600 hover:bg-red-500" : "bg-amber-500 hover:bg-amber-400 text-zinc-950"
            }`}
          >
            {state.confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
