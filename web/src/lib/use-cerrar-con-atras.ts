"use client";

import { useCallback, useEffect, useRef } from "react";

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

  // Cuando el overlay se cierra PORQUE se está navegando (tocar un link del
  // menú), no hay que sacar la entrada: el `history.back()` de la limpieza
  // deshacía el salto y el link parecía no hacer nada. El componente avisa
  // llamando a esta función justo antes de cerrar.
  const alNavegar = useRef(false);
  const cerrandoPorNavegacion = useCallback(() => { alNavegar.current = true; }, []);

  useEffect(() => {
    if (!abierto || typeof window === "undefined") return;

    alNavegar.current = false;
    const marca = Date.now();
    const urlAlAbrir = window.location.href;
    window.history.pushState({ ...(window.history.state ?? {}), __overlay: marca }, "", urlAlAbrir);
    // Justo después de navegar, el router puede pisar la entrada que acabamos de
    // empujar con un replaceState suyo. Si pasó, no hay entrada nuestra que
    // sacar: se sigue cerrando con atrás, pero sin tocar el historial (mejor
    // quedarse corto que mandar al usuario a otra página).
    const nuestra = window.history.state?.__overlay === marca;

    let cerradoPorAtras = false;
    const onPop = () => { cerradoPorAtras = true; cerrarRef.current(); };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      if (cerradoPorAtras || alNavegar.current || !nuestra) return;
      // Si la dirección cambió, el overlay se cerró porque se navegó (por
      // ejemplo, un link adentro de la ficha): la entrada ya no es nuestra.
      if (window.location.href !== urlAlAbrir) return;
      if (window.history.state?.__overlay === marca) window.history.back();
    };
  }, [abierto]);

  return cerrandoPorNavegacion;
}
