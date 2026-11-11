// Replaces the imported contact form and map iframe with [contact-form] / [map]
// shortcodes so the CMS editor can open these pages in visual mode.
const fs = require('fs');
const path = require('path');

const DATA = path.resolve(__dirname, '..', 'data');
const FORM_PATTERN = /<div class="wpcf7[^"]*"[^>]*><form[\s\S]*?<\/form><\/div>/g;
const MAP_PATTERN = /<iframe[^>]*google\.com\/maps[^>]*><\/iframe>/g;

function convert(html) {
  return String(html || '')
    .replace(FORM_PATTERN, '<p>[contact-form]</p>')
    .replace(MAP_PATTERN, '<p>[map]</p>');
}

function updateJson(file, mutate) {
  const full = path.join(DATA, file);
  const raw = fs.readFileSync(full, 'utf8');
  const data = JSON.parse(raw);
  mutate(data);
  fs.writeFileSync(full, JSON.stringify(data, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
}

updateJson('pages.json', (data) => {
  Object.values(data.pages).forEach((page) => {
    page.content = convert(page.content);
  });
});

updateJson('home-sections.json', (data) => {
  data.sections.forEach((section) => {
    section.html = convert(section.html);
  });
});

console.log('Contact form and map placeholders applied.');
