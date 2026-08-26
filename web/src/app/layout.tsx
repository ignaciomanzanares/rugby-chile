import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { LiveTicker } from "@/components/live-ticker";
import { AuthProvider } from "@/lib/auth";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { InstallPrompt } from "@/components/install-prompt";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#1a365d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: "Top 10 | Rugby Chile",
    template: "%s | Top 10 ARUSA",
  },
  description: "Resultados, tablas y estadísticas de la Primera Nacional Top 10 ARUSA",
  keywords: ["rugby", "chile", "top 10", "arusa", "primera division"],
  // Base absoluta para que las URLs relativas (OG image) resuelvan al compartir.
  metadataBase: new URL("https://top10chile.vercel.app"),
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: "https://top10chile.vercel.app",
    siteName: "Top 10 · Rugby Chile",
    title: "Top 10 | Rugby Chile",
    description: "Resultados en vivo, tablas, estadísticas y una proyección Monte Carlo de la Primera Nacional Top 10 ARUSA",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Top 10 · Rugby Chile" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Top 10 | Rugby Chile",
    description: "Resultados, tablas, estadísticas y proyección del Top 10 ARUSA",
    images: ["/og.png"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Top 10",
  },
  icons: {
    icon: [
      { url: "/favicon.ico",  sizes: "any" },
      { url: "/favicon.png",  sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint to avoid a flash. Default: light. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="application-name" content="Top 10" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Top 10" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#1a365d" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className="min-h-full flex flex-col bg-background">
        {/* Structured data (JSON-LD) para Google: sitio + organización deportiva. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Top 10 · Rugby Chile",
              url: "https://top10chile.vercel.app",
              description: "Resultados en vivo, tablas, estadísticas y proyección de la Primera Nacional Top 10 ARUSA (rugby, Santiago de Chile).",
              inLanguage: "es-CL",
            },
            {
              "@context": "https://schema.org",
              "@type": "SportsOrganization",
              name: "Itaú Top 10 · Primera Nacional ARUSA",
              alternateName: "Top 10 Rugby Chile",
              sport: "Rugby union",
              url: "https://top10chile.vercel.app",
              logo: "https://top10chile.vercel.app/top10-itau-logo.png",
              areaServed: "Santiago, Chile",
            },
          ]) }}
        />
        <AuthProvider>
          <ServiceWorkerRegister />
          <Navigation />
          <InstallPrompt />
          <LiveTicker />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border bg-background py-8">
          <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <p className="text-sm text-muted-foreground/70 text-center">
              © 2026 Top 10 · Rugby Chile · No oficial · Datos:{" "}
              <a href="https://arusa.cl" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">
                arusa.cl
              </a>
            </p>
          </div>
          </footer>
        </AuthProvider>
        {/* Vercel Web Analytics: cuenta visitas/visitantes anónimos (sin cookies,
            no requiere cuenta). Hay que activar "Web Analytics" en el dashboard
            del proyecto en Vercel para que empiece a registrar. */}
        <Analytics />
      </body>
    </html>
  );
}
