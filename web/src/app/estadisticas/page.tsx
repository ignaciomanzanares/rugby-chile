import { Suspense } from "react";
import { EstadisticasView } from "@/components/season/estadisticas-view";

// La vista vive aparte porque también se usa como pestaña de /temporada.
// El Suspense es obligatorio: la vista lee la categoría abierta de la URL
// (useSearchParams) y sin él Next no puede prerenderizar la página.
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <EstadisticasView />
    </Suspense>
  );
}
