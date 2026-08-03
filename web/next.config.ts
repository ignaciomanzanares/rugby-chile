import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack's dev FileSystem cache is ON by default since Next 16.1 and
    // writes hundreds of MB of .sst files into .next/dev/cache/turbopack. On
    // this low-RAM laptop those writes saturate disk I/O (load spiked to 14)
    // and the cache had ballooned to 2.5 GB. Disable it: cold starts are a bit
    // slower, but no I/O storms and no runaway .next.
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    // Monorepo root (where package-lock.json lives). Turbopack only resolves
    // modules inside the root, so this is required to reach socket.io-client's
    // transitive deps that npm hoisted to the repo-root node_modules
    // (@socket.io/component-emitter, debug, engine.io-parser). web/-local
    // packages like tailwindcss still resolve via normal upward lookup.
    root: path.resolve(__dirname, ".."),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // The service worker must never be cached (always fetch the latest) and
        // must be served as JS so the browser accepts it.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
