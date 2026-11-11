const fs = require('fs');
const path = require('path');

const pagesPath = path.join(__dirname, '../data/pages.json');
const data = JSON.parse(fs.readFileSync(pagesPath, 'utf8'));
let fixed = 0;

const faviconRe = /<img[^>]*src="\/uploads\/2024\/02\/BLUEFIELD-Favicon\.png"[^>]*>/gi;
const replacement =
  '<img src="/themes/bluefieldco/images/BLUEFIELD-Favicon.png" width="48" height="48" class="contact-hq-icon" alt="BlueField Group"/>';

for (const page of Object.values(data.pages)) {
  if (!page.content) continue;
  const next = page.content.replace(faviconRe, replacement);
  if (next !== page.content) {
    page.content = next;
    fixed++;
  }
}

fs.writeFileSync(pagesPath, JSON.stringify(data, null, 2));
console.log(`Fixed HQ icon in ${fixed} page(s)`);
