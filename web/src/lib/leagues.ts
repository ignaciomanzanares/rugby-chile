const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type League = { id: string; name: string; code: string; members?: number; isOwner?: boolean };

export async function fetchMyLeagues(): Promise<League[]> {
  try {
    const r = await fetch(`${API_URL}/api/v1/leagues/mine`, { credentials: "include", cache: "no-store" });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function post(path: string, body: unknown): Promise<League> {
  const r = await fetch(`${API_URL}/api/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error ?? "Algo salió mal");
  return data as League;
}

export const createLeague = (name: string) => post("leagues", { name });
export const joinLeague = (code: string) => post("leagues/join", { code });
