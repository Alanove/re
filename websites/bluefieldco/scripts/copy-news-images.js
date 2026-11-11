const fs = require('fs');
const path = require('path');

// Read news data
const newsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/news.json'), 'utf8'));

// Mapping of news articles to project images
// Format: newsKey -> { sourcePath, targetPath }
const imageMappings = {
  'emdc-launches-new-bim-innovation-lab': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Commercial/Crystal Tower.jpg',
    targetPath: 'public/news/emdc-launches-new-bim-innovation-lab/emdc-launches-new-bim-innovation-lab-default.jpg'
  },
  'major-project-completion-dubai-tower': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Commercial/Crystal Tower.jpg',
    targetPath: 'public/images/news/dubai-tower.jpg'
  },
  'sustainability-award-2024': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Civic & Religious/King Abdullah International Gardens.jpg',
    targetPath: 'public/images/news/sustainability-award.jpg'
  },
  'new-office-opening-riyadh': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Airports & Stations/Riyadh Metro Stations, Line 5 & 6.jpg',
    targetPath: 'public/images/news/riyadh-office.jpg'
  },
  'partnership-smart-building-tech': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Commercial/Crystal Tower.jpg',
    targetPath: 'public/images/news/smart-building.jpg'
  },
  'energy-efficiency-milestone': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Civic & Religious/King Abdullah International Gardens.jpg',
    targetPath: 'public/images/news/energy-efficiency.jpg'
  },
  'ict-infrastructure-modernization': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Power Plants & Data Centers/Africa Data Centers.jpg',
    targetPath: 'public/images/news/ict-infrastructure.jpg'
  },
  'training-program-launch': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Education & Leisure/Princess Noura University.jpg',
    targetPath: 'public/images/news/training-program.jpg'
  },
  'renewable-energy-integration': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Civic & Religious/King Abdullah International Gardens.jpg',
    targetPath: 'public/images/news/solar-energy.jpg'
  },
  'fire-safety-innovation': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Commercial/Kingsway Tower.jpg',
    targetPath: 'public/images/news/fire-safety.jpg'
  },
  'water-conservation-initiative': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Civic & Religious/King Abdullah International Gardens.jpg',
    targetPath: 'public/images/news/water-conservation.jpg'
  },
  'hospital-mep-project': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Healthcare/PNU Medical Hospital.jpg',
    targetPath: 'public/images/news/hospital-mep.jpg'
  },
  'industry-conference-participation': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Civic & Religious/UYO Convention Center.jpg',
    targetPath: 'public/images/news/conference.jpg'
  },
  'data-center-cooling-solution': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Power Plants & Data Centers/Africa Data Centers.jpg',
    targetPath: 'public/images/news/data-center.jpg'
  },
  'retrofit-project-success': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Commercial/Kingsway Tower.jpg',
    targetPath: 'public/images/news/retrofit.jpg'
  },
  'quality-certification-renewal': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Commercial/Crystal Tower.jpg',
    targetPath: 'public/images/news/iso-certification.jpg'
  },
  'smart-grid-integration': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Commercial/Crystal Tower.jpg',
    targetPath: 'public/images/news/smart-grid.jpg'
  },
  'team-expansion-announcement': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Commercial/Crystal Tower.jpg',
    targetPath: 'public/images/news/team-expansion.jpg'
  },
  'client-satisfaction-survey': {
    sourcePath: 'docs/CONSULT EMDC Projects Photos/Commercial/Crystal Tower.jpg',
    targetPath: 'public/images/news/client-satisfaction.jpg'
  }
};

const projectRoot = path.join(__dirname, '..');

function copyImage(sourceRelative, targetRelative) {
  const sourcePath = path.join(projectRoot, sourceRelative);
  const targetPath = path.join(projectRoot, targetRelative);
  const targetDir = path.dirname(targetPath);

  // Check if source exists
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source file not found: ${sourcePath}`);
    return false;
  }

  // Create target directory if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`Created directory: ${targetDir}`);
  }

  // Copy the file
  try {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`✓ Copied: ${sourceRelative} -> ${targetRelative}`);
    return true;
  } catch (error) {
    console.error(`Error copying ${sourceRelative} to ${targetRelative}:`, error.message);
    return false;
  }
}

// Process all news articles
console.log('Starting to copy images for news articles...\n');

let successCount = 0;
let failCount = 0;

for (const [newsKey, mapping] of Object.entries(imageMappings)) {
  if (copyImage(mapping.sourcePath, mapping.targetPath)) {
    successCount++;
  } else {
    failCount++;
  }
}

console.log(`\nCompleted! Success: ${successCount}, Failed: ${failCount}`);

