"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScheduleView } from "@/components/season/schedule-view";
import { StandingsView } from "@/components/season/standings-view";
import { EstadisticasView } from "@/components/season/estadisticas-view";

const TABS = [
  { id: "partidos", label: "Partidos" },
  { id: "tabla", label: "Tabla" },
  { id: "stats", label: "Estadísticas" },
] as const;
type TabId = typeof TABS[number]["id"];

function TemporadaInner() {
  const params = useSearchParams();
  const router = useRouter();

  // La pestaña la manda la URL, no un estado local. Con estado local, entrar
  // desde el menú a /temporada?tab=tabla estando ya en /temporada?tab=partidos
  // cambiaba la dirección pero no la pantalla: el componente seguía montado y
  // se quedaba con el valor del primer render.
  const desdeUrl = params.get("tab");
  const tab: TabId = TABS.some((t) => t.id === desdeUrl) ? (desdeUrl as TabId) : "partidos";

  const cambiar = (id: TabId) => router.replace(`/temporada?tab=${id}`, { scroll: false });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-gradient-to-br from-[#1a365d] via-[#7f1d1d] to-[#dc2626] text-white">
        <div className="container mx-auto px-4 pt-8 pb-6">
          <h1 className="text-3xl font-black tracking-tight">Temporada</h1>
          <p className="text-white/70 text-sm font-semibold mt-0.5">2026 · Asociación Rugby de Santiago</p>
        </div>
      </header>

      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 flex gap-5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => cambiar(t.id)}
              className={`py-3 text-sm font-bold transition-colors border-b-2 -mb-px ${
                tab === t.id ? "border-red-600 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "partidos" && <ScheduleView embedded />}
      {tab === "tabla" && <StandingsView embedded />}
      {tab === "stats" && <EstadisticasView embedded />}
    </div>
  );
}

export default function TemporadaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <TemporadaInner />
    </Suspense>
  );
}
