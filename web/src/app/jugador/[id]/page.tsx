export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Target, Zap, BarChart3 } from "lucide-react";
import { clubLogo } from "@/lib/tournament";
import { getPositionInfo, POSITION_LABELS } from "@/lib/fantasy";

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
    // Acotado bajo el límite de ~10s de las funciones de Vercel: sin esto, una
    // API fría dejaba la request colgada hasta que Vercel la cortaba.
    const r = await fetch(`${API_URL}/api/v1/stats/player/${id}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
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
  const pos = getPositionInfo(p.id);
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Link href={`/teams/${p.teamSlug}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> {p.team}
        </Link>

        {/* Hero */}
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/teams/${p.teamSlug}`} title={`Ver ${p.team}`} className="inline-flex hover:opacity-90 transition-opacity flex-shrink-0">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={p.team} className="w-16 h-16 rounded-full object-cover ring-2 ring-border flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-lg font-black flex-shrink-0">
                {p.team.slice(0, 2).toUpperCase()}
              </div>
            )}
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">{p.name}</h1>
            <Link href={`/teams/${p.teamSlug}`} className="text-muted-foreground text-sm hover:text-foreground transition-colors">{p.team}</Link>
            {pos && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-bold uppercase tracking-wide px-2 py-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  {POSITION_LABELS[pos.primary]}
                </span>
                {pos.secondary && (
                  <span className="text-xs font-medium px-2 py-1 rounded bg-muted text-muted-foreground border border-border">
                    2ª: {POSITION_LABELS[pos.secondary]}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: BarChart3, label: "Partidos", val: totals.matches, color: "text-foreground/80" },
            { icon: Target, label: "Puntos", val: totals.points, color: "text-blue-400" },
            { icon: Zap, label: "Tries", val: totals.tries, color: "text-emerald-400" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl border border-border bg-card/50 p-4 text-center">
                <Icon className={`h-4 w-4 mx-auto mb-2 ${s.color}`} />
                <p className="text-2xl font-black text-foreground">{s.val}</p>
                <p className="text-muted-foreground/70 text-xs uppercase tracking-wide">{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Per-division breakdown */}
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Por división</h2>
        {/* overflow-x-auto: 10 columnas (División + 9 stats) no entran en un
            teléfono; con overflow-hidden se recortaban. Ahora la tabla scrollea
            horizontal dentro de su caja y mantiene las columnas legibles. */}
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-card/80 border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground text-xs uppercase tracking-wide font-semibold">División</th>
                {COLS.map((c) => (
                  <th key={c.key} className="text-center px-2 py-3 text-muted-foreground text-xs uppercase tracking-wide font-semibold">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {divs.map((d) => {
                const x = p.byDivision[d];
                return (
                  <tr key={d} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-semibold text-foreground">{DIV_LABEL[d]}</td>
                    {COLS.map((c) => (
                      <td key={c.key} className={`text-center px-2 py-3 tabular-nums ${c.key === "points" ? "font-black text-foreground" : "text-muted-foreground"}`}>
                        {x[c.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground/70 text-center mt-6">
          Datos oficiales: <a href="https://arusa.cl" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground">arusa.cl</a>
        </p>
      </div>
    </div>
  );
}
