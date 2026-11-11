/**
 * Add tabindex to Submit Inquiry form fields in pages.json.
 * Order: First Name, Last Name, Email, Phone, Message, Submit.
 */
const fs = require('fs');
const path = require('path');

const pagesPath = path.join(__dirname, '..', 'data', 'pages.json');
const data = JSON.parse(fs.readFileSync(pagesPath, 'utf8'));
const pages = data.pages;

const fieldTabindex = [
  ['fname', '1'],
  ['lname', '2'],
  ['email', '3'],
  ['phone', '4'],
  ['message', '5']
];

function addTabindexToContent(content) {
  if (!content || !content.includes('submit_your_inquiry') || !content.includes('name="fname"')) {
    return { content, changed: false };
  }

  let out = content;
  let changed = false;

  out = out.replace(
    /<span class="wpcf7-form-control-wrap" data-name="([^"]+)" tabindex="\d+">/g,
    '<span class="wpcf7-form-control-wrap" data-name="$1">'
  );

  for (const [name, tab] of fieldTabindex) {
    const re = new RegExp(
      '(<(?:input|textarea)[^>]*name="' + name + '")(?![^>]*tabindex)',
      'g'
    );
    const next = out.replace(re, '$1 tabindex="' + tab + '"');
    if (next !== out) {
      changed = true;
      out = next;
    }
  }

  const submitRe =
    /(class="wpcf7-form-control wpcf7-submit[^"]*" type="submit")(?![^>]*tabindex)/g;
  const withSubmit = out.replace(submitRe, '$1 tabindex="6"');
  if (withSubmit !== out) {
    changed = true;
    out = withSubmit;
  }

  return { content: out, changed };
}

let pageCount = 0;
for (const key of Object.keys(pages)) {
  const page = pages[key];
  if (!page.content) continue;
  const result = addTabindexToContent(page.content);
  if (result.changed) {
    page.content = result.content;
    pageCount++;
    console.log('Updated:', key);
  }
}

if (pageCount === 0) {
  console.log('No pages needed updating (tabindex may already be set).');
} else {
  fs.writeFileSync(pagesPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Done. Updated', pageCount, 'page(s).');
}
