"use client";

/**
 * Polling adaptativo y consciente de la visibilidad.
 *
 * Motivo: cada página con datos en vivo monta varios hooks que consultaban la
 * API cada 60s con `cache: "no-store"`, incluso con la pestaña de fondo o sin
 * ningún partido en juego. Eso disparó el bandwidth de Render (5 GB/mes). Con
 * dos reglas simples se corta la mayor parte sin mostrar datos viejos:
 *
 *   1. Si la pestaña está oculta, no se consulta nada. Al volver a mirarla se
 *      hace un fetch inmediato (queda al día al toque) y se reanuda el ciclo.
 *   2. La cadencia es rápida (`liveMs`) sólo cuando hay un partido en vivo; el
 *      resto del tiempo es lenta (`idleMs`). El `<LiveTicker>` del layout está
 *      en toda la app, así que la señal `liveNow` es fiable en cualquier página.
 */

// Señal global: ¿hay algún partido LIVE/HT ahora mismo? La setea use-live-matches.
let liveNow = false;

export function setLiveNow(v: boolean) {
  liveNow = v;
}

export function isLiveNow() {
  return liveNow;
}

type PollOpts = {
  /** Cadencia con partido en vivo (ms). Default 60s. */
  liveMs?: number;
  /** Cadencia sin nada en vivo (ms). Default 5 min. */
  idleMs?: number;
};

/**
 * Ejecuta `load` en un ciclo adaptativo. NO llama a `load` de entrada — el
 * caller ya hace el primer fetch (con su setLoading). Devuelve un cleanup.
 */
export function startAdaptivePoll(load: () => void, opts: PollOpts = {}): () => void {
  const liveMs = opts.liveMs ?? 60_000;
  const idleMs = opts.idleMs ?? 5 * 60_000;

  // En SSR no hay document; devolvemos un no-op.
  if (typeof document === "undefined") return () => {};

  let timer: ReturnType<typeof setTimeout> | null = null;

  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fire, liveNow ? liveMs : idleMs);
  };

  const fire = () => {
    // Pestaña oculta: no consultamos y no re-armamos; onVisible reanuda.
    if (document.hidden) {
      timer = null;
      return;
    }
    load();
    arm();
  };

  const onVisible = () => {
    if (document.hidden) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    } else {
      // Al volver a la pestaña: fetch inmediato para quedar al día y reanudar.
      load();
      arm();
    }
  };

  arm();
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    if (timer) clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
