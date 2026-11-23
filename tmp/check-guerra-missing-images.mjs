import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tsvPath = path.join(__dirname, 'guerra-product-images.tsv');
const outPath = path.join(__dirname, 'guerrasports-missing-images.xlsx');
const BASE = 'https://guerrasports.com';
const CONCURRENCY = 12;
const MISSING_STATUSES = new Set([404, 403, 410]);

function parseTsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    if (cols.length < 6) continue;
    const [id, name, slug, status, imageUrl, thumbUrl] = cols;
    rows.push({
      productId: Number(id),
      name: name.trim(),
      slug: slug.trim(),
      status: status.trim(),
      imageUrl: (imageUrl || '').trim(),
      thumbUrl: (thumbUrl || '').trim(),
    });
  }
  return rows;
}

function normalizePath(p) {
  if (!p) return '';
  if (p.startsWith('http://') || p.startsWith('https://')) {
    try {
      const u = new URL(p);
      return u.pathname;
    } catch {
      return p;
    }
  }
  return p.startsWith('/') ? p : `/${p}`;
}

async function checkUrl(pathname) {
  const url = `${BASE}${pathname}`;
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { Range: 'bytes=0-0' } });
    }
    return res.status;
  } catch (err) {
    return `ERR:${err.cause?.code || err.message}`;
  }
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

const rows = parseTsv(fs.readFileSync(tsvPath, 'utf8'));
console.log(`Loaded ${rows.length} product_images rows`);

/** @type {Map<string, { productId: number, name: string, kind: string }[]>} */
const pathOwners = new Map();
for (const row of rows) {
  const full = normalizePath(row.imageUrl);
  const thumb = normalizePath(row.thumbUrl);
  if (full) {
    if (!pathOwners.has(full)) pathOwners.set(full, []);
    pathOwners.get(full).push({ productId: row.productId, name: row.name, kind: 'full' });
  }
  if (thumb) {
    if (!pathOwners.has(thumb)) pathOwners.set(thumb, []);
    pathOwners.get(thumb).push({ productId: row.productId, name: row.name, kind: 'thumb' });
  }
}

const uniquePaths = [...pathOwners.keys()];
console.log(`Checking ${uniquePaths.length} unique paths on ${BASE}...`);

const statusByPath = new Map();
let done = 0;
await mapPool(uniquePaths, CONCURRENCY, async (pathname) => {
  const status = await checkUrl(pathname);
  statusByPath.set(pathname, status);
  done++;
  if (done % 50 === 0 || done === uniquePaths.length) {
    console.log(`  ${done}/${uniquePaths.length}`);
  }
});

const missing = [];
for (const [pathname, owners] of pathOwners) {
  const status = statusByPath.get(pathname);
  const numeric = typeof status === 'number' ? status : null;
  const isMissing = numeric != null ? MISSING_STATUSES.has(numeric) : true;
  if (!isMissing) continue;
  for (const owner of owners) {
    missing.push({
      productName: owner.name,
      file: pathname,
      kind: owner.kind,
      httpStatus: String(status),
      productId: owner.productId,
    });
  }
}

missing.sort((a, b) => {
  const n = a.productName.localeCompare(b.productName, 'en');
  if (n !== 0) return n;
  const k = a.kind.localeCompare(b.kind);
  if (k !== 0) return k;
  return a.file.localeCompare(b.file);
});

const workbook = new ExcelJS.Workbook();
workbook.creator = 'guerra-missing-images';
workbook.created = new Date();
const sheet = workbook.addWorksheet('Missing images');
sheet.columns = [
  { header: 'Product name', key: 'productName', width: 40 },
  { header: 'File', key: 'file', width: 80 },
  { header: 'Kind', key: 'kind', width: 10 },
  { header: 'HTTP status', key: 'httpStatus', width: 12 },
  { header: 'Product id', key: 'productId', width: 12 },
];
sheet.getRow(1).font = { bold: true };
for (const row of missing) {
  sheet.addRow(row);
}

await workbook.xlsx.writeFile(outPath);

const present = uniquePaths.length - new Set(missing.map((m) => m.file)).size;
console.log(`Unique paths: ${uniquePaths.length}`);
console.log(`Missing unique files: ${new Set(missing.map((m) => m.file)).size}`);
console.log(`Missing rows (product×file): ${missing.length}`);
console.log(`Present unique files: ${present}`);
console.log(`Wrote ${outPath}`);
