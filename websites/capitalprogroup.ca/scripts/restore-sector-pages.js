/**
 * Restores all sector pages updated in this project (agriculture, pest, landscaping, cleaning).
 * Run: node scripts/restore-sector-pages.js
 */
const { execSync } = require('child_process');
const path = require('path');

const scripts = [
  'update-agriculture-page.js',
  'update-pest-management-page.js',
  'update-landscaping-page.js',
  'update-cleaning-services-page.js'
];

const root = path.join(__dirname, '..');

for (const script of scripts) {
  execSync(`node "${path.join(__dirname, script)}"`, { cwd: root, stdio: 'inherit' });
}

console.log('All sector pages restored in data/pages.json');
