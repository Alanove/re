import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "icons");

function svgFor(size) {
  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.42);
  const barWidth = Math.round(size * 0.28);
  const barHeight = Math.max(2, Math.round(size * 0.035));
  const barY = Math.round(size * 0.7);
  const textY = Math.round(size * 0.58);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#0f6b4c"/>
  <text x="50%" y="${textY}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#f6f4ef">FF</text>
  <rect x="${(size - barWidth) / 2}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="${barHeight / 2}" fill="#f6f4ef" opacity="0.85"/>
</svg>`;
}

await mkdir(outDir, { recursive: true });

for (const size of [192, 512]) {
  const buffer = await sharp(Buffer.from(svgFor(size)))
    .png()
    .toBuffer();
  const file = path.join(outDir, `icon-${size}.png`);
  await writeFile(file, buffer);
  console.log(`wrote ${file}`);
}
