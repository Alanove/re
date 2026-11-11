#!/usr/bin/env node
/**
 * One-time migration: split pages.home.content (Elementor HTML) into
 * data/home-sections.json and move the hardcoded product-category card
 * images into data/product-categories.json.
 *
 * Usage: node scripts/split-home-sections.js [--force]
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PAGES_FILE = path.join(DATA_DIR, 'pages.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'product-categories.json');
const HOME_SECTIONS_FILE = path.join(DATA_DIR, 'home-sections.json');
const CATEGORIES_PLACEHOLDER = '<!--SOLU_CATEGORIES-->';

// Groups of original top-level Elementor sections (1-based, in page order).
const SECTION_MAP = [
  { key: 'hero', label: 'Hero', from: [1] },
  { key: 'industries', label: 'Industries We Serve', from: [2, 3] },
  { key: 'products-intro', label: 'Our Products (intro)', from: [4] },
  { key: 'product-categories', label: 'Product Categories', from: [5, 6, 7, 8], type: 'categories' },
  { key: 'decor-image', label: 'Decorative Image', from: [9] },
  { key: 'how-we-work', label: 'How We Work', from: [10, 11] },
  { key: 'distributors-cta', label: 'Distributors Call to Action', from: [12] },
  { key: 'support', label: 'Support', from: [13] },
  { key: 'gallery', label: 'Gallery', from: [14] },
  { key: 'call-us', label: 'Call Us (contact form)', from: [15], sourceOnly: true },
  { key: 'news', label: 'News', from: [16] }
];

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function backup(file) {
  if (!fs.existsSync(file)) return;
  const target = `${file}.${stamp()}.bak`;
  fs.copyFileSync(file, target);
  console.log(`Backed up ${path.basename(file)} -> ${path.basename(target)}`);
}

function splitTopLevelSections(html) {
  const re = /<\/?section\b[^>]*>/gi;
  const ranges = [];
  let depth = 0;
  let start = -1;
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] !== '/') {
      if (depth === 0) start = m.index;
      depth++;
    } else {
      depth--;
      if (depth === 0) ranges.push([start, re.lastIndex]);
    }
  }
  if (depth !== 0) throw new Error('Unbalanced <section> tags in home content');
  return ranges;
}

function main() {
  const force = process.argv.includes('--force');
  if (fs.existsSync(HOME_SECTIONS_FILE) && !force) {
    console.error('data/home-sections.json already exists. Re-run with --force to overwrite.');
    process.exit(1);
  }

  const pagesData = JSON.parse(fs.readFileSync(PAGES_FILE, 'utf8'));
  const home = (pagesData.pages || {}).home;
  if (!home || !home.content) throw new Error('pages.home.content not found');
  const html = home.content;

  const ranges = splitTopLevelSections(html);
  if (ranges.length !== 16) {
    throw new Error(`Expected 16 top-level sections, found ${ranges.length}. Check the home content before migrating.`);
  }
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i][0] !== ranges[i - 1][1]) {
      throw new Error(`Unexpected content between sections ${i} and ${i + 1}`);
    }
  }

  const wrapperStart = html.slice(0, ranges[0][0]);
  const wrapperEnd = html.slice(ranges[ranges.length - 1][1]);
  const slice = (n) => html.slice(ranges[n - 1][0], ranges[n - 1][1]);

  const sections = SECTION_MAP.map((def) => {
    const section = {
      key: def.key,
      label: def.label,
      type: def.type || 'html',
      html: def.type === 'categories' ? CATEGORIES_PLACEHOLDER : def.from.map(slice).join(''),
      enabled: true
    };
    if (def.sourceOnly) section.sourceOnly = true;
    return section;
  });

  // Extract category cards (href + data-image) in display order.
  const categoriesDef = SECTION_MAP.find((d) => d.type === 'categories');
  const cardsHtml = categoriesDef.from.map(slice).join('');
  const cardRe = /<a href="\/product-category\/([^"]+)"[^>]*data-image="([^"]*)"/g;
  const cards = [];
  let cm;
  while ((cm = cardRe.exec(cardsHtml))) cards.push({ slug: cm[1], image: cm[2] });
  console.log(`Found ${cards.length} category cards on the home page`);

  const categoriesData = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));
  const categories = categoriesData.categories || [];
  const cardSlugs = new Set(cards.map((c) => c.slug));
  cards.forEach((card, index) => {
    const category = categories.find((c) => c.slug === card.slug);
    if (!category) {
      console.warn(`  ! No category with slug "${card.slug}" in product-categories.json`);
      return;
    }
    if (!category.image) category.image = card.image;
    category.sort = index + 1;
    category.showOnHome = true;
  });
  let nextSort = cards.length + 1;
  categories.forEach((c) => {
    if (!cardSlugs.has(c.slug)) {
      c.showOnHome = false;
      c.sort = nextSort++;
    }
  });

  backup(PAGES_FILE);
  backup(CATEGORIES_FILE);
  backup(HOME_SECTIONS_FILE);

  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categoriesData, null, 2) + '\n', 'utf8');
  fs.writeFileSync(
    HOME_SECTIONS_FILE,
    JSON.stringify({ wrapperStart, wrapperEnd, sections }, null, 2) + '\n',
    'utf8'
  );

  console.log(`Wrote ${sections.length} sections to data/home-sections.json`);
  console.log('Updated data/product-categories.json (image, sort, showOnHome)');
}

main();
