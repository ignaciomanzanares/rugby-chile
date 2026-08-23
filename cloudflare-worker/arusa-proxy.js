// Cloudflare Worker: proxy de scraping para arusa.cl.
//
// Por qué: arusa banea por IP el scraping página-por-página, y la IP de Render
// quedó bloqueada (429). Las IPs de Cloudflare NO están baneadas (verificado:
// arusa responde 200 desde Cloudflare). Render le pega a este Worker y el Worker
// baja de arusa desde la IP de Cloudflare, reenviando método/headers/body.
//
// Free tier: 100.000 requests/día (de sobra). Solo proxea a arusa.cl (no es un
// proxy abierto). Opcional: PROXY_SECRET (env var) para exigir un header secreto.
//
// Deploy: pegar este archivo en un Worker nuevo en dash.cloudflare.com
// (Workers & Pages → Create → paste), o `wrangler deploy`. La URL resultante
// (https://<nombre>.<subdominio>.workers.dev) va en la env var ARUSA_PROXY de
// Render.
export default {
  async fetch(request, env) {
    const u = new URL(request.url);

    // Salud: GET / sin ?url → responde ok (para probar que el Worker vive).
    const target = u.searchParams.get("url");
    if (!target) {
      return new Response(JSON.stringify({ ok: true, worker: "arusa-proxy" }), {
        headers: { "content-type": "application/json" },
      });
    }

    // Solo arusa.cl — no es un proxy abierto.
    if (!/^https:\/\/arusa\.cl\//.test(target)) {
      return new Response("forbidden target", { status: 403 });
    }

    // Secreto opcional: si PROXY_SECRET está seteado, exigirlo en X-Proxy-Secret.
    if (env && env.PROXY_SECRET && request.headers.get("x-proxy-secret") !== env.PROXY_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }

    // Reenviar la request al target con su método/headers/body.
    const fwdHeaders = new Headers();
    for (const [k, v] of request.headers) {
      const lk = k.toLowerCase();
      if (["host", "x-proxy-secret", "cf-connecting-ip", "x-forwarded-for", "x-forwarded-proto", "x-real-ip"].includes(lk)) continue;
      if (lk.startsWith("cf-")) continue;
      fwdHeaders.set(k, v);
    }
    if (!fwdHeaders.has("user-agent")) {
      fwdHeaders.set("user-agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36");
    }

    const method = request.method;
    const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

    let res;
    try {
      res = await fetch(target, { method, headers: fwdHeaders, body, redirect: "manual" });
    } catch (e) {
      return new Response(`proxy fetch error: ${e}`, { status: 502 });
    }

    // Pasar body + status. Reenviar Set-Cookie (por si se necesita sesión) y el
    // content-type; y el status real de arusa (incluido 429) para que el breaker
    // de Render reaccione igual que si le pegara directo.
    const outHeaders = new Headers();
    const ct = res.headers.get("content-type");
    if (ct) outHeaders.set("content-type", ct);
    const ra = res.headers.get("retry-after");
    if (ra) outHeaders.set("retry-after", ra);
    // getSetCookie() junta todos los Set-Cookie; los mandamos en un header propio
    // (X-Set-Cookie) porque el runtime puede filtrar Set-Cookie en respuestas.
    const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    if (setCookies.length) outHeaders.set("x-set-cookie", setCookies.join("\n"));

    return new Response(res.body, { status: res.status, headers: outHeaders });
  },
};
