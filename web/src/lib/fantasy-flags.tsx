import Link from "next/link";
import { Trophy, Clock } from "lucide-react";

// Interruptor del fantasy. Modelo Seis Naciones (XV por posición + capitán +
// super sub, 16 jugadores). PUBLICADO (ago-2026). Para volver a "Próximamente":
// `process.env.NODE_ENV === "development"`.
export const FANTASY_LIVE = true;

export function FantasyComingSoon() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold tracking-widest uppercase">
          <Clock className="h-3.5 w-3.5" /> Próximamente
        </div>
        <div className="flex justify-center"><Trophy className="h-14 w-14 text-amber-400" /></div>
        <h1 className="text-3xl font-black tracking-tight">
          <span className="text-amber-400">Fantasy</span> Top 10
        </h1>
        <p className="text-muted-foreground">
          Estamos armando el nuevo Fantasy: tu XV por posición, capitán y un super sub.
          Vuelve pronto para competir contra otros hinchas.
        </p>
        <Link href="/" className="inline-block px-5 py-2.5 rounded-lg bg-amber-500 text-black font-bold text-sm">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
