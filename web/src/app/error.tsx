"use client";

// Error boundary de la app (Next lo monta cuando un Server/Client Component tira
// un error no capturado). Sin esto salía la pantalla de error cruda de Next.
import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Deja rastro en la consola del cliente para diagnóstico.
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/top10-itau-logo.png" alt="Top 10" className="h-20 w-auto object-contain mx-auto opacity-90" />
        <div>
          <h1 className="text-xl font-black">Algo salió mal</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Tuvimos un problema al cargar esto. Podés reintentar o volver al inicio.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border hover:border-foreground/40 text-foreground font-semibold text-sm transition-colors"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
