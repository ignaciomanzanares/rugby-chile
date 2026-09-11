"use client";

import { useEffect, useRef } from "react";

/**
 * Hace que el gesto de "atrás" cierre un overlay en vez de salir de la página.
 *
 * Una ficha, un modal o el menú abiertos son, para el usuario, una pantalla más:
 * espera que atrás lo devuelva a lo que estaba mirando. Como viven en estado de
 * React y no en la dirección, el navegador no tiene nada que deshacer y se lleva
 * la página entera por delante.
 *
 * El truco es duplicar la entrada actual del historial —misma URL y mismo
 * `history.state`, que en el App Router lleva los datos internos del router— y
 * marcarla. Así el atrás no cambia de ruta (no dispara navegación ni refetch),
 * solo emite `popstate`, y ahí cerramos. Si en cambio se cierra desde la UI (la
 * X, tocar afuera, Escape), sacamos esa entrada para no dejar un atrás fantasma.
 */
export function useCerrarConAtras(abierto: boolean, cerrar: () => void) {
  // La función de cerrar suele cambiar de identidad en cada render; con un ref
  // el efecto depende solo de `abierto` y no empuja entradas de más.
  const cerrarRef = useRef(cerrar);
  cerrarRef.current = cerrar;

  useEffect(() => {
    if (!abierto || typeof window === "undefined") return;

    const marca = Date.now();
    window.history.pushState({ ...(window.history.state ?? {}), __overlay: marca }, "", window.location.href);

    let cerradoPorAtras = false;
    const onPop = () => { cerradoPorAtras = true; cerrarRef.current(); };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      if (!cerradoPorAtras && window.history.state?.__overlay === marca) window.history.back();
    };
  }, [abierto]);
}
