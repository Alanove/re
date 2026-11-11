/**
 * Combines public/js modules into public/js/script.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const JS_DIR = path.join(ROOT, 'public', 'js');
const OUTPUT = path.join(JS_DIR, 'script.js');

const MODULE_ORDER = [
  'cookie-consent.js',
  'header-search.js',
  'home-slider.js',
  'contact-map.js',
  'forms.js',
  'back-to-top.js',
  'timeline-swiper.js'
];

function build() {
  const parts = [
    '/* BlueField public site — built by src/scripts/build-script.js */',
    '(function() { "use strict";'
  ];

  for (const file of MODULE_ORDER) {
    const filePath = path.join(JS_DIR, file);
    if (fs.existsSync(filePath)) {
      parts.push(`\n/* --- ${file} --- */\n`);
      parts.push(fs.readFileSync(filePath, 'utf8'));
    }
  }

  parts.push('})();');

  fs.mkdirSync(JS_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, parts.join('\n'), 'utf8');
  console.log(`Built ${OUTPUT} (${MODULE_ORDER.length} modules)`);
}

const watch = process.argv.includes('--watch');
build();

if (watch) {
  console.log('Watching public/js/*.js ...');
  fs.watch(JS_DIR, { recursive: false }, () => {
    try {
      build();
    } catch (e) {
      console.error(e);
    }
  });
}
