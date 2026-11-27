const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const logoPath = path.join(root, 'public', 'images', 'logo-1759813853497-882930560.png');
const outDir = path.join(root, 'public', 'pwa', 'icons');
const bg = { r: 247, g: 243, b: 238, alpha: 1 };

fs.mkdirSync(outDir, { recursive: true });

async function makeAccount(size) {
  const pad = Math.round(size * 0.14);
  const logo = await sharp(logoPath)
    .resize(size - pad * 2, size - pad * 2, { fit: 'contain', background: bg })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg }
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(path.join(outDir, `account-${size}.png`));
}

function gateBadgeSvg() {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#C87E2F"/>
      <path d="M16 48V20c0-2 1.5-4 4-4h24c2.5 0 4 2 4 4v28" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      <path d="M32 16v32" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      <circle cx="38" cy="34" r="2.5" fill="#fff"/>
    </svg>`
  );
}

async function makeGate(size) {
  const pad = Math.round(size * 0.14);
  const logo = await sharp(logoPath)
    .resize(size - pad * 2, size - pad * 2, { fit: 'contain', background: bg })
    .png()
    .toBuffer();
  const badgeSize = Math.round(size * 0.38);
  const badge = await sharp(gateBadgeSvg()).resize(badgeSize, badgeSize).png().toBuffer();
  const margin = Math.round(size * 0.06);
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg }
  })
    .composite([
      { input: logo, gravity: 'centre' },
      { input: badge, top: size - badgeSize - margin, left: size - badgeSize - margin }
    ])
    .png()
    .toFile(path.join(outDir, `gate-${size}.png`));
}

(async () => {
  for (const size of [192, 512]) {
    await makeAccount(size);
    await makeGate(size);
  }
  console.log('icons written', fs.readdirSync(outDir).join(', '));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
