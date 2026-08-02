# Contribuir / convenciones de desarrollo

Proyecto de un solo desarrollador. Estas son las convenciones, deliberadamente
livianas para no meter overhead que no se justifica en solitario.

## Setup

Ver el [README](./README.md) (requisitos, `.env`, `npm run dev`).

## Flujo de ramas — recomendación

Para un solo dev, imponer PRs y ramas por todo es fricción sin retorno. La regla
pragmática:

- **Cambios chicos y seguros** (contenido, fixes de UI, ajustes de copy) → commit
  directo a `main`. Está bien.
- **Cambios riesgosos o grandes** (auth, scrapers, migraciones de schema, refactors) →
  **rama corta** (`feat/…`, `fix/…`, `chore/…`, `sec/…`, `docs/…`) y merge cuando
  esté verde (tsc + tests). Así `main` siempre queda deployable.
- **Antes de mergear a `main`**: `npm run test` y `npm run build` deben pasar.

Si algún día el repo suma colaboradores, ahí sí conviene proteger `main` y exigir PRs.

## Mensajes de commit

Se usa **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `sec:`, con
scope opcional, p. ej. `feat(nóminas): …`). Ayuda a que el historial se lea como un
changelog.

## Nota importante sobre Next.js

La versión de Next.js de este repo tiene breaking changes respecto a lo conocido.
**Antes de escribir código de Next.js, leé la guía en `node_modules/next/dist/docs/`**
(detalle en [`web/AGENTS.md`](./web/AGENTS.md)).

## Datos y scraping

Los datos son de **ARUSA** y **Leverade/Clupik** (ver atribución en el README y el
`LICENSE`). Todo scraper debe: identificarse con el `User-Agent` del proyecto (enlaza
a este repo), respetar `robots.txt`, cachear y hacer backoff. No agregar fuentes que
requieran sortear autenticación o un control de acceso.
