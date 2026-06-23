/**
 * Self-healing Instagram session.
 *
 * Logs in once with IG_USERNAME / IG_PASSWORD (use a DEDICATED throwaway
 * account — never a personal one), persists the session to disk, and
 * transparently re-logs-in when Instagram expires or kills the session. This
 * removes the old hand-pasted INSTAGRAM_SESSION_ID that went stale every few
 * weeks (logout_reason 8 = "automation detected").
 *
 * Caveat: Instagram occasionally interrupts an automated login with a
 * "checkpoint" (a challenge code by email/SMS). That can't be solved headlessly;
 * when it happens we log a clear message and the operator just has to log into
 * the app/website once from the same account to clear it.
 */
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { IgApiClient, IgLoginRequiredError, IgCheckpointError } from "instagram-private-api";

// i.instagram.com advertises unreachable IPv6 on many networks; prefer IPv4.
dns.setDefaultResultOrder("ipv4first");

const USERNAME = process.env.IG_USERNAME ?? "";
const PASSWORD = process.env.IG_PASSWORD ?? "";
const SESSION_FILE = process.env.IG_SESSION_FILE ?? path.join(process.cwd(), ".ig-session.json");

let ig: IgApiClient | null = null;
let ready: Promise<IgApiClient | null> | null = null;

function haveCreds(): boolean {
  return Boolean(USERNAME && PASSWORD);
}

async function saveState(client: IgApiClient): Promise<void> {
  try {
    const serialized = (await client.state.serialize()) as any;
    delete serialized.constants; // per library docs — not reusable across versions
    fs.writeFileSync(SESSION_FILE, JSON.stringify(serialized), "utf8");
  } catch (e) {
    console.error("[instagram] no se pudo guardar la sesión:", e);
  }
}

async function doLogin(client: IgApiClient): Promise<boolean> {
  try {
    await client.simulate.preLoginFlow().catch(() => {});
    await client.account.login(USERNAME, PASSWORD);
    await saveState(client);
    console.log(`[instagram] sesión iniciada como @${USERNAME}`);
    return true;
  } catch (e: any) {
    if (e instanceof IgCheckpointError) {
      console.error(
        `[instagram] CHECKPOINT/challenge requerido — inicia sesión una vez ` +
          `desde la app/web con @${USERNAME} para desbloquear la cuenta, luego reintenta.`,
      );
    } else {
      console.error("[instagram] login falló:", e?.message ?? e);
    }
    return false;
  }
}

/** Returns a ready client (restoring a saved session or logging in), or null. */
export async function getIgClient(): Promise<IgApiClient | null> {
  if (ig) return ig;
  if (ready) return ready;
  ready = (async () => {
    if (!haveCreds()) {
      console.warn("[instagram] IG_USERNAME/IG_PASSWORD no configurados — scrape deshabilitado");
      return null;
    }
    const client = new IgApiClient();
    client.state.generateDevice(USERNAME);
    // Restore a persisted session first to avoid a fresh login on every boot.
    if (fs.existsSync(SESSION_FILE)) {
      try {
        await client.state.deserialize(JSON.parse(fs.readFileSync(SESSION_FILE, "utf8")));
        ig = client;
        return client;
      } catch {
        console.warn("[instagram] sesión guardada inválida, re-login…");
      }
    }
    if (!(await doLogin(client))) {
      ready = null;
      return null;
    }
    ig = client;
    return client;
  })();
  return ready;
}

/**
 * Runs `fn` with the client; if Instagram reports the session is dead, re-logs-in
 * once and retries. Returns fn's result, or null on failure.
 */
export async function igCall<T>(fn: (c: IgApiClient) => Promise<T>): Promise<T | null> {
  let client = await getIgClient();
  if (!client) return null;
  try {
    return await fn(client);
  } catch (e: any) {
    const dead =
      e instanceof IgLoginRequiredError ||
      /login_required|logged out|please log/i.test(e?.message ?? "");
    if (!dead) {
      console.error("[instagram] request falló:", e?.message ?? e);
      return null;
    }
    console.warn("[instagram] sesión caída — re-login automático…");
    ig = null;
    ready = null;
    try {
      if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
    } catch {
      /* ignore */
    }
    client = await getIgClient();
    if (!client) return null;
    try {
      return await fn(client);
    } catch (e2: any) {
      console.error("[instagram] re-login no resolvió:", e2?.message ?? e2);
      return null;
    }
  }
}
