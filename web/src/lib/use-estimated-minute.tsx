"use client";

import { useEffect, useState } from "react";
import type { LiveMatch } from "@/lib/socket";

/**
 * Estima el reloj del partido en el cliente.
 *
 * El minuto lo fija el scorer a mano y sólo cambia cuando registra algo, así que
 * entre actualizaciones se queda PEGADO (p. ej. clavado en 33'/43'). Acá lo
 * hacemos AVANZAR ~1 minuto por minuto, anclado al último minuto real recibido
 * del backend.
 *
 * El ancla vive en un store a nivel de módulo (keyed por matchId), no en el
 * estado del componente, para que SOBREVIVA re-montajes/re-renders provocados por
 * los `match:update` del socket — antes eso reseteaba el reloj y lo dejaba pegado.
 *
 * - Sólo corre EN VIVO. En el ENTRETIEMPO (HT), al finalizar (FINISHED) y antes
 *   del inicio (SCHEDULED) se CONGELA y se muestra el dato real del backend. Por
 *   eso la duración del descanso no se hardcodea: el reloj se reancla al volver a
 *   LIVE (2ª mitad).
 * - Re-ancla cuando el backend AVANZA el minuto o cambia de estado; NUNCA hacia
 *   atrás por un heartbeat que repite un minuto viejo (eso congelaba el reloj).
 * - Tope de cordura a 90' por si el scorer olvida marcar el final.
 */
type Anchor = { minute: number; at: number; status: LiveMatch["status"] };
const anchors = new Map<string, Anchor>();
const SANITY_CAP_MIN = 90;

export function useEstimatedMinute(
  matchId: string,
  minute: number,
  status: LiveMatch["status"],
): number {
  const [display, setDisplay] = useState(minute);

  // Mantener el ancla en el store (sólo escribe el ref del módulo → sin setState
  // síncrono → sin renders en cascada).
  useEffect(() => {
    const cur = anchors.get(matchId);
    if (!cur || cur.status !== status || minute > cur.minute) {
      anchors.set(matchId, { minute, at: Date.now(), status });
    }
  }, [matchId, minute, status]);

  // Avanzar el reloj sólo EN VIVO. setState vive en el callback del intervalo
  // (asíncrono); en el primer tick (~1s) corrige el valor desde el ancla, así que
  // un re-montaje se reengancha solo.
  useEffect(() => {
    if (status !== "LIVE") return;
    const id = setInterval(() => {
      const a = anchors.get(matchId);
      if (!a) return;
      const elapsed = Math.floor((Date.now() - a.at) / 60000);
      setDisplay(Math.min(a.minute + elapsed, SANITY_CAP_MIN));
    }, 1000);
    return () => clearInterval(id);
  }, [matchId, status]);

  // Fuera de LIVE devolvemos el dato real del backend (congelado, sin estimar).
  return status === "LIVE" ? display : minute;
}

/**
 * Muestra el minuto en vivo ya estimado y corriendo (p. ej. "33'"). Es un
 * componente —no un hook— para poder usarlo dentro de un map (ticker) sin romper
 * las reglas de hooks.
 */
export function LiveMinute({
  matchId,
  minute,
  status,
  suffix = "'",
}: {
  matchId: string;
  minute: number;
  status: LiveMatch["status"];
  suffix?: string;
}) {
  const m = useEstimatedMinute(matchId, minute, status);
  return <>{m}{suffix}</>;
}
