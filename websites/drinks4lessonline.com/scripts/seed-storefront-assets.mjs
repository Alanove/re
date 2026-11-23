import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env.development') });

const uploadsSrc = path.join(
  root,
  'legacy',
  'drinks',
  'public_html',
  'wp-content',
  'uploads',
  '2024',
  '01'
);
const outDir = path.join(root, 'public', 'images', 'd4l');
fs.mkdirSync(outDir, { recursive: true });

async function toWebp(srcName, destName, maxWidth = 1600) {
  const src = path.join(uploadsSrc, srcName);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source image: ${src}`);
  }
  const dest = path.join(outDir, destName);
  await sharp(src)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(dest);
  console.log('wrote', destName);
  return `/images/d4l/${destName}`;
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

function randomPassword() {
  return crypto.randomBytes(9).toString('base64url');
}

async function main() {
  // Live hero is the cigarette + beer lifestyle shot (portrait source, cropped wide).
  const heroSrc = path.join(
    root,
    'legacy',
    'drinks',
    'public_html',
    'wp-content',
    'uploads',
    'product-images',
    'banner-drink-cigarette.jpg'
  );
  const heroDest = path.join(outDir, 'hero.webp');
  const heroBuf = await sharp(heroSrc).rotate().resize({ width: 1920 }).toBuffer({ resolveWithObject: true });
  const heroTop = Math.round(heroBuf.info.height * 0.22);
  await sharp(heroBuf.data)
    .extract({ left: 0, top: heroTop, width: heroBuf.info.width, height: 720 })
    .webp({ quality: 85 })
    .toFile(heroDest);
  console.log('wrote hero.webp');
  const hero = '/images/d4l/hero.webp';
  const cats = {
    cigarettes: await toWebp('TMCJA3RVT5NXPHLRBQ25JZDY7U.png', 'cat-cigarettes.webp', 900),
    cigars: await toWebp('cohibacover-copy.png', 'cat-cigars.webp', 700),
    shisha: await toWebp('awesome-sauce-creative-OUGqm1DjYIc-unsplash.png', 'cat-shisha.webp', 700),
    spirits: await toWebp('connor-home-DrYUAEXsNyE-unsplash.png', 'cat-spirits.webp', 1400),
    wines: await toWebp('hermes-rivera-aK6WGqxyHFw-unsplash.png', 'cat-wines.webp', 1200),
    gifts: await toWebp('amy-shamblen-M-dLdqCVfAY-unsplash.png', 'cat-gifts.webp', 1200)
  };
  await toWebp('vinicius-amnx-amano-V1zGiNVPumM-unsplash.jpg', 'editorial-whisky.webp', 1100);
  await toWebp('immo-wegmann-NqTwtv-eiY-unsplash.jpg', 'editorial-ecig.webp', 1100);
  await toWebp('alessandro-crosato-G5fU1Uf2a-Q-unsplash.png', 'editorial-regie.webp', 900);
  await toWebp('Group-35137.png', 'crown.webp', 80);
  await toWebp('Group-35137.png', 'icon-buy-more.webp', 80);
  await toWebp('guarantee.png', 'icon-quality.webp', 80);
  await toWebp('fast-delivery.png', 'icon-delivery.webp', 80);
  await toWebp('cash-on-delivery.png', 'icon-cod.webp', 80);
  await toWebp('Mask-Group-3.png', 'promises-art.webp', 900);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'drinks4less',
    multipleStatements: true
  });

  try {
    await conn.query(
      `ALTER TABLE users ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'en' AFTER role`
    );
    console.log('Added users.language');
  } catch (err) {
    if (!/Duplicate column/i.test(String(err.message || err))) throw err;
  }

  for (const [slug, url] of Object.entries(cats)) {
    await conn.query(
      `UPDATE product_categories SET image_url = ?, thumb_url = ?, is_active = 1 WHERE slug = ?`,
      [url, url, slug]
    );
  }

  await conn.query(`DELETE FROM slider`);
  await conn.query(
    `INSERT INTO slider (title, subtitle, image_url, link_url, link_text, order_index, is_active, duration_seconds)
     VALUES (?, ?, ?, ?, ?, 1, 1, 5)`,
    [
      'A PUFF - A DRINK\nTHE RIGHT PRICE',
      'Hero',
      hero,
      '/our-categories',
      'SHOP NOW'
    ]
  );

  // Featured carousel needs products; mark a handful of published spirits as featured.
  await conn.query(`UPDATE products SET is_featured = 0`);
  await conn.query(
    `UPDATE products SET is_featured = 1
     WHERE status = 'published' AND is_active = 1
     ORDER BY created_at DESC
     LIMIT 12`
  );

  const admins = [
    { email: 'george@wadihco.com', role: 'Admin', username: 'george' },
    { email: 'roubarizk@yahoo.com', role: 'Admin', username: 'Rouba' },
    { email: 'alanove@gmail.com', role: 'Super Admin', username: 'alanove' }
  ];
  const lines = [];
  for (const admin of admins) {
    const password = randomPassword();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    await conn.query(
      `UPDATE users SET username = ?, role = ?, status = 'Active', password = ?, salt = ? WHERE email = ?`,
      [admin.username, admin.role, hash, salt, admin.email]
    );
    lines.push(`${admin.role}\t${admin.username}\t${admin.email}\t${password}`);
  }
  const passwordFile = path.join(root, 'legacy', 'admin-passwords.txt');
  fs.writeFileSync(passwordFile, lines.join('\n') + '\n', 'utf8');
  console.log('Admin passwords written to', passwordFile);
  console.log(lines.join('\n'));

  await conn.end();
  console.log('Storefront assets seeded.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
