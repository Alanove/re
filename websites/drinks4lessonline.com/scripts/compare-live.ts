/**
 * Compare the local catalogue with https://drinks4lessonline.com/
 * Writes legacy/compare-live.txt
 */
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

const LIVE = 'https://drinks4lessonline.com';
const LOCAL = 'http://localhost:3068';
const OUT = path.resolve(process.cwd(), 'legacy/compare-live.txt');

const PAGES = [
  '',
  'our-categories',
  'our-story',
  'contact-us',
  'faqs',
  'terms-and-conditions',
  'careers',
  'shipment-policy',
  'privacy-policy',
  'cart',
  'checkout'
];

async function get(url: string): Promise<{ status: number; html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
    const html = await response.text();
    return { status: response.status, html, finalUrl: response.url };
  } finally {
    clearTimeout(timer);
  }
}

function titleOf(html: string): string {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? decode(match[1]).replace(/\s+/g, ' ').trim() : '';
}

function decode(value: string): string {
  return value
    .replace(/&#36;/g, '$')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;/g, '-')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '');
}

function priceOf(html: string): number | null {
  const block = html.match(/class="price"[\s\S]{0,400}?([\d]+(?:[.,]\d{1,2})?)<span class="woocommerce-Price-currencySymbol">/);
  if (!block) return null;
  return Number(block[1].replace(',', ''));
}

function stockOf(html: string): string {
  if (/outofstock|out of stock/i.test(html)) return 'out';
  if (/instock|in stock/i.test(html)) return 'in';
  return 'unknown';
}

async function mapPool<T, R>(items: T[], size: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: size }, () => run()));
  return out;
}

async function main(): Promise<void> {
  const lines: string[] = [];
  const db = await mysql.createConnection({
    host: '127.0.0.1',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'drinks4less'
  });
  const [products] = await db.query<any[]>(
    `SELECT slug, name, price, status, stock_quantity, track_inventory FROM products ORDER BY status, name`
  );
  await db.end();

  lines.push('PAGES');
  for (const page of PAGES) {
    const liveUrl = `${LIVE}/${page}`;
    const localUrl = `${LOCAL}/${page}`;
    try {
      const [live, local] = await Promise.all([get(liveUrl), get(localUrl)]);
      const liveTitle = titleOf(live.html);
      const localTitle = titleOf(local.html);
      const sameTitle = liveTitle.split('-')[0].trim().toLowerCase() === localTitle.split('-')[0].trim().toLowerCase()
        || liveTitle.toLowerCase().includes('drinks4less') && localTitle.toLowerCase().includes('drinks4less');
      lines.push([
        page || '/',
        `live ${live.status} ${live.finalUrl.replace(LIVE, '')}`,
        `local ${local.status} ${local.finalUrl.replace(LOCAL, '')}`,
        `titles ${sameTitle ? 'match' : 'DIFFER'}`,
        `live="${liveTitle.slice(0, 80)}"`,
        `local="${localTitle.slice(0, 80)}"`
      ].join(' | '));
    } catch (error) {
      lines.push(`${page || '/'} | ERROR ${(error as Error).message}`);
    }
  }

  lines.push('PRODUCTS');
  let match = 0;
  let differ = 0;
  let missing = 0;
  let errors = 0;
  const diffs: string[] = [];
  await mapPool(products, 8, async (product) => {
    const url = `${LIVE}/shop/${product.slug}/`;
    try {
      const live = await get(url);
      if (live.status !== 200 || !titleOf(live.html).toUpperCase().includes(String(product.name).slice(0, 12).toUpperCase())) {
        missing += 1;
        diffs.push(`MISSING ${product.status} ${product.slug} live ${live.status} "${titleOf(live.html).slice(0, 70)}"`);
        return;
      }
      const livePrice = priceOf(live.html);
      const localPrice = Number(product.price);
      const priceOk = livePrice === null || Math.abs(livePrice - localPrice) < 0.02;
      if (!priceOk) {
        differ += 1;
        diffs.push(`PRICE ${product.slug} live ${livePrice} local ${localPrice}`);
      } else {
        match += 1;
      }
    } catch (error) {
      errors += 1;
      diffs.push(`ERROR ${product.slug} ${(error as Error).message}`);
    }
  });
  lines.push(`products ${products.length} price-match ${match} price-differ ${differ} missing ${missing} errors ${errors}`);
  lines.push(...diffs);
  fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
  console.log(lines.slice(0, 20).join('\n'));
  console.log(`wrote ${OUT}`);
  console.log(`products ${products.length} price-match ${match} price-differ ${differ} missing ${missing} errors ${errors}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
