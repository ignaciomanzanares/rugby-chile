import type { MetadataRoute } from "next";

const BASE = "https://top10chile.vercel.app";

const CLUB_SLUGS = [
  "cobs", "old-boys", "pwcc", "old-macks", "stade-francais",
  "sporting-rc", "dobs", "uc", "old-johns", "old-reds",
];

// Sitemap para Google. Solo páginas PÚBLICAS (se omiten login/perfil/scorer/
// offline, que son privadas o utilitarias). Las de datos vivos (live, tabla,
// resultados) cambian seguido → changeFrequency alta.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]) =>
    ({ url: `${BASE}${path}`, lastModified: now, changeFrequency, priority });

  return [
    page("/", 1.0, "hourly"),
    page("/live", 0.9, "hourly"),
    page("/standings", 0.9, "daily"),
    page("/schedule", 0.8, "daily"),
    page("/estadisticas", 0.8, "daily"),
    page("/proyeccion", 0.8, "daily"),
    page("/predict", 0.7, "daily"),
    page("/leaderboard", 0.6, "weekly"),
    page("/fantasy", 0.8, "daily"),
    page("/fantasy/leaderboard", 0.7, "daily"),
    page("/news", 0.7, "daily"),
    page("/reglamento", 0.5, "monthly"),
    page("/teams", 0.7, "weekly"),
    ...CLUB_SLUGS.map((s) => page(`/teams/${s}`, 0.6, "weekly")),
  ];
}
