export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Target, Zap, BarChart3 } from "lucide-react";
import { clubLogo } from "@/lib/tournament";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type PlayerDiv = {
  matches: number; points: number; tries: number; penaltyTries: number;
  conversions: number; penalties: number; drops: number;
  yellowCards: number; redCards: number; mvp: number;
};
type Player = { id: string; name: string; team: string; teamSlug: string; byDivision: Record<string, PlayerDiv> };

const DIV_LABEL: Record<string, string> = {
  PRIMERA: "Primera", INTERMEDIA: "Intermedia", PRE_INTERMEDIA: "Pre-Intermedia",
};
const DIV_ORDER = ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"];

async function getPlayer(id: string): Promise<Player | null> {
  try {
    const r = await fetch(`${API_URL}/api/v1/stats/player/${id}`, { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch { /* ignore */ }
  return null;
}

const COLS: { key: keyof PlayerDiv; label: string }[] = [
  { key: "matches", label: "PJ" },
  { key: "points", label: "Pts" },
  { key: "tries", label: "Tries" },
  { key: "conversions", label: "Conv" },
  { key: "penalties", label: "Pen" },
  { key: "drops", label: "Drop" },
  { key: "yellowCards", label: "TA" },
  { key: "redCards", label: "TR" },
  { key: "mvp", label: "MVP" },
];

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPlayer(id);
  if (!p) notFound();

  const logo = clubLogo(p.team);
  const divs = DIV_ORDER.filter((d) => p.byDivision[d]);
  const totals = divs.reduce(
    (acc, d) => {
      const x = p.byDivision[d];
      acc.matches += x.matches; acc.points += x.points; acc.tries += x.tries;
      return acc;
    },
    { matches: 0, points: 0, tries: 0 },
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Link href={`/teams/${p.teamSlug}`} className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-sm mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> {p.team}
        </Link>

        {/* Hero */}
        <div className="flex items-center gap-4 mb-8">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={p.team} className="w-16 h-16 rounded-full object-cover ring-2 ring-zinc-800 flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-black flex-shrink-0">
              {p.team.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">{p.name}</h1>
            <Link href={`/teams/${p.teamSlug}`} className="text-zinc-400 text-sm hover:text-white transition-colors">{p.team}</Link>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: BarChart3, label: "Partidos", val: totals.matches, color: "text-zinc-300" },
            { icon: Target, label: "Puntos", val: totals.points, color: "text-blue-400" },
            { icon: Zap, label: "Tries", val: totals.tries, color: "text-emerald-400" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
                <Icon className={`h-4 w-4 mx-auto mb-2 ${s.color}`} />
                <p className="text-2xl font-black text-white">{s.val}</p>
                <p className="text-zinc-600 text-xs uppercase tracking-wide">{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Per-division breakdown */}
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3">Por división</h2>
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900/80 border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-500 text-xs uppercase tracking-wide font-semibold">División</th>
                {COLS.map((c) => (
                  <th key={c.key} className="text-center px-2 py-3 text-zinc-500 text-xs uppercase tracking-wide font-semibold">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {divs.map((d) => {
                const x = p.byDivision[d];
                return (
                  <tr key={d} className="border-b border-zinc-800 last:border-0">
                    <td className="px-4 py-3 font-semibold text-zinc-200">{DIV_LABEL[d]}</td>
                    {COLS.map((c) => (
                      <td key={c.key} className={`text-center px-2 py-3 tabular-nums ${c.key === "points" ? "font-black text-white" : "text-zinc-400"}`}>
                        {x[c.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-zinc-600 text-center mt-6">
          Datos oficiales: <a href="https://arusa.cl" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400">arusa.cl</a>
        </p>
      </div>
    </div>
  );
}
