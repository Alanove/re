const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://capitalpro.liteweb.info';
const ROOT = path.resolve(__dirname, '..');
const failed = [];
const saved = [];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function download(urlPath, destRel) {
  return new Promise((resolve) => {
    const dest = path.join(ROOT, destRel);
    const url = urlPath.startsWith('http') ? urlPath : BASE + urlPath;
    ensureDir(dest);
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { 'User-Agent': 'CapitalCMS-Migrator' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(dest, () => {});
          return download(res.headers.location, destRel).then(resolve);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          failed.push(`${res.statusCode} ${url}`);
          return resolve(false);
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          saved.push(destRel);
          resolve(true);
        });
      })
      .on('error', (err) => {
        file.close();
        fs.unlink(dest, () => {});
        failed.push(`${err.message} ${url}`);
        resolve(false);
      });
  });
}

function fetchText(urlPath) {
  return new Promise((resolve) => {
    const url = urlPath.startsWith('http') ? urlPath : BASE + urlPath;
    https
      .get(url, { headers: { 'User-Agent': 'CapitalCMS-Migrator' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchText(res.headers.location).then(resolve);
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(res.statusCode === 200 ? data : ''));
      })
      .on('error', () => resolve(''));
  });
}

const themeFiles = [
  '/images/capital-group-logo.png',
  '/images/capital-group-logo-footer.png',
  '/images/capitalprogroup.png',
  '/images/service-details.jpg',
  '/images/apple-touch-icon.png',
  '/images/apple-touch-icon-76x76.png',
  '/images/apple-touch-icon-120x120.png',
  '/images/apple-touch-icon-152x152.png',
  '/images/apple-touch-icon-256x256.png',
  '/images/about/about-03.jpg',
  '/images/about/about-04.jpg',
  '/images/content/icon-taxes.png',
  '/images/content/icon-bookkeeping.png',
  '/images/content/icon-wealth.png',
  '/images/content/icon-insure.png',
  '/images/content/why-choose1.jpg',
  '/images/content/why-choose2.jpg',
  '/images/content/why-choose3.jpg',
  '/images/content/dots2.png',
  '/images/bg/footer-map.png',
  '/images/bg/bg-03.jpg',
  '/images/bg/bg-06.jpg',
  '/images/bg/testimonials.jpg',
  '/images/slides/wealth-management-1.jpg',
  '/images/slides/income-replacement-2.jpg',
  '/images/slides/bookkeeping-3.jpg',
  '/images/slides/taxes-4.jpg',
  '/images/blog/blog-01.jpg',
  '/images/team/team-01.jpg',
  '/favicon.ico'
];

const cmsImages = [
  { id: 2, file: 'news-amp-events17530411.jpg' },
  { id: 3, file: 'testimonials79602075.jpg' },
  { id: 4, file: 'our-team31335103.jpg' },
  { id: 5, file: 'contact-us8029505.jpg' },
  { id: 6, file: 'wealth-management63870662.jpg' },
  { id: 7, file: 'income-replacement89589570.jpg' },
  { id: 8, file: 'bookkeeping1580012.jpg' },
  { id: 9, file: 'taxes22600620.jpg' },
  { id: 11, file: 'our-goals3678943.png' },
  { id: 17, file: 'here-s-what-people-are-saying-about-insurance759396.jpg' },
  { id: 18, file: 'you-will-never-believe-these-truth-behind-insurance59597371.jpg' },
  { id: 19, file: 'how-to-have-fantastic-insurance-with-minimal-spending43351423.jpg' },
  { id: 20, file: 'jeremy-scob57563198.jpg' },
  { id: 21, file: 'taylah-tolmie25002739.jpg' },
  { id: 22, file: 'harry-lower68812910.jpg' },
  { id: 23, file: 'paige-grandi6812512.jpg' },
  { id: 25, file: 'pierre-antoniades54087867.jpg' }
];

const revFiles = [
  '/plugins/revolution-slider/revolution/css/settings.min.css',
  '/plugins/revolution-slider/revolution/css/layers.min.css',
  '/plugins/revolution-slider/revolution/css/navigation.min.css',
  '/plugins/revolution-slider/revolution/js/jquery.themepunch.tools.min.js',
  '/plugins/revolution-slider/revolution/js/jquery.themepunch.revolution.min.js'
];

function variants(file) {
  const ext = path.extname(file);
  const base = file.slice(0, -ext.length);
  return [file, `${base}-l${ext}`, `${base}-m${ext}`, `${base}-thumb${ext}`];
}

async function tryCmsImage(id, file) {
  const dest = `public/uploads/pages/${file}`;
  const candidates = [];
  for (const name of variants(file)) {
    candidates.push(`/Prv/Images/Pages/Page_${id}/${name}`);
    candidates.push(`/PRV/Images/Pages/Page_${id}/${name}`);
    candidates.push(`/Prv/Pages/Page_${id}/${name}`);
    candidates.push(`/library/pages/Page_${id}/${name}`);
    candidates.push(`/images/pages/Page_${id}/${name}`);
  }
  candidates.push(`/Prv/Images/${file}`);
  candidates.push(`/PRV/Images/${file}`);
  for (const candidate of candidates) {
    const ok = await download(candidate, dest);
    if (ok) return true;
  }
  return false;
}

function extractUrls(html) {
  const urls = new Set();
  const re = /(?:src|href|data-background|data-lazyload)=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (u.startsWith('/images/') || u.startsWith('/Prv/') || u.startsWith('/PRV/') || u.startsWith('/plugins/revolution')) {
      urls.add(u.split('?')[0]);
    }
  }
  const cssRe = /url\(["']?(\/images\/[^"')]+)["']?\)/gi;
  while ((m = cssRe.exec(html))) urls.add(m[1]);
  return [...urls];
}

(async () => {
  for (const file of themeFiles) {
    await download(file, `public${file}`);
  }
  for (const file of revFiles) {
    await download(file, `public${file}`);
  }
  for (const img of cmsImages) {
    await tryCmsImage(img.id, img.file);
  }

  const pages = ['/', '/companies', '/companies/taxes', '/companies/bookkeeping', '/companies/wealth-management', '/companies/income-replacement', '/news-and-events', '/our-team', '/contact-us', '/testimonials'];
  for (const p of pages) {
    const html = await fetchText(p);
    for (const u of extractUrls(html)) {
      const dest = u.startsWith('/Prv/') || u.startsWith('/PRV/')
        ? `public/uploads${u.replace(/^\/(Prv|PRV)/i, '')}`
        : `public${u}`;
      if (!fs.existsSync(path.join(ROOT, dest))) {
        await download(u, dest);
      }
    }
  }

  fs.writeFileSync(
    path.join(ROOT, 'docs-download-log.json'),
    JSON.stringify({ saved, failed, savedCount: saved.length, failedCount: failed.length }, null, 2)
  );
  console.log(`Downloaded ${saved.length} files, ${failed.length} failed`);
  failed.slice(0, 40).forEach((f) => console.log('FAIL', f));
})();
