const fs = require('fs');
const path = require('path');
const { loadDump } = require('./lib/wp-dump');
const { renderElementor } = require('./lib/elementor-html');

const ROOT = path.resolve(__dirname, '..');
const DUMP = path.resolve(ROOT, '..', 'solutech', 'zazoo_solutec', 'zazoo_solutec.sql');
const DATA = path.join(ROOT, 'data');
const PAGES = path.join(DATA, 'pages.json');
const CHROME = path.join(DATA, 'chrome.json');

function backup(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = `${file}.${stamp}.bak`;
  fs.copyFileSync(file, target);
  console.log('Backup', path.relative(ROOT, target));
}

function render(dump, id) {
  const meta = dump.metaByPost.get(id) || {};
  const rendered = renderElementor(meta._elementor_data || '', id);
  if (!rendered.html) throw new Error(`No Elementor data for post ${id}`);
  if (rendered.unknown.length) console.log(`Post ${id} unknown widgets:`, rendered.unknown.join(', '));
  return rendered.html;
}

function main() {
  console.log('Loading dump...');
  const dump = loadDump(DUMP);

  const pages = JSON.parse(fs.readFileSync(PAGES, 'utf8'));
  const chrome = JSON.parse(fs.readFileSync(CHROME, 'utf8'));
  if (!pages.pages || !pages.pages.home) throw new Error('Home page missing from pages.json');

  backup(PAGES);
  backup(CHROME);

  pages.pages.home.content = render(dump, 1470);
  chrome.headerHtml = render(dump, 78);
  chrome.footerHtml = render(dump, 103);

  fs.writeFileSync(PAGES, JSON.stringify(pages, null, 2));
  fs.writeFileSync(CHROME, JSON.stringify(chrome, null, 2));
  console.log('Updated home content, headerHtml, footerHtml');
}

main();
