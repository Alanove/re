const fs = require('fs');
const { SCRIPTS_PATHS } = require('./constants/paths');

const projectsPath = SCRIPTS_PATHS.PROJECTS_FILE;
const data = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));

// User-specified country mapping
const countryMap = {
  'KSA': 'KSA',
  'Al Khobar - KSA': 'KSA',
  'Lebanon': 'Lebanon',
  'Beirut': 'Lebanon',
  'Beyrouth': 'Lebanon',
  'Verdun': 'Lebanon',
  'Dhour El Choueir': 'Lebanon',
  'Czech Republic': 'Czech Republic',
  'Italy': 'Italy',
  'Japan': 'Japan',
  'Kuwait': 'Kuwait'
};

const countryAnalytics = {};

data.projects.forEach(project => {
  if (project.works && project.works.length > 0) {
    project.works.forEach(work => {
      if (work.details && work.details.location) {
        const loc = work.details.location.trim();
        const countryKey = loc.includes(',') ? loc.split(',').pop().trim() : loc;
        const mapped = countryMap[countryKey];
        if (mapped) {
          if (!countryAnalytics[mapped]) countryAnalytics[mapped] = new Set();
          countryAnalytics[mapped].add(loc);
        }
      }
    });
  }
});

const result = Object.entries(countryAnalytics).map(([name, realArr]) => ({
  name,
  real: Array.from(realArr),
  url: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}));

console.log(JSON.stringify(result, null, 2)); 