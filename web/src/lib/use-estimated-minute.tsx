"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveMatch } from "@/lib/socket";

/**
 * Estima el reloj del partido en el cliente.
 *
 * El minuto lo fija el scorer a mano y sólo cambia cuando registra algo, así que
 * entre actualizaciones se queda PEGADO (p. ej. clavado en 33'). Acá lo hacemos
 * AVANZAR ~1 minuto por minuto, anclado al último minuto real recibido del
 * backend. Cuando llega un dato nuevo (evento/cambio de estado) se re-ancla, así
 * que la estimación se corrige sola y nunca se aleja de lo que marca el scorer.
 *
 * - Sólo corre en LIVE. En el ENTRETIEMPO (HT), al terminar (FINISHED) o antes
 *   del inicio (SCHEDULED) se CONGELA: el reloj de juego no avanza en el descanso.
 *   Por eso la duración del entretiempo (10–15') no se hardcodea: el reloj se
 *   reanuda cuando el scorer vuelve a poner el partido EN VIVO en la 2ª mitad.
 * - Tope por mitad (40'/80') + unos minutos de descuento, para no irse de largo
 *   si el scorer olvidó marcar el descanso o el final.
 */
const ADDED_TIME_MIN = 6; // descuento tolerado sobre 40'/80' en la estimación

export function useEstimatedMinute(minute: number, status: LiveMatch["status"]): number {
  const [display, setDisplay] = useState(minute);
  // `at: 0` = aún sin anclar (Date.now() es impuro y no puede llamarse en render).
  const anchor = useRef({ minute, at: 0 });

  // Re-anclar cuando el backend manda un minuto/estado nuevo (sólo toca el ref).
  useEffect(() => {
    anchor.current = { minute, at: Date.now() };
  }, [minute, status]);

  // Avanzar el reloj sólo mientras está EN VIVO. El setState vive dentro del
  // callback del intervalo (asíncrono) → sin renders en cascada.
  useEffect(() => {
    if (status !== "LIVE") return;
    const id = setInterval(() => {
      const { minute: base, at } = anchor.current;
      if (!at) return; // todavía sin anclar
      const elapsed = Math.floor((Date.now() - at) / 60000);
      const cap = (base < 40 ? 40 : 80) + ADDED_TIME_MIN;
      setDisplay(Math.min(base + elapsed, cap));
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // Fuera de LIVE devolvemos el dato real del backend (congelado, sin estimar).
  return status === "LIVE" ? display : minute;
}

/**
 * Muestra el minuto en vivo ya estimado y corriendo (p. ej. "33'"). Es un
 * componente —no un hook— para poder usarlo dentro de un map (ticker) sin romper
 * las reglas de hooks.
 */
export function LiveMinute({
  minute,
  status,
  suffix = "'",
}: {
  minute: number;
  status: LiveMatch["status"];
  suffix?: string;
}) {
  const m = useEstimatedMinute(minute, status);
  return <>{m}{suffix}</>;
}
