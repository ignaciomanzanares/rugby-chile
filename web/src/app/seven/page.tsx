import type { Metadata } from "next";
import { SevenView } from "@/components/seven/seven-view";
import { fetchSeven } from "@/lib/seven-api";

// El circuito avanza de a un sábado: con revalidar cada 5 min sobra, y el
// cliente reintenta si el servidor no alcanzó a traerlo.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Seven | Top 10 Rugby Chile",
  description: "Circuito de Seven de ARUSA: tabla acumulada, etapas y las copas de Oro, Plata y Bronce.",
};

export default async function Page() {
  const circuito = await fetchSeven({
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(3500),
  }).catch(() => null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-black uppercase tracking-widest">Circuito de Seven</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Asociación Rugby de Santiago · 2026
          </p>
        </div>
      </section>
      <div className="container mx-auto px-4 py-8 pb-24">
        <SevenView initial={circuito} />
      </div>
    </div>
  );
}
