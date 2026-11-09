"use client";

import { useEffect, useState } from "react";

/**
 * El reloj, pero recién DESPUÉS de montar.
 *
 * Las pantallas del seven son estáticas (ISR): si leyeran `Date.now()` durante
 * el render, el HTML generado por el servidor afirmaría una hora distinta a la
 * del visitante y la hidratación no calzaría. Mientras no monta devuelve null y
 * quien lo use no dice nada sobre "ahora".
 *
 * Por defecto se despierta cada 30 s: en el seven hay un partido cada veinte
 * minutos, así que no hace falta más fino para pasar de "programado" a "en
 * vivo".
 */
export function useAhora(cadaMs = 30_000): number | null {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), cadaMs);
    return () => clearInterval(t);
  }, [cadaMs]);
  return ahora;
}

/** "2026-11-07" en hora de Chile, a partir del reloj de `useAhora`. */
export function hoyEnChile(ahora: number | null): string | null {
  return ahora == null ? null : new Date(ahora - 3 * 60 * 60_000).toISOString().slice(0, 10);
}
