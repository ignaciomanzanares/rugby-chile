import type { MetadataRoute } from "next";

const BASE = "https://top10chile.vercel.app";

// robots.txt: dejar indexar todo lo público, bloquear lo privado/utilitario, y
// apuntar al sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/perfil", "/scorer", "/login", "/offline"],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
