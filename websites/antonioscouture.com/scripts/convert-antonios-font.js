/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * One-shot conversion of docs/antonios-font.ttf into web font formats
 * placed in public/fonts/. Run: `node scripts/convert-antonios-font.js`.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'docs', 'antonios-font.ttf');
const OUT_DIR = path.join(__dirname, '..', 'public', 'fonts');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Source font not found at', SRC);
    process.exit(1);
  }
  ensureDir(OUT_DIR);

  const ttfBuffer = fs.readFileSync(SRC);
  const ttfDest = path.join(OUT_DIR, 'antonios-display.ttf');
  fs.writeFileSync(ttfDest, ttfBuffer);
  console.log('Wrote', ttfDest);

  const ttf2woff = require('ttf2woff');
  const woffOut = ttf2woff(ttfBuffer);
  const woffDest = path.join(OUT_DIR, 'antonios-display.woff');
  fs.writeFileSync(woffDest, Buffer.from(woffOut.buffer));
  console.log('Wrote', woffDest);

  const ttf2woff2Module = require('ttf2woff2');
  const ttf2woff2 = typeof ttf2woff2Module === 'function' ? ttf2woff2Module : ttf2woff2Module.default;
  const woff2Buffer = ttf2woff2(ttfBuffer);
  const woff2Dest = path.join(OUT_DIR, 'antonios-display.woff2');
  fs.writeFileSync(woff2Dest, woff2Buffer);
  console.log('Wrote', woff2Dest);
}

main();
