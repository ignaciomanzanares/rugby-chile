import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Sin conexión" };

export default function OfflinePage() {
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
          <h1 className="text-xl font-black">Sin conexión</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            No pudimos conectarnos. Lo último que viste sigue disponible; cuando vuelva internet se
            actualiza solo.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
        >
          Reintentar
        </Link>
      </div>
    </div>
  );
}
