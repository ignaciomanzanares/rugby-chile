import type { FormMatch } from "@/lib/use-team-form";

const STYLES: Record<FormMatch["result"], { cls: string; letter: string }> = {
  W: { cls: "bg-emerald-600 text-white", letter: "G" }, // Ganado
  D: { cls: "bg-zinc-600 text-white", letter: "E" },     // Empate
  L: { cls: "bg-red-700 text-white", letter: "P" },      // Perdido
};

/**
 * Last-N results as colored G/E/P pills, oldest → newest (newest on the right),
 * matching how pro league tables show form. `form` is expected newest-first.
 */
export function FormPills({ form, max = 5 }: { form: FormMatch[] | undefined; max?: number }) {
  const recent = (form ?? []).slice(0, max).reverse();
  if (recent.length === 0) {
    return <span className="text-zinc-700 text-xs">—</span>;
  }
  return (
    <div className="flex items-center gap-1">
      {recent.map((m, i) => {
        const s = STYLES[m.result];
        return (
          <span
            key={i}
            title={`${m.home ? "vs" : "@"} ${m.opponent} · ${m.scoreFor}-${m.scoreAgainst}${m.round ? ` · Fecha ${m.round}` : ""}`}
            className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black ${s.cls}`}
          >
            {s.letter}
          </span>
        );
      })}
    </div>
  );
}
