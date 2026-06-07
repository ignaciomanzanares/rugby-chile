"use client";

import { useState } from "react";
import { Plus, Radio, CheckCircle2, Clock, Calendar } from "lucide-react";

const CLUBS = [
  "COBS", "Old Boys", "PWCC", "Old Macks", "Stade Francais",
  "Sporting RC", "DOBS", "UC", "Old Johns", "Old Reds",
];
const DIVISIONS = ["Primera XV", "Intermedia", "Pre-Intermedia"];
const VENUES: Record<string, string> = {
  "COBS":           "Estadio COBS",
  "Old Boys":       "Old Grangonian Club",
  "PWCC":           "Prince of Wales Country Club",
  "Old Macks":      "Old Mackayans Club",
  "Stade Francais": "Club Stade Français",
  "Sporting RC":    "Sporting Club",
  "DOBS":           "Cancha Federación",
  "UC":             "San Carlos de Apoquindo",
  "Old Johns":      "Colegio Saint John's",
  "Old Reds":       "Cancha Federación",
};

const FECHA_4_RESULTS = [
  { id: "r1", home: "Old Johns",     away: "Old Reds",      hs: 24, as: 7,  division: "Primera XV",     date: "03/05/2026", venue: "Colegio Saint John's" },
  { id: "r2", home: "COBS",          away: "UC",            hs: 34, as: 10, division: "Primera XV",     date: "03/05/2026", venue: "Estadio COBS" },
  { id: "r3", home: "Old Macks",     away: "DOBS",          hs: 14, as: 29, division: "Primera XV",     date: "03/05/2026", venue: "Old Mackayans Club" },
  { id: "r4", home: "Stade Francais",away: "Old Boys",      hs: 14, as: 37, division: "Primera XV",     date: "03/05/2026", venue: "Club Stade Français" },
  { id: "r5", home: "Sporting RC",   away: "PWCC",          hs: 7,  as: 27, division: "Primera XV",     date: "04/05/2026", venue: "Sporting Club" },
];

const FECHA_5_FIXTURES = [
  { id: "f1", home: "Old Johns",    away: "Stade Francais", division: "Primera XV", date: "16/05/2026", time: "14:30", venue: "Colegio Saint John's" },
  { id: "f2", home: "PWCC",         away: "COBS",           division: "Primera XV", date: "16/05/2026", time: "15:30", venue: "Prince of Wales Country Club" },
  { id: "f3", home: "UC",           away: "Old Macks",      division: "Primera XV", date: "16/05/2026", time: "15:30", venue: "San Carlos de Apoquindo" },
  { id: "f4", home: "Old Boys",     away: "Sporting RC",    division: "Primera XV", date: "16/05/2026", time: "17:00", venue: "Old Grangonian Club" },
  { id: "f5", home: "Old Reds",     away: "DOBS",           division: "Primera XV", date: "17/05/2026", time: "15:30", venue: "Cancha Federación" },
];

export default function MatchesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [homeTeam, setHomeTeam] = useState("Old Johns");
  const [awayTeam, setAwayTeam] = useState("Stade Francais");
  const [division, setDivision] = useState("Primera XV");
  const [date, setDate] = useState("2026-05-16");
  const [time, setTime] = useState("14:30");

  const selectClass = "w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-red-500 transition-colors";
  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-red-500 transition-colors";
  const labelClass = "block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5";

  return (
    <div className="space-y-8">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wide">Partidos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Fixture y resultados · Temporada 2026</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> Crear partido
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-border bg-card/80 p-6 space-y-4">
          <h2 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Nuevo partido</h2>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>División</label>
              <select value={division} onChange={(e) => setDivision(e.target.value)} className={selectClass}>
                {DIVISIONS.map((d) => <option key={d} value={d} className="bg-muted">{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Fecha</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Hora</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Local</label>
              <select value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} className={selectClass}>
                {CLUBS.map((c) => <option key={c} value={c} className="bg-muted">{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Visitante</label>
              <select value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} className={selectClass}>
                {CLUBS.map((c) => <option key={c} value={c} className="bg-muted">{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Cancha</label>
            <input type="text" defaultValue={VENUES[homeTeam] ?? ""} key={homeTeam} className={inputClass} placeholder="Nombre de la cancha" />
          </div>

          <div className="flex gap-3 pt-1">
            <button className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors">
              Guardar
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg border border-border bg-muted hover:bg-secondary text-sm font-semibold text-foreground transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Fecha 5 – upcoming */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 bg-card/60 border-b border-border">
          <h2 className="font-bold text-sm uppercase tracking-widest">Fecha 5 · 16-17 Mayo 2026</h2>
        </div>
        <div className="divide-y divide-border">
          {FECHA_5_FIXTURES.map((m) => (
            <div key={m.id} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Clock className="h-4 w-4 text-muted-foreground/70 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground">{m.home} <span className="text-muted-foreground/70">vs</span> {m.away}</p>
                  <p className="text-xs text-muted-foreground">{m.date} · {m.time} · {m.venue}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground border border-border">{m.division}</span>
                <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground border border-border font-mono">Programado</span>
                <a
                  href={`/admin/scoring?home=${encodeURIComponent(m.home)}&away=${encodeURIComponent(m.away)}&division=${encodeURIComponent(m.division)}&venue=${encodeURIComponent(m.venue)}`}
                  className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold transition-colors flex items-center gap-1">
                  <Radio className="h-3 w-3" /> Marcar
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fecha 4 – results */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 bg-card/60 border-b border-border">
          <h2 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Fecha 4 · Resultados</h2>
        </div>
        <div className="divide-y divide-border">
          {FECHA_4_RESULTS.map((m) => (
            <div key={m.id} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground/80">
                    <span className={m.hs > m.as ? "text-foreground" : ""}>{m.home}</span>
                    <span className="text-muted-foreground/70 mx-2">vs</span>
                    <span className={m.as > m.hs ? "text-foreground" : ""}>{m.away}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{m.date} · {m.venue}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-black text-foreground tabular-nums">{m.hs} - {m.as}</span>
                <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground border border-border">Finalizado</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
