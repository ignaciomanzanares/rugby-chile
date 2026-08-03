// Genera public/og.png (1200x630) branded: logo Top 10 centrado sobre fondo
// navy con bajada. Correr con: node scripts/build-og.js
const sharp = require("sharp");
const path = require("path");

const W = 1200, H = 630;
const pub = path.join(__dirname, "..", "public");

const bg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a1526"/>
      <stop offset="1" stop-color="#16294a"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="34%" r="42%">
      <stop offset="0" stop-color="#2a4a80" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#2a4a80" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- barra de acento roja inferior -->
  <rect x="0" y="${H - 10}" width="${W}" height="10" fill="#dc2626"/>

  <text x="${W / 2}" y="452" text-anchor="middle"
        font-family="'DejaVu Sans','Liberation Sans',sans-serif" font-weight="700"
        font-size="46" letter-spacing="10" fill="#ffffff">PRIMERA DIVISIÓN</text>

  <text x="${W / 2}" y="496" text-anchor="middle"
        font-family="'DejaVu Sans','Liberation Sans',sans-serif" font-weight="400"
        font-size="25" letter-spacing="4" fill="#9fb3d1">ASOCIACIÓN DE RUGBY DE SANTIAGO</text>

  <text x="${W / 2}" y="556" text-anchor="middle"
        font-family="'DejaVu Sans','Liberation Sans',sans-serif" font-weight="600"
        font-size="28" fill="#f5b942">Resultados en vivo · Tablas · Estadísticas · Proyección</text>
</svg>`);

(async () => {
  const logoH = 268;
  const logo = await sharp(path.join(pub, "top10-itau-logo.png"))
    .resize({ height: logoH })
    .toBuffer();
  const meta = await sharp(logo).metadata();
  const left = Math.round((W - meta.width) / 2);

  await sharp(bg)
    .composite([{ input: logo, top: 84, left }])
    .png()
    .toFile(path.join(pub, "og.png"));

  console.log("og.png escrito:", meta.width + "x" + logoH, "logo centrado en left=" + left);
})();
