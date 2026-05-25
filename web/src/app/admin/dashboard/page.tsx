import Link from "next/link";
import { Trophy, Users, Calendar, Radio, ArrowUpRight, CheckCircle2 } from "lucide-react";

const stats = [
  { name: "Clubes",      value: "10",  icon: Trophy,    color: "text-amber-400",  bg: "bg-amber-400/10" },
  { name: "Divisiones",  value: "3",   icon: Users,     color: "text-blue-400",   bg: "bg-blue-400/10"  },
  { name: "Fecha",       value: "5",   icon: Calendar,  color: "text-emerald-400",bg: "bg-emerald-400/10"},
  { name: "En Vivo",     value: "0",   icon: Radio,     color: "text-red-400",    bg: "bg-red-400/10"   },
];

const fecha4Results = [
  { home: "Old Johns",    away: "Old Reds",    hs: 24, as: 7  },
  { home: "COBS",         away: "UC",          hs: 34, as: 10 },
  { home: "Old Macks",    away: "DOBS",        hs: 14, as: 29 },
  { home: "Stade Francais",away: "Old Boys",   hs: 14, as: 37 },
  { home: "Sporting RC",  away: "PWCC",        hs: 7,  as: 27 },
];

const fecha5Fixtures = [
  { home: "Old Johns",    away: "Stade Francais", time: "14:30", day: "Sáb 16 May", venue: "Colegio Saint John's",         division: "Primera XV" },
  { home: "PWCC",         away: "COBS",           time: "15:30", day: "Sáb 16 May", venue: "Prince of Wales Country Club",  division: "Primera XV" },
  { home: "UC",           away: "Old Macks",      time: "15:30", day: "Sáb 16 May", venue: "San Carlos de Apoquindo",       division: "Primera XV" },
  { home: "Old Boys",     away: "Sporting RC",    time: "17:00", day: "Sáb 16 May", venue: "Old Grangonian Club",           division: "Primera XV" },
  { home: "Old Reds",     away: "DOBS",           time: "15:30", day: "Dom 17 May", venue: "Cancha Federación",             division: "Primera XV" },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wide">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Primera División · Temporada 2026</p>
        </div>
        <Link
          href="/admin/scoring"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
        >
          <Radio className="h-4 w-4" /> Marcar partido
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.name} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">{s.name}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* Fecha 4 results */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-bold text-sm uppercase tracking-widest">Fecha 4 · Resultados</h2>
            <Link href="/admin/matches" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 transition-colors">
              Ver todos <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-zinc-800">
            {fecha4Results.map((m, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
                  <span className="text-sm text-zinc-300 truncate">{m.home} vs {m.away}</span>
                </div>
                <span className="font-black text-white text-sm tabular-nums flex-shrink-0 ml-3">
                  {m.hs} - {m.as}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Fecha 5 fixtures */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-bold text-sm uppercase tracking-widest">Fecha 5 · Próximos</h2>
            <Link href="/admin/scoring" className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
              Marcar <Radio className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-zinc-800">
            {fecha5Fixtures.map((m, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white font-semibold truncate">{m.home} vs {m.away}</p>
                  <p className="text-xs text-zinc-500">{m.day} · {m.time} · {m.venue}</p>
                </div>
                <Link
                  href={`/admin/scoring?home=${encodeURIComponent(m.home)}&away=${encodeURIComponent(m.away)}&division=${encodeURIComponent(m.division)}&venue=${encodeURIComponent(m.venue)}`}
                  className="flex-shrink-0 text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition-colors"
                >
                  Marcar
                </Link>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="font-bold text-sm uppercase tracking-widest mb-4 text-zinc-400">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/matches"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-white transition-colors">
            <Trophy className="h-4 w-4 text-amber-400" /> Gestionar partidos
          </Link>
          <Link href="/admin/teams"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-white transition-colors">
            <Users className="h-4 w-4 text-blue-400" /> Ver equipos
          </Link>
          <Link href="/admin/scoring"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-bold text-white transition-colors">
            <Radio className="h-4 w-4" /> Iniciar puntuación
          </Link>
        </div>
      </div>

    </div>
  );
}
