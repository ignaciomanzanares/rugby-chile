/**
 * Encuesta "¿quién gana?" para los partidos que todavía no se juegan.
 *
 * Un voto por persona y por partido. La identidad es el usuario logueado si lo
 * hay, y si no una clave anónima que el navegador guarda en localStorage: no es
 * a prueba de balas (quien quiera puede borrarla), pero corta el doble voto
 * casual, que es de lo que se trata.
 *
 * SOLO se admiten votos de partidos que NO empezaron. Se valida en el servidor
 * contra el horario de Leverade, no en el cliente: si no, se podría "predecir"
 * un partido ya jugado. Los pasados se pueden leer, pero no votar.
 *
 * Tabla auto-creada por SQL, como arusa_cache: no necesita migración.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { fetchAllMatchesMeta } from "../lib/leverade";

export type Choice = "HOME" | "DRAW" | "AWAY";
export interface PollCounts { home: number; draw: number; away: number; total: number; mine: Choice | null }

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ready) {
    ready = db.execute(sql`
      CREATE TABLE IF NOT EXISTS match_poll_votes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        division text NOT NULL,
        round integer NOT NULL,
        home_team text NOT NULL,
        away_team text NOT NULL,
        choice text NOT NULL,
        voter text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (division, round, home_team, away_team, voter)
      )
    `).then(() => undefined).catch((err) => {
      console.error("[matchPoll] ensureTable falló:", err);
      ready = null;
      throw err;
    });
  }
  return ready;
}

/** El partido existe y todavía no empezó. Devuelve el motivo si no se puede votar. */
export async function puedeVotar(
  division: string, round: number, home: string, away: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  let meta;
  try { meta = await fetchAllMatchesMeta(); } catch { return { ok: false, motivo: "No se pudo verificar el partido" }; }
  const m = meta.find(
    (x) => x.division === division && x.round === round && x.homeTeam === home && x.awayTeam === away,
  );
  if (!m) return { ok: false, motivo: "Partido no encontrado" };
  if (m.postponed || m.canceled) return { ok: false, motivo: "El partido no se juega" };
  if (m.finished) return { ok: false, motivo: "El partido ya terminó" };
  if (m.datetime) {
    const inicio = new Date(m.datetime.replace(" ", "T") + "Z").getTime();
    if (Number.isFinite(inicio) && Date.now() >= inicio) return { ok: false, motivo: "El partido ya empezó" };
  }
  return { ok: true };
}

export async function contarVotos(
  division: string, round: number, home: string, away: string, voter?: string,
): Promise<PollCounts> {
  await ensureTable();
  const res: any = await db.execute(sql`
    SELECT choice, COUNT(*)::int AS n
    FROM match_poll_votes
    WHERE division = ${division} AND round = ${round}
      AND home_team = ${home} AND away_team = ${away}
    GROUP BY choice
  `);
  const rows: any[] = res?.rows ?? res ?? [];
  const out: PollCounts = { home: 0, draw: 0, away: 0, total: 0, mine: null };
  for (const r of rows) {
    const n = Number(r.n) || 0;
    if (r.choice === "HOME") out.home = n;
    else if (r.choice === "DRAW") out.draw = n;
    else if (r.choice === "AWAY") out.away = n;
  }
  out.total = out.home + out.draw + out.away;

  if (voter) {
    const mine: any = await db.execute(sql`
      SELECT choice FROM match_poll_votes
      WHERE division = ${division} AND round = ${round}
        AND home_team = ${home} AND away_team = ${away} AND voter = ${voter}
      LIMIT 1
    `);
    const mr: any[] = mine?.rows ?? mine ?? [];
    if (mr[0]?.choice) out.mine = mr[0].choice as Choice;
  }
  return out;
}

/** Registra el voto. Cambiar de opinión pisa el anterior, no suma otro. */
export async function votar(
  division: string, round: number, home: string, away: string, choice: Choice, voter: string,
): Promise<PollCounts> {
  await ensureTable();
  await db.execute(sql`
    INSERT INTO match_poll_votes (division, round, home_team, away_team, choice, voter)
    VALUES (${division}, ${round}, ${home}, ${away}, ${choice}, ${voter})
    ON CONFLICT (division, round, home_team, away_team, voter)
    DO UPDATE SET choice = EXCLUDED.choice, created_at = now()
  `);
  return contarVotos(division, round, home, away, voter);
}
