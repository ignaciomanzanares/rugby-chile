// Genera los iconos PWA desde el logo Top 10 sobre fondo navy (consistente con
// la OG). Dos propósitos:
//  - "any": logo grande (~78%) en cada tamaño del manifest.
//  - "maskable": más padding (~58%) para que Android no recorte el logo.
// Correr con: node scripts/build-pwa-icons.js
const sharp = require("sharp");
const path = require("path");

const pub = path.join(__dirname, "..", "public");
const SRC = path.join(pub, "top10-itau-logo.png");
const NAVY = { r: 0x0f, g: 0x1a, b: 0x2e, alpha: 1 };
const ANY_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function make(size, frac, outfile) {
  const h = Math.round(size * frac);
  const logo = await sharp(SRC).resize({ height: h }).toBuffer();
  const m = await sharp(logo).metadata();
  const left = Math.round((size - (m.width ?? h)) / 2);
  const top = Math.round((size - h) / 2);
  await sharp({ create: { width: size, height: size, channels: 4, background: NAVY } })
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(path.join(pub, outfile));
}

(async () => {
  for (const s of ANY_SIZES) await make(s, 0.78, `icons/icon-${s}x${s}.png`);
  await make(192, 0.58, "icons/maskable-192x192.png");
  await make(512, 0.58, "icons/maskable-512x512.png");
  await make(180, 0.74, "icons/apple-touch-icon.png");
  console.log("iconos generados:", ANY_SIZES.map((s) => `${s}²`).join(" "), "+ maskable 192/512 + apple 180");
})();
