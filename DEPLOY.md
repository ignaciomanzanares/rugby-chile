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
3. En *Environment*, completá:
   - `DATABASE_URL` = el string de Neon del paso 1.
   - `WEB_URL` = lo dejás por ahora en `https://rugby-chile.vercel.app` (se ajusta en el paso 3 si el dominio cambia).
   - `IG_USERNAME` / `IG_PASSWORD` = **vacío** por ahora (Instagram suele bloquear IPs de la nube; las nóminas quedan off).
4. *Deploy*. Cuando termine, copiá la URL pública (ej. `https://rugby-chile-api.onrender.com`).
5. Probá `https://rugby-chile-api.onrender.com/health` → debe responder `{"ok":true}`.

## 3) Web — Vercel (~3 min)
1. Entrá a **vercel.com** → *Sign up with GitHub*.
2. *Add New… → Project* → importá `rugby-chile`.
3. **Root Directory**: `web`.  Framework: Next.js (autodetectado).
4. *Environment Variables*:
   - `NEXT_PUBLIC_API_URL` = la URL de Render del paso 2 (ej. `https://rugby-chile-api.onrender.com`).
5. *Deploy*. Te da un dominio tipo `https://rugby-chile.vercel.app`.
6. Volvé a Render → actualizá `WEB_URL` con ese dominio exacto (para el CORS) → *Manual Deploy* o esperá el redeploy.

---

## Mantener la API despierta (opcional, para el marcador en vivo)
El free de Render duerme. Para que el cron de auto-scoring corra los fines de semana, pingueá `/health` cada 10 min con **cron-job.org** (gratis) o un GitHub Action. Entre semana no hace falta.

## Actualizaciones
Cada `git push` a `main` redeploya solo web (Vercel) y API (Render).

## Costo
Cero mientras todo esté en free. Si querés que la API no se duerma nunca: Render Starter (~7 USD/mes) o un VPS.
