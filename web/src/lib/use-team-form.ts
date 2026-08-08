"use client";

import { useCallback, useEffect, useState } from "react";
import type { DivisionKey } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const POLL_INTERVAL = 60_000;

export interface FormMatch {
  opponent: string;
  home: boolean;
  scoreFor: number;
  scoreAgainst: number;
  result: "W" | "D" | "L";
  round?: number;
  date?: string;
}

export type TeamForm = Record<string, FormMatch[]>;

/** Each team's recent results (newest first) for a division, keyed by name. */
export function useTeamForm(division: DivisionKey): { form: TeamForm; refresh: () => void } {
  const [form, setForm] = useState<TeamForm>({});

  const load = useCallback(() => {
    fetch(`${API_URL}/api/v1/form?division=${division}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setForm(d?.teams ?? {}))
      .catch(() => setForm({}));
  }, [division]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [load]);

  return { form, refresh: load };
}
