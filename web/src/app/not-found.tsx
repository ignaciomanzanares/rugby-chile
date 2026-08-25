import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-5">
        <Image
          src="/top10-itau-logo.png"
          alt="Top 10"
          width={80}
          height={80}
          className="h-20 w-auto object-contain mx-auto opacity-90"
        />
        <div>
          <p className="text-4xl font-black text-red-600">404</p>
          <h1 className="text-xl font-black mt-1">Página no encontrada</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Esta página no existe o se movió. Vuelve al inicio y sigue el torneo.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
