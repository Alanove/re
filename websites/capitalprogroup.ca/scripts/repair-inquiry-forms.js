/**
 * Repair Submit Inquiry sections in pages.json:
 * - Replace corrupted / empty forms with the canonical markup from home
 * - Remove tabindex from wrapper spans (inputs keep tabindex for column layout)
 */
const fs = require('fs');
const path = require('path');

const pagesPath = path.join(__dirname, '..', 'data', 'pages.json');
const data = JSON.parse(fs.readFileSync(pagesPath, 'utf8'));
const pages = data.pages;

function findInquirySectionBounds(content) {
  const idIdx = content.indexOf('id="submit_your_inquiry"');
  if (idIdx === -1) {
    return null;
  }
  const start = content.lastIndexOf('<section', idIdx);
  if (start === -1 || idIdx - start > 250) {
    return null;
  }
  const end = content.indexOf('</section>', idIdx);
  if (end === -1) {
    return null;
  }
  return { start, end: end + '</section>'.length };
}

function extractInquirySection(content) {
  const bounds = findInquirySectionBounds(content);
  if (!bounds) {
    return null;
  }
  return content.substring(bounds.start, bounds.end);
}

const homeContent = pages.home && pages.home.content;
const canonicalSection = homeContent ? extractInquirySection(homeContent) : null;

if (!canonicalSection) {
  console.error('Could not extract inquiry section from home page.');
  process.exit(1);
}

function isCorruptedOrEmpty(content) {
  if (!content.includes('submit_your_inquiry')) {
    return false;
  }
  return (
    !content.includes('name="fname"') ||
    content.includes('="disabled"') ||
    content.includes('<p class="<form') ||
    content.includes('<p class=\\"<form')
  );
}

function removeSpanTabindex(content) {
  return content.replace(
    /<span class="wpcf7-form-control-wrap" data-name="([^"]+)" tabindex="\d+">/g,
    '<span class="wpcf7-form-control-wrap" data-name="$1">'
  );
}

function replaceInquirySection(content, replacement) {
  const bounds = findInquirySectionBounds(content);
  if (!bounds) {
    return { content, changed: false };
  }
  const before = content.substring(0, bounds.start);
  const after = content.substring(bounds.end);
  return { content: before + replacement + after, changed: true };
}

let fixed = 0;
let tabindexCleaned = 0;

for (const key of Object.keys(pages)) {
  const page = pages[key];
  if (!page.content || !page.content.includes('submit_your_inquiry')) {
    continue;
  }

  let content = page.content;
  let changed = false;

  if (isCorruptedOrEmpty(content)) {
    const result = replaceInquirySection(content, canonicalSection);
    if (result.changed) {
      content = result.content;
      changed = true;
      console.log('Replaced inquiry section:', key);
    }
  }

  const withoutSpanTab = removeSpanTabindex(content);
  if (withoutSpanTab !== content) {
    content = withoutSpanTab;
    changed = true;
    tabindexCleaned++;
  }

  if (changed) {
    page.content = content;
    fixed++;
  }
}

if (fixed === 0) {
  console.log('No inquiry pages needed repair.');
} else {
  fs.writeFileSync(pagesPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Done. Updated', fixed, 'page(s); span tabindex cleaned on', tabindexCleaned, 'page(s).');
}
