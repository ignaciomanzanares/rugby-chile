// Skeleton de ruta (Suspense boundary): Next lo muestra al instante mientras la
// página se renderiza/espera datos. Da feedback inmediato al navegar — sobre
// todo en la home (force-dynamic) que espera a la API — en vez de dejar la
// pantalla vieja congelada. Barra "en vivo" + grilla de tarjetas en pulse.
export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Tira superior tipo "en vivo / fixture" */}
      <div className="border-b border-border bg-card/40">
        <div className="container mx-auto px-4 py-4 flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 w-48 flex-shrink-0 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 grid gap-8 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-64 rounded-2xl bg-muted/50 animate-pulse" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        </div>

        {/* Columna lateral */}
        <div className="space-y-3">
          <div className="h-6 w-40 rounded bg-muted/50 animate-pulse" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
