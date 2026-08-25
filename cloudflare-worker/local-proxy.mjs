// Proxy de scraping para arusa.cl — versión LOCAL (corre en tu máquina).
//
// Por qué: arusa banea las IPs de datacenter (Render/Cloudflare/Deno) en las
// páginas de partido individual (el minuto-a-minuto). Tu IP RESIDENCIAL sí pasa
// (200). Este server corre en tu casa, así que el fetch a arusa sale por tu IP
// → 200. Se expone al mundo con un túnel gratis (cloudflared) y su URL pública
// va al ARUSA_PROXY de Render. El egreso a arusa es SIEMPRE local/residencial.
//
// Uso:
//   node cloudflare-worker/local-proxy.mjs            (puerto 8788)
//   PORT=9000 PROXY_SECRET=xxx node .../local-proxy.mjs
//
// Solo proxea a arusa.cl (no es un proxy abierto).

import http from "node:http";

const PORT = Number(process.env.PORT ?? 8788);
const SECRET = process.env.PROXY_SECRET; // opcional; si se setea, exige x-proxy-secret
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    const target = u.searchParams.get("url");

    // Salud.
    if (!target) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, worker: "arusa-proxy-local" }));
      return;
    }
    // Solo arusa.cl.
    if (!/^https:\/\/arusa\.cl\//.test(target)) {
      res.writeHead(403); res.end("forbidden target"); return;
    }
    // Secreto opcional.
    if (SECRET && req.headers["x-proxy-secret"] !== SECRET) {
      res.writeHead(401); res.end("unauthorized"); return;
    }

    // Reenviar headers del cliente (limpiando infraestructura).
    const fwd = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      const lk = k.toLowerCase();
      if (["host", "x-proxy-secret", "connection", "content-length", "cf-connecting-ip", "x-forwarded-for", "x-forwarded-proto", "x-real-ip"].includes(lk)) continue;
      if (lk.startsWith("cf-")) continue;
      if (typeof v === "string") fwd.set(k, v);
    }
    if (!fwd.has("user-agent")) fwd.set("user-agent", UA);

    // Body (para POST, aunque el minuto-a-minuto ahora es GET).
    let body;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = Buffer.concat(chunks);
    }

    const upstream = await fetch(target, { method: req.method, headers: fwd, body, redirect: "manual" });
    const buf = Buffer.from(await upstream.arrayBuffer());
    const out = {};
    const ct = upstream.headers.get("content-type"); if (ct) out["content-type"] = ct;
    const sc = upstream.headers.get("set-cookie"); if (sc) out["x-set-cookie"] = sc;
    out["access-control-allow-origin"] = "*";
    res.writeHead(upstream.status, out);
    res.end(buf);
  } catch (e) {
    res.writeHead(502); res.end(`proxy error: ${e?.message ?? e}`);
  }
});

server.listen(PORT, () => {
  console.log(`arusa-proxy-local escuchando en http://localhost:${PORT}`);
  console.log(`Exponelo con:  cloudflared tunnel --url http://localhost:${PORT}`);
});
