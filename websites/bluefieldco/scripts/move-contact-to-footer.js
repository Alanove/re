/**
 * One-time utility: extract contact+map block from page content into footer partial source,
 * then strip it from all pages in data/pages.json.
 */
const fs = require('fs');
const path = require('path');

const pagesPath = path.join(__dirname, '../data/pages.json');
const snippetPath = path.join(__dirname, '../views/partials/footer-contact-snippet.html');
const data = JSON.parse(fs.readFileSync(pagesPath, 'utf8'));

function stripContact(content) {
  let c = content;
  c = c.replace(/\r?\n\r?\n\t<!--fifth section contains contact us information-->\r?\n\r?\n\r?\n/g, '\r\n');
  c = c.replace(
    /<section class="contact-us section desktop-view" id="contact-us">[\s\S]*?<\/section>\r?\n/g,
    ''
  );
  c = c.replace(
    /<section class="a-values section mobile-view contact">[\s\S]*?<\/section><!--\.a-values-->\r?\n/g,
    ''
  );
  c = c.replace(
    /<script data-cfasync="false"[^>]*><\/script><script>[\s\S]*?\/\/UAE[\s\S]*?\}\);\r?\n\r?\n<\/script>\r?\n/g,
    ''
  );
  return c;
}

function extractContact(content) {
  const m = content.match(
    /<section class="contact-us section desktop-view" id="contact-us">[\s\S]*?<section class="a-values section mobile-view contact">[\s\S]*?<\/section><!--\.a-values-->/
  );
  return m ? m[0] : null;
}

let extracted = null;
const affected = [];

for (const [key, page] of Object.entries(data.pages)) {
  if (!page.content || !page.content.includes('id="contact-us"')) continue;
  if (!extracted) extracted = extractContact(page.content);
  const before = page.content.length;
  page.content = stripContact(page.content);
  if (page.content.length !== before) affected.push(key);
}

if (!extracted) {
  console.error('No contact block found');
  process.exit(1);
}

fs.writeFileSync(snippetPath, extracted);
fs.writeFileSync(pagesPath, JSON.stringify(data, null, 2));
console.log('Extracted', extracted.length, 'chars to', snippetPath);
console.log('Stripped from', affected.length, 'pages:', affected.join(', '));
