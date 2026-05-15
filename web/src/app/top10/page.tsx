"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trophy,
  Calendar,
  TrendingUp,
  MapPin,
  Clock,
  ChevronUp,
  ChevronDown,
  Minus,
  Star,
  Zap,
  Target,
} from "lucide-react";

const CLUBS: Record<string, { full: string; primary: string; secondary: string; initials: string }> = {
  COBS:           { full: "COBS",           primary: "#1a3a6b", secondary: "#c9a227", initials: "CO" },
  "Old Boys":     { full: "Old Boys RC",    primary: "#cc0000", secondary: "#000000", initials: "OB" },
  PWCC:           { full: "Prince of Wales CC", primary: "#003087", secondary: "#FFB81C", initials: "PW" },
  "Old Macks":    { full: "Old Mackayans",  primary: "#b91c1c", secondary: "#ffffff", initials: "OM" },
  "Stade Francais": { full: "Stade Français", primary: "#1a237e", secondary: "#e8102a", initials: "SF" },
  "Sporting RC":  { full: "Sporting RC",    primary: "#15803d", secondary: "#ffffff", initials: "SP" },
  DOBS:           { full: "DOBS",           primary: "#0369a1", secondary: "#fbbf24", initials: "DO" },
  UC:             { full: "Univ. Católica", primary: "#1e3a8a", secondary: "#fbbf24", initials: "UC" },
  "Old Johns":    { full: "Old Johns RC",   primary: "#1d4ed8", secondary: "#fef08a", initials: "OJ" },
  "Old Reds":     { full: "Old Reds RC",    primary: "#9f1239", secondary: "#fca5a5", initials: "OR" },
};

const standingsData = {
  PRIMERA: [
    { pos: 1, team: "COBS",           pj: 4, pg: 4, pe: 0, pp: 0, pf: 127, pc: 58,  diff: 69,   tb: 2, lb: 0, pts: 18 },
    { pos: 2, team: "Old Boys",       pj: 4, pg: 3, pe: 0, pp: 1, pf: 112, pc: 71,  diff: 41,   tb: 2, lb: 1, pts: 15 },
    { pos: 3, team: "PWCC",           pj: 4, pg: 3, pe: 0, pp: 1, pf: 108, pc: 74,  diff: 34,   tb: 2, lb: 1, pts: 15 },
    { pos: 4, team: "Old Macks",      pj: 4, pg: 3, pe: 0, pp: 1, pf: 98,  pc: 79,  diff: 19,   tb: 0, lb: 0, pts: 12 },
    { pos: 5, team: "Stade Francais", pj: 4, pg: 2, pe: 0, pp: 2, pf: 89,  pc: 93,  diff: -4,   tb: 0, lb: 0, pts: 8  },
    { pos: 6, team: "Sporting RC",    pj: 4, pg: 2, pe: 0, pp: 2, pf: 84,  pc: 91,  diff: -7,   tb: 0, lb: 0, pts: 8  },
    { pos: 7, team: "DOBS",           pj: 4, pg: 2, pe: 0, pp: 2, pf: 80,  pc: 97,  diff: -17,  tb: 0, lb: 0, pts: 8  },
    { pos: 8, team: "UC",             pj: 4, pg: 1, pe: 0, pp: 3, pf: 74,  pc: 102, diff: -28,  tb: 0, lb: 3, pts: 7  },
    { pos: 9, team: "Old Johns",      pj: 4, pg: 1, pe: 0, pp: 3, pf: 69,  pc: 108, diff: -39,  tb: 0, lb: 3, pts: 7  },
    { pos: 10, team: "Old Reds",      pj: 4, pg: 1, pe: 0, pp: 3, pf: 63,  pc: 115, diff: -52,  tb: 0, lb: 2, pts: 6  },
  ],
  INTERMEDIA: [
    { pos: 1, team: "Old Boys",       pj: 4, pg: 4, pe: 0, pp: 0, pf: 118, pc: 52,  diff: 66,   tb: 2, lb: 0, pts: 18 },
    { pos: 2, team: "COBS",           pj: 4, pg: 3, pe: 0, pp: 1, pf: 104, pc: 63,  diff: 41,   tb: 3, lb: 0, pts: 15 },
    { pos: 3, team: "Old Macks",      pj: 4, pg: 3, pe: 0, pp: 1, pf: 99,  pc: 68,  diff: 31,   tb: 2, lb: 1, pts: 15 },
    { pos: 4, team: "PWCC",           pj: 4, pg: 2, pe: 0, pp: 2, pf: 88,  pc: 80,  diff: 8,    tb: 1, lb: 1, pts: 10 },
    { pos: 5, team: "UC",             pj: 4, pg: 2, pe: 0, pp: 2, pf: 82,  pc: 86,  diff: -4,   tb: 1, lb: 1, pts: 10 },
    { pos: 6, team: "Sporting RC",    pj: 4, pg: 2, pe: 0, pp: 2, pf: 78,  pc: 88,  diff: -10,  tb: 0, lb: 0, pts: 8  },
    { pos: 7, team: "Old Johns",      pj: 4, pg: 2, pe: 0, pp: 2, pf: 75,  pc: 91,  diff: -16,  tb: 0, lb: 0, pts: 8  },
    { pos: 8, team: "Stade Francais", pj: 4, pg: 1, pe: 0, pp: 3, pf: 68,  pc: 99,  diff: -31,  tb: 2, lb: 1, pts: 7  },
    { pos: 9, team: "DOBS",           pj: 4, pg: 1, pe: 0, pp: 3, pf: 61,  pc: 106, diff: -45,  tb: 1, lb: 1, pts: 6  },
    { pos: 10, team: "Old Reds",      pj: 4, pg: 0, pe: 0, pp: 4, pf: 44,  pc: 127, diff: -83,  tb: 1, lb: 2, pts: 3  },
  ],
  PRE_INTERMEDIA: [
    { pos: 1, team: "PWCC",           pj: 4, pg: 4, pe: 0, pp: 0, pf: 132, pc: 47,  diff: 85,   tb: 3, lb: 0, pts: 19 },
    { pos: 2, team: "COBS",           pj: 4, pg: 3, pe: 0, pp: 1, pf: 109, pc: 58,  diff: 51,   tb: 2, lb: 0, pts: 14 },
    { pos: 3, team: "Old Reds",       pj: 4, pg: 3, pe: 0, pp: 1, pf: 102, pc: 66,  diff: 36,   tb: 1, lb: 0, pts: 13 },
    { pos: 4, team: "Old Boys",       pj: 4, pg: 2, pe: 0, pp: 2, pf: 90,  pc: 78,  diff: 12,   tb: 2, lb: 1, pts: 11 },
    { pos: 5, team: "DOBS",           pj: 4, pg: 2, pe: 0, pp: 2, pf: 84,  pc: 82,  diff: 2,    tb: 1, lb: 0, pts: 9  },
    { pos: 6, team: "UC",             pj: 4, pg: 2, pe: 0, pp: 2, pf: 79,  pc: 88,  diff: -9,   tb: 0, lb: 1, pts: 9  },
    { pos: 7, team: "Old Macks",      pj: 4, pg: 2, pe: 0, pp: 2, pf: 76,  pc: 93,  diff: -17,  tb: 0, lb: 0, pts: 8  },
    { pos: 8, team: "Old Johns",      pj: 4, pg: 1, pe: 0, pp: 3, pf: 64,  pc: 101, diff: -37,  tb: 1, lb: 2, pts: 7  },
    { pos: 9, team: "Stade Francais", pj: 4, pg: 1, pe: 0, pp: 3, pf: 59,  pc: 108, diff: -49,  tb: 1, lb: 1, pts: 6  },
    { pos: 10, team: "Sporting RC",   pj: 4, pg: 0, pe: 0, pp: 4, pf: 41,  pc: 135, diff: -94,  tb: 0, lb: 2, pts: 2  },
  ],
};

const fixtures = [
  { home: "Old Johns",    away: "Stade Francais", date: "Sáb 17 May", time: "14:30", venue: "Colegio Saint John's" },
  { home: "PWCC",         away: "COBS",           date: "Sáb 17 May", time: "15:30", venue: "Prince of Wales CC" },
  { home: "UC",           away: "Old Macks",      date: "Sáb 17 May", time: "15:30", venue: "San Carlos de Apoquindo" },
  { home: "Old Boys",     away: "Sporting RC",    date: "Sáb 17 May", time: "17:00", venue: "Old Grangonian Club" },
  { home: "Old Reds",     away: "DOBS",           date: "Dom 18 May", time: "15:30", venue: "Cancha Federación" },
];

const topScorers = {
  tries: [
    { name: "Ignacio Guajardo", club: "Old Macks", value: 10 },
    { name: "Nicolás Donoso",   club: "COBS",      value: 7 },
    { name: "S. Benavente",     club: "Old Johns", value: 7 },
  ],
  conversions: [
    { name: "M. Canales",    club: "PWCC",      value: 18 },
    { name: "S. Benavente",  club: "Old Johns", value: 18 },
    { name: "Lucas Muñoz",   club: "COBS",      value: 15 },
  ],
  penalties: [
    { name: "C. Huerta",   club: "Stade Francais", value: 9 },
    { name: "I. Tuset",    club: "PWCC",           value: 9 },
    { name: "N. Pereira",  club: "Stade Francais", value: 8 },
  ],
};

function ClubBadge({ team, size = "sm" }: { team: string; size?: "sm" | "md" | "lg" }) {
  const club = CLUBS[team] ?? { primary: "#374151", secondary: "#ffffff", initials: team.slice(0, 2).toUpperCase(), full: team };
  const dim = size === "lg" ? "w-12 h-12 text-base" : size === "md" ? "w-9 h-9 text-sm" : "w-7 h-7 text-xs";
  return (
    <span
      className={`${dim} rounded-full inline-flex items-center justify-center font-bold flex-shrink-0`}
      style={{ backgroundColor: club.primary, color: club.secondary }}
    >
      {club.initials}
    </span>
  );
}

function PositionIndicator({ pos }: { pos: number }) {
  if (pos <= 4) return (
    <span className="inline-flex w-7 h-7 items-center justify-center rounded font-bold text-sm bg-emerald-600 text-white">{pos}</span>
  );
  if (pos >= 9) return (
    <span className="inline-flex w-7 h-7 items-center justify-center rounded font-bold text-sm bg-red-600 text-white">{pos}</span>
  );
  return (
    <span className="inline-flex w-7 h-7 items-center justify-center rounded font-bold text-sm bg-zinc-700 text-white">{pos}</span>
  );
}

const divisionLabels: Record<string, string> = {
  PRIMERA: "Primera XV",
  INTERMEDIA: "Intermedia",
  PRE_INTERMEDIA: "Pre-Intermedia",
};

export default function Top10Page() {
  const [activeDiv, setActiveDiv] = useState("PRIMERA");

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-red-950/40 to-zinc-950" />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg, transparent, transparent 48px, rgba(255,255,255,0.15) 48px, rgba(255,255,255,0.15) 50px
            ), repeating-linear-gradient(
              90deg, transparent, transparent 48px, rgba(255,255,255,0.15) 48px, rgba(255,255,255,0.15) 50px
            )`,
          }}
        />
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-4">
              <Badge className="bg-red-600 text-white border-0 text-xs font-semibold tracking-widest uppercase px-3 py-1">
                Temporada 2026
              </Badge>
              <Badge variant="outline" className="border-zinc-600 text-zinc-400 text-xs tracking-widest uppercase px-3 py-1">
                Fecha 5 próxima
              </Badge>
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none mb-3">
              TOP<span className="text-red-500">10</span>
            </h1>
            <p className="text-zinc-400 text-lg md:text-xl font-medium mb-8">
              Primera División de Rugby · Asociación Rugby de Santiago
            </p>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex flex-col">
                <span className="text-3xl font-black text-white">10</span>
                <span className="text-zinc-500 uppercase tracking-wide text-xs">Clubes</span>
              </div>
              <div className="w-px bg-zinc-800" />
              <div className="flex flex-col">
                <span className="text-3xl font-black text-white">4</span>
                <span className="text-zinc-500 uppercase tracking-wide text-xs">Fechas jugadas</span>
              </div>
              <div className="w-px bg-zinc-800" />
              <div className="flex flex-col">
                <span className="text-3xl font-black text-white">3</span>
                <span className="text-zinc-500 uppercase tracking-wide text-xs">Divisiones por club</span>
              </div>
              <div className="w-px bg-zinc-800" />
              <div className="flex flex-col">
                <span className="text-3xl font-black text-red-500">COBS</span>
                <span className="text-zinc-500 uppercase tracking-wide text-xs">Líder actual</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main content ── */}
      <div className="container mx-auto px-4 py-10 space-y-12">

        {/* ── Standings ── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="h-5 w-5 text-red-500" />
            <h2 className="text-xl font-bold uppercase tracking-widest">Tabla de Posiciones</h2>
          </div>

          <Tabs value={activeDiv} onValueChange={setActiveDiv}>
            <TabsList className="bg-zinc-900 border border-zinc-800 mb-6 p-1 h-auto gap-1">
              {Object.entries(divisionLabels).map(([key, label]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="text-zinc-400 data-[state=active]:bg-red-600 data-[state=active]:text-white rounded px-5 py-2 text-sm font-semibold uppercase tracking-wide"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(standingsData).map(([division, rows]) => (
              <TabsContent key={division} value={division}>
                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800 bg-zinc-900/80 hover:bg-zinc-900/80">
                        <TableHead className="text-zinc-500 text-xs uppercase tracking-wider w-12 text-center">#</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase tracking-wider">Club</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase tracking-wider text-center">PJ</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase tracking-wider text-center hidden sm:table-cell">PG</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase tracking-wider text-center hidden sm:table-cell">PE</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase tracking-wider text-center hidden sm:table-cell">PP</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase tracking-wider text-center hidden md:table-cell">PF</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase tracking-wider text-center hidden md:table-cell">PC</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase tracking-wider text-center hidden lg:table-cell">DIF</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase tracking-wider text-center hidden lg:table-cell">TB</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase tracking-wider text-center hidden lg:table-cell">LB</TableHead>
                        <TableHead className="text-zinc-400 text-xs uppercase tracking-wider text-center font-bold">PTS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const club = CLUBS[row.team];
                        return (
                          <TableRow
                            key={row.team}
                            className="border-zinc-800 hover:bg-zinc-900/60 transition-colors"
                            style={{ borderLeft: `3px solid ${club?.primary ?? "#374151"}` }}
                          >
                            <TableCell className="text-center py-3">
                              <PositionIndicator pos={row.pos} />
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex items-center gap-3">
                                <ClubBadge team={row.team} />
                                <div>
                                  <p className="font-semibold text-white text-sm">{row.team}</p>
                                  <p className="text-zinc-500 text-xs hidden sm:block">{club?.full}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-zinc-300 text-sm">{row.pj}</TableCell>
                            <TableCell className="text-center text-zinc-300 text-sm hidden sm:table-cell">{row.pg}</TableCell>
                            <TableCell className="text-center text-zinc-300 text-sm hidden sm:table-cell">{row.pe}</TableCell>
                            <TableCell className="text-center text-zinc-300 text-sm hidden sm:table-cell">{row.pp}</TableCell>
                            <TableCell className="text-center text-zinc-300 text-sm hidden md:table-cell">{row.pf}</TableCell>
                            <TableCell className="text-center text-zinc-300 text-sm hidden md:table-cell">{row.pc}</TableCell>
                            <TableCell className={`text-center text-sm font-medium hidden lg:table-cell ${row.diff > 0 ? "text-emerald-400" : row.diff < 0 ? "text-red-400" : "text-zinc-300"}`}>
                              {row.diff > 0 ? `+${row.diff}` : row.diff}
                            </TableCell>
                            <TableCell className="text-center text-zinc-300 text-sm hidden lg:table-cell">{row.tb}</TableCell>
                            <TableCell className="text-center text-zinc-300 text-sm hidden lg:table-cell">{row.lb}</TableCell>
                            <TableCell className="text-center font-black text-lg text-white">{row.pts}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-600 inline-block" />
                    Clasifican a playoffs (Top 4)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-red-600 inline-block" />
                    Zona de descenso
                  </span>
                  <span className="ml-auto text-zinc-600">
                    PJ=Jugados · PG=Ganados · PP=Perdidos · PF/PC=Pts favor/contra · TB=Bonus tries · LB=Bonus derrota
                  </span>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </section>

        {/* ── Fecha 5 + Top Scorers ── */}
        <div className="grid lg:grid-cols-2 gap-10">

          {/* Upcoming fixtures */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="h-5 w-5 text-red-500" />
              <h2 className="text-xl font-bold uppercase tracking-widest">Fecha 5</h2>
              <Badge className="bg-red-600/20 text-red-400 border border-red-600/30 text-xs ml-auto">
                Próxima jornada
              </Badge>
            </div>
            <div className="space-y-3">
              {fixtures.map((f, i) => {
                const home = CLUBS[f.home];
                const away = CLUBS[f.away];
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-600 transition-colors"
                  >
                    <div className="flex items-stretch">
                      <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: home?.primary ?? "#374151" }} />
                      <div className="flex-1 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <ClubBadge team={f.home} size="md" />
                            <span className="font-bold text-white text-sm">{f.home}</span>
                          </div>
                          <div className="flex flex-col items-center flex-shrink-0">
                            <span className="text-xs text-zinc-500 font-semibold tracking-widest">VS</span>
                          </div>
                          <div className="flex items-center gap-3 flex-1 flex-row-reverse">
                            <ClubBadge team={f.away} size="md" />
                            <span className="font-bold text-white text-sm text-right">{f.away}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {f.date} · {f.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {f.venue}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Top scorers */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-5 w-5 text-red-500" />
              <h2 className="text-xl font-bold uppercase tracking-widest">Líderes Estadísticos</h2>
            </div>
            <div className="space-y-5">

              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="h-4 w-4 text-yellow-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Tries</span>
                  </div>
                  {topScorers.tries.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-zinc-800 last:border-0">
                      <span className="text-2xl font-black text-white w-8 text-right">{p.value}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-white text-sm">{p.name}</p>
                        <p className="text-zinc-500 text-xs">{p.club}</p>
                      </div>
                      <ClubBadge team={p.club} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Conversiones</span>
                  </div>
                  {topScorers.conversions.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-zinc-800 last:border-0">
                      <span className="text-2xl font-black text-white w-8 text-right">{p.value}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-white text-sm">{p.name}</p>
                        <p className="text-zinc-500 text-xs">{p.club}</p>
                      </div>
                      <ClubBadge team={p.club} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-4 w-4 text-orange-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Penales</span>
                  </div>
                  {topScorers.penalties.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-zinc-800 last:border-0">
                      <span className="text-2xl font-black text-white w-8 text-right">{p.value}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-white text-sm">{p.name}</p>
                        <p className="text-zinc-500 text-xs">{p.club}</p>
                      </div>
                      <ClubBadge team={p.club} />
                    </div>
                  ))}
                </CardContent>
              </Card>

            </div>
          </section>
        </div>

        {/* ── Clubs grid ── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="h-5 w-5 text-red-500" />
            <h2 className="text-xl font-bold uppercase tracking-widest">Los 10 Clubes</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {Object.entries(CLUBS).map(([key, club]) => {
              const standing = standingsData.PRIMERA.find((r) => r.team === key);
              return (
                <div
                  key={key}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex flex-col items-center gap-3 hover:border-zinc-600 transition-colors group"
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black transition-transform group-hover:scale-110"
                    style={{ backgroundColor: club.primary, color: club.secondary }}
                  >
                    {club.initials}
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-white text-sm">{key}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">{club.full}</p>
                  </div>
                  {standing && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-500">#{standing.pos}</span>
                      <span className="font-black text-white">{standing.pts} pts</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── ARUSA attribution ── */}
        <div className="text-center pb-4">
          <p className="text-zinc-600 text-xs">
            Datos oficiales: <a href="https://arusa.cl" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2">arusa.cl</a>
            {" "}· Asociación Rugby de Santiago · El Canelo 2715, Providencia
          </p>
        </div>

      </div>
    </div>
  );
}
