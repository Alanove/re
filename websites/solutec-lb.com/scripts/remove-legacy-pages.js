// Removes demo pages imported from the WordPress theme that do not belong on the Solutec site.
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'data', 'pages.json');
const LEGACY_KEYS = ['sustainability', 'investor-relations'];

const raw = fs.readFileSync(FILE, 'utf8');
const data = JSON.parse(raw);
const removed = LEGACY_KEYS.filter((key) => data.pages && data.pages[key]);
removed.forEach((key) => delete data.pages[key]);

if (removed.length) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
}
console.log(removed.length ? `Removed pages: ${removed.join(', ')}` : 'No legacy pages found.');
