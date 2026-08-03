# Deploy gratis — rugby-chile

Stack 100% gratis, sin tarjeta (julio 2026):

| Pieza | Dónde | Notas |
|---|---|---|
| **Web** (Next.js) | **Vercel** Hobby | Gratis. Solo necesita `NEXT_PUBLIC_API_URL`. |
| **API** (Fastify) | **Render** free web service | Duerme tras 15 min sin uso (cold start ~30-50s). |
| **Postgres** | **Neon** free | Persistente; guarda tabla/cache/historial. |

> El web NO toca la DB directo: todo pasa por la API. Por eso en Vercel alcanza con apuntar a la API.

Todo se conecta desde este repo de GitHub (`ignaciomanzanares/rugby-chile`), rama `main`.

---

## 1) Base de datos — Neon (~3 min)
1. Entrá a **neon.tech** → *Sign up with GitHub* (sin tarjeta).
2. *Create project* → nombre `rugby-chile`, región cercana (p. ej. AWS us-east).
3. Copiá el **connection string** (elegí el **Pooled connection**), tiene forma:
   `postgresql://USER:PASS@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. Guardalo — es tu `DATABASE_URL`.
5. Crear las tablas (desde tu compu, una sola vez):
   ```bash
   cd api
   DATABASE_URL="<el string de Neon>" npm run db:push
   ```
   La app igual llena datos sola (sincroniza arusa al arrancar y reconstruye el historial).

## 2) API — Render (~5 min)
1. Entrá a **render.com** → *Sign up with GitHub* (sin tarjeta).
2. *New* → *Blueprint* → elegí el repo `rugby-chile`. Render lee `render.yaml` y crea el servicio `rugby-chile-api`.
3. En *Environment*, completá los 3 secretos (`sync: false` en `render.yaml`):
   - `DATABASE_URL` = el string de Neon del paso 1.
   - `JWT_SECRET` = **obligatorio** — la API no arranca sin esto (firma los cookies de
     sesión). Generá uno fuerte: `openssl rand -hex 32`.
   - `WEB_URL` = lo dejás por ahora en `https://rugby-chile.vercel.app` (se ajusta en el paso 3 si el dominio cambia).

   > `NODE_ENV=production` ya viene fijado en `render.yaml` (habilita los cookies
   > `Secure` + `SameSite=None` para el auth cross-site web↔api). `PORT` lo inyecta Render solo.
4. *Deploy*. Cuando termine, copiá la URL pública (ej. `https://rugby-chile-api.onrender.com`).
5. Probá `https://rugby-chile-api.onrender.com/health` → debe responder `{"status":"ok","timestamp":"…"}`.

## 3) Web — Vercel (~3 min)
1. Entrá a **vercel.com** → *Sign up with GitHub*.
2. *Add New… → Project* → importá `rugby-chile`.
3. **Root Directory**: `web`.  Framework: Next.js (autodetectado).
4. *Environment Variables*:
   - `NEXT_PUBLIC_API_URL` = la URL de Render del paso 2 (ej. `https://rugby-chile-api.onrender.com`).
5. *Deploy*. Te da un dominio tipo `https://rugby-chile.vercel.app`.
6. Volvé a Render → actualizá `WEB_URL` con ese dominio exacto (para el CORS) → *Manual Deploy* o esperá el redeploy. `WEB_URL` admite **varios orígenes separados por coma** (`https://a.vercel.app,https://b.vercel.app`), útil si agregás un alias de dominio y querés que ambos sigan funcionando.

---

## El cold-start de Render y los cron jobs (importante)

El free de Render **suspende el servicio tras 15 min sin tráfico**. Dos consecuencias:

1. **Cold start**: la primera visita tras el idle tarda ~30-50 s en responder.
2. **Los cron jobs se pausan mientras está dormido** — corren con `node-cron` dentro
   del proceso, así que si Render lo suspende, se pausan: el poller de scores en vivo
   (cada minuto, jue-dom), el sync de fixtures (15 min), las noticias (6 h) y el
   warm-sync de arusa (45 s). El backfill de marcadores es durable (cache en DB), así
   que **no se pierde nada**: se pone al día apenas el servicio despierta.

**Impacto real:** para un portafolio de tráfico bajo, el único problema molesto es el
marcador **en vivo** durante un partido — si nadie está en el sitio, el poller no corre.
Durante un partido suele haber tráfico (que lo mantiene despierto), pero puede haber huecos.

**Recomendación (por orden de costo):**

| Opción | Costo | Qué te da |
|---|---|---|
| **Free + keep-alive ping** (recomendada) | **US$0** | Un ping a `/health` cada ~10 min desde **cron-job.org** (gratis) o un **GitHub Action** programado lo mantiene despierto → sin cold-start y los crons corren. Un servicio 24/7 usa ~730 h/mes, dentro de las 750 h gratis de Render. |
| **Render Starter** | **US$7/mes** | Nunca se duerme; live scoring y crons 100% confiables. Neon y Vercel siguen gratis. |
| **VPS chico** (Hetzner ~€4, Oracle Cloud Always Free) | US$0-4/mes | Siempre encendido, pero te auto-gestionás Postgres + Node + reverse proxy. Más trabajo; no vale la pena vs. Neon+Render para esto. |

Para arrancar: **free + keep-alive ping**. Subí a Render Starter (US$7/mes) solo si querés
el marcador en vivo a prueba de balas durante los partidos.

## Actualizaciones
Cada `git push` a `main` redeploya solo web (Vercel) y API (Render).

## Variables de entorno en producción (resumen)

| Servicio | Variable | Notas |
|---|---|---|
| **Render** (API) | `DATABASE_URL` | Neon (Pooled, `?sslmode=require`) |
| | `JWT_SECRET` | obligatorio (`openssl rand -hex 32`) |
| | `WEB_URL` | dominio(s) exacto(s) de Vercel para CORS; varios se separan por coma |
| | `NODE_ENV` | `production` (ya fijado en `render.yaml`) |
| | `PORT` | lo inyecta Render (no setear) |
| **Vercel** (web) | `NEXT_PUBLIC_API_URL` | **la única** que necesita el web |

> El web es 100% cliente-de-la-API: no consulta la DB ni usa next-auth en runtime, así
> que en Vercel **no** hace falta `DATABASE_URL` ni `NEXTAUTH_*`.
