import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Neon (y cualquier Postgres gestionado) cierra las conexiones idle de forma
// agresiva. Config amistosa: soltamos las conexiones idle rápido para no quedar
// con una que el server ya cerró (→ "Connection terminated" en el próximo query).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 10_000,       // devolver la conexión idle antes de que Neon la corte
  connectionTimeoutMillis: 10_000, // no colgar indefinidamente si Neon está dormido/caído
  max: 10,
});

// CRÍTICO: sin este handler, un error en una conexión IDLE del pool (p. ej. Neon
// reinicia o corta la conexión) emite un 'error' no capturado que tumba el
// proceso Node entero. Con el handler, se loguea y el pool descarta esa conexión
// y sigue — la próxima query abre una nueva.
pool.on("error", (err) => {
  console.error("[db] error en conexión idle del pool:", err.message);
});

export const db = drizzle(pool, { schema });
export type DB = typeof db;

/** Ping de salud de la DB: SELECT 1. Devuelve ok o el error real de Postgres. */
export async function checkDb(): Promise<{ ok: boolean; error?: string }> {
  try {
    await pool.query("SELECT 1");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
