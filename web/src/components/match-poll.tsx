"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { clubLogo, type DivisionKey } from "@/lib/tournament";
import { voterId } from "@/lib/voter-id";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Choice = "HOME" | "DRAW" | "AWAY";
type Poll = { home: number; draw: number; away: number; total: number; mine: Choice | null; abierta: boolean; motivo: string | null };

/**
 * "¿Quién gana?" — encuesta de los partidos que todavía no se juegan.
 *
 * Se muestra SOLO en partidos futuros: sobre uno ya jugado no tendría sentido
 * (y el servidor rechaza el voto igual, no se confía en el cliente).
 */
export function MatchPoll({
  division, round, home, away,
}: { division: DivisionKey; round: number; home: string; away: string }) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [enviando, setEnviando] = useState(false);

  const qs = `division=${division}&round=${round}&home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`;

  useEffect(() => {
    let vivo = true;
    // credentials: la API usa la cuenta como identidad cuando hay sesión, así el
    // mismo usuario vota una sola vez desde el celular y el computador. Sin
    // sesión se usa la clave anónima del navegador.
    fetch(`${API_URL}/api/v1/poll?${qs}&voter=${encodeURIComponent(voterId())}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (vivo) setPoll(d); })
      .catch(() => { if (vivo) setPoll(null); });
    return () => { vivo = false; };
  }, [qs]);

  const votar = useCallback(async (choice: Choice) => {
    if (enviando) return;
    setEnviando(true);
    // Optimista: la barra se mueve al instante y después llega el conteo real.
    setPoll((p) => (p ? { ...p, mine: choice } : p));
    try {
      const r = await fetch(`${API_URL}/api/v1/poll`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ division, round, home, away, choice, voter: voterId() }),
      });
      if (r.ok) setPoll(await r.json());
    } catch { /* se queda con lo optimista */ } finally {
      setEnviando(false);
    }
  }, [division, round, home, away, enviando]);

  if (!poll || !poll.abierta) return null;

  const pct = (n: number) => (poll.total > 0 ? Math.round((n / poll.total) * 100) : 0);
  const opciones: { id: Choice; etiqueta: string; equipo?: string; n: number }[] = [
    { id: "HOME", etiqueta: home, equipo: home, n: poll.home },
    { id: "DRAW", etiqueta: "X", n: poll.draw },
    { id: "AWAY", etiqueta: away, equipo: away, n: poll.away },
  ];

  return (
    <div className="mb-5 rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-foreground">¿Quién gana?</p>
          <p className="text-[10px] text-muted-foreground/70">
            {poll.total === 0 ? "Sé el primero en votar" : `${poll.total} ${poll.total === 1 ? "voto" : "votos"}`}
          </p>
        </div>
        <Trophy className="h-4 w-4 text-muted-foreground/60" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {opciones.map((o) => {
          const elegida = poll.mine === o.id;
          const logo = o.equipo ? clubLogo(o.equipo) : null;
          return (
            <button
              key={o.id}
              onClick={() => votar(o.id)}
              disabled={enviando}
              aria-pressed={elegida}
              className={`relative overflow-hidden rounded-lg border px-2 py-2.5 transition-colors disabled:opacity-60 ${
                elegida ? "border-red-600 bg-red-600/10" : "border-border hover:bg-secondary/60"
              }`}
            >
              {/* Barra de fondo con el porcentaje: se lee de un vistazo. */}
              {poll.mine && (
                <span
                  className="absolute inset-y-0 left-0 bg-secondary/70"
                  style={{ width: `${pct(o.n)}%` }}
                  aria-hidden
                />
              )}
              <span className="relative flex items-center justify-center gap-1.5">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">X</span>
                )}
                {poll.mine && <span className="text-xs font-black tabular-nums">{pct(o.n)}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      {!poll.mine && (
        <p className="text-[10px] text-muted-foreground/60 text-center mt-2">Toca para votar y ver los resultados</p>
      )}
    </div>
  );
}
