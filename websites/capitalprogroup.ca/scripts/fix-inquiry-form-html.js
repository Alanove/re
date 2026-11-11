/**
 * Fix corrupted Submit Inquiry form markup in pages.json.
 * Migration left `<p class="<form ...` instead of `<form ...`.
 */
const fs = require('fs');
const path = require('path');

const pagesPath = path.join(__dirname, '..', 'data', 'pages.json');
const data = JSON.parse(fs.readFileSync(pagesPath, 'utf8'));
const pages = data.pages;

let pageCount = 0;

for (const key of Object.keys(pages)) {
  const page = pages[key];
  if (!page.content || !page.content.includes('submit_your_inquiry')) {
    continue;
  }

  let content = page.content;
  const before = content;

  // Corrupted opening tag from WordPress migration
  content = content.replace(/<p class="<form/g, '<form');

  // Normalize form action/method (JS intercepts submit; avoid broken relative URLs)
  content = content.replace(
    /<form action="[^"]*"([^>]*?)method="(?:get|post)"([^>]*?)class="wpcf7-form/g,
    '<form action="#"$1method="post"$2class="wpcf7-form'
  );

  if (content !== before) {
    page.content = content;
    pageCount++;
    console.log('Fixed:', key);
  }
}

if (pageCount === 0) {
  console.log('No corrupted inquiry forms found.');
} else {
  fs.writeFileSync(pagesPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Done. Fixed', pageCount, 'page(s).');
}
