/**
 * Sync news images, dates, categories from public/html/news-events/index.html
 * Downloads images via Wayback Machine into public/uploads and public/news/{key}/
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const LISTING_HTML = path.join(ROOT, 'public', 'html', 'news-events', 'index.html');
const NEWS_JSON = path.join(ROOT, 'data', 'news.json');
const UPLOADS_DIR = path.join(ROOT, 'public', 'uploads');
const NEWS_PUBLIC = path.join(ROOT, 'public', 'news');

const WAYBACK_PREFIX = 'https://web.archive.org/web/20240923120407im_/https://bluefieldco.com/';

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const get = (u, redirects = 0) => {
      if (redirects > 8) return reject(new Error('Too many redirects'));
      const lib = u.startsWith('https') ? https : http;
      lib.get(u, { headers: { 'User-Agent': 'BlueField-CMS-Migration/1.0' } }, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return get(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          file.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(destPath)));
      }).on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };
    get(url);
  });
}

function parseListing(html) {
  const items = [];
  const cardRe = /<div class="single_item ([^"]+)">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*(?=\s*<div class="single_item|<\/div>\s*<\/div>\s*<\/section>)/gi;
  let m;
  const simplerRe = /<div class="single_item ([^"]+)">([\s\S]*?)<\/div>\s*\n\s*<\/div>\s*\n\s*<\/div>/gi;
  while ((m = simplerRe.exec(html)) !== null) {
    const category = m[1].trim();
    const block = m[2];
    const linkMatch = block.match(/href="\.\.\/news\/([^/]+)\/index\.html"/);
    const imgMatch = block.match(/src="\.\.\/wp-content\/uploads\/([^"]+)"/);
    const dateMatch = block.match(/<div class="date">\s*([^<]+?)\s*<\/div>/);
    if (!linkMatch || !imgMatch) continue;
    items.push({
      key: linkMatch[1],
      category,
      uploadPath: imgMatch[1],
      displayDate: dateMatch ? dateMatch[1].trim() : '',
      sort: items.length + 1
    });
  }
  return items;
}

async function main() {
  if (!fs.existsSync(LISTING_HTML)) {
    console.error('Missing', LISTING_HTML);
    process.exit(1);
  }
  const html = fs.readFileSync(LISTING_HTML, 'utf8');
  const listing = parseListing(html);
  console.log(`Parsed ${listing.length} news cards from static HTML`);

  const newsData = JSON.parse(fs.readFileSync(NEWS_JSON, 'utf8'));
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  for (const item of listing) {
    const localRel = `/uploads/${item.uploadPath}`;
    const localFull = path.join(ROOT, 'public', localRel.replace(/^\//, '').replace(/\//g, path.sep));
    fs.mkdirSync(path.dirname(localFull), { recursive: true });

    const newsDir = path.join(NEWS_PUBLIC, item.key);
    fs.mkdirSync(newsDir, { recursive: true });
    const newsImageName = path.basename(item.uploadPath);
    const newsImageFull = path.join(newsDir, newsImageName);

    if (!fs.existsSync(localFull)) {
      const waybackUrl = WAYBACK_PREFIX + 'wp-content/uploads/' + item.uploadPath;
      try {
        await download(waybackUrl, localFull);
        console.log('Downloaded', localRel);
      } catch (e) {
        console.warn('Failed', item.key, e.message);
      }
    } else {
      console.log('Exists', localRel);
    }

    if (fs.existsSync(localFull) && !fs.existsSync(newsImageFull)) {
      fs.copyFileSync(localFull, newsImageFull);
    }

    const entry = newsData.news[item.key];
    if (entry) {
      entry.pageImage = fs.existsSync(localFull) ? localRel : entry.pageImage || '';
      entry.category = item.category;
      entry.displayDate = item.displayDate;
      entry.listingSort = item.sort;
      if (entry.seo) entry.seo.pageImage = entry.pageImage;
      entry.lastUpdated = parseDisplayDate(item.displayDate) || entry.lastUpdated;
    } else {
      console.warn('No news.json entry for', item.key);
    }
  }

  fs.writeFileSync(NEWS_JSON, JSON.stringify(newsData, null, 2));
  console.log('Updated', NEWS_JSON);
}

function parseDisplayDate(ddmmyyyy) {
  const parts = ddmmyyyy.split('/');
  if (parts.length !== 3) return null;
  const [d, mo, y] = parts;
  return new Date(`${y}-${mo}-${d}`).toISOString();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
