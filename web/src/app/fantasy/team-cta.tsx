"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gamepad2, Eye } from "lucide-react";
import { fetchState, type Division } from "@/lib/fantasy-api";

// CTA de cada división en la landing: si ya tenés equipo en esa categoría muestra
// "Ver <tu equipo>"; si no, "Armar equipo".
export function TeamCTA({ division }: { division: string }) {
  const [teamName, setTeamName] = useState<string | null | undefined>(undefined); // undefined = cargando

  useEffect(() => {
    let alive = true;
    fetchState(division as Division)
      .then((s) => { if (alive) setTeamName(s.squad?.teamName ?? null); })
      .catch(() => { if (alive) setTeamName(null); });
    return () => { alive = false; };
  }, [division]);

  const has = typeof teamName === "string" && teamName.length > 0;

  return (
    <Link href={`/fantasy/team?division=${division}`}
      className={`w-full py-2.5 rounded-lg font-bold text-sm text-center transition-colors flex items-center justify-center gap-2 ${
        has ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-white/10 hover:bg-white/20 border border-white/10 text-foreground"
      }`}>
      {teamName === undefined ? (
        <span className="opacity-70">Cargando…</span>
      ) : has ? (
        <><Eye className="h-4 w-4" /><span className="truncate">Ver «{teamName}»</span></>
      ) : (
        <><Gamepad2 className="h-4 w-4" />Armar equipo</>
      )}
    </Link>
  );
}
