// Proxy de scraping para arusa.cl — versión Deno Deploy.
//
// Por qué: arusa banea por IP y los bans duran horas/días, así que UN solo IP de
// egreso (el Cloudflare Worker) no alcanza para garantizar el minuto-a-minuto en
// vivo. Deno Deploy egresa por IPs de OTRO proveedor → sumás un rango de IP más
// al pool. El backend (api/src/lib/leverade.ts, arusaFetch) rota entre todos los
// proxies de ARUSA_PROXY (lista separada por comas) y hace failover ante 429.
//
// Gratis: Deno Deploy free tier alcanza de sobra. Solo proxea a arusa.cl.
// Deploy:
//   1) Ir a https://dash.deno.com → New Project → "Deploy from GitHub" o
//      "Playground". Pegar este archivo.
//   2) (Opcional) Settings → Environment Variables → PROXY_SECRET = <el mismo
//      valor que ARUSA_PROXY_SECRET en Render>.
//   3) Copiar la URL (https://<proyecto>.deno.dev) y agregarla a ARUSA_PROXY en
//      Render, separada por coma del Worker de Cloudflare. Ej:
//      ARUSA_PROXY=https://arusa-proxy.fallacious-wrist.workers.dev,https://<proyecto>.deno.dev

Deno.serve(async (req: Request) => {
  const u = new URL(req.url);
  const target = u.searchParams.get("url");

  // Salud: GET / sin ?url → ok.
  if (!target) {
    return new Response(JSON.stringify({ ok: true, worker: "arusa-proxy-deno" }), {
      headers: { "content-type": "application/json" },
    });
  }

  // Solo arusa.cl — no es un proxy abierto.
  if (!/^https:\/\/arusa\.cl\//.test(target)) {
    return new Response("forbidden target", { status: 403 });
  }

  // Secreto opcional.
  const secret = Deno.env.get("PROXY_SECRET");
  if (secret && req.headers.get("x-proxy-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  // Reenviar con headers del cliente (limpiando los de infraestructura).
  const fwd = new Headers();
  for (const [k, v] of req.headers) {
    const lk = k.toLowerCase();
    if (["host", "x-proxy-secret", "cf-connecting-ip", "x-forwarded-for", "x-forwarded-proto", "x-real-ip"].includes(lk)) continue;
    if (lk.startsWith("cf-")) continue;
    fwd.set(k, v);
  }
  if (!fwd.has("user-agent")) {
    fwd.set("user-agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36");
  }

  const method = req.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  let res: Response;
  try {
    res = await fetch(target, { method, headers: fwd, body, redirect: "manual" });
  } catch (e) {
    return new Response(`proxy fetch error: ${e}`, { status: 502 });
  }

  // Pasar status real (incluido 429, para que el breaker haga backoff), el
  // content-type, y el Set-Cookie como X-Set-Cookie (por si se necesita sesión).
  const out = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) out.set("content-type", ct);
  const sc = res.headers.get("set-cookie");
  if (sc) out.set("x-set-cookie", sc);
  return new Response(res.body, { status: res.status, headers: out });
});
