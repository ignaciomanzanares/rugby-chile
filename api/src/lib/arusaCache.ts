/**
 * Durable cache for arusa-sourced data (standings, results).
 *
 * arusa.cl is reachable only intermittently on some networks, and scores live
 * only there (the Leverade JSON API exposes metadata but no scores). To keep
 * the site showing the latest real data through those outages, every successful
 * arusa read is persisted here and served back when a fresh read fails — so the
 * table never reverts to the stale static baseline once real data is captured.
 *
 * Uses a tiny self-creating table via raw SQL, so it needs no migration.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";

let ready: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!ready) {
    ready = db
      .execute(sql`
        CREATE TABLE IF NOT EXISTS arusa_cache (
          key text PRIMARY KEY,
          data jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      .then(() => undefined)
      .catch((err) => {
        console.error("[arusaCache] ensureTable failed:", err);
        ready = null; // allow a retry next call
        throw err;
      });
  }
  return ready;
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    await ensureTable();
    const res: any = await db.execute(sql`SELECT data FROM arusa_cache WHERE key = ${key}`);
    const rows = res?.rows ?? res;
    return rows?.[0]?.data ?? null;
  } catch {
    return null;
  }
}

export async function writeCache(key: string, data: unknown): Promise<void> {
  try {
    await ensureTable();
    await db.execute(sql`
      INSERT INTO arusa_cache (key, data, updated_at)
      VALUES (${key}, ${JSON.stringify(data)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `);
  } catch (err) {
    console.error(`[arusaCache] writeCache(${key}) failed:`, err);
  }
}
