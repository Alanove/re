const fs = require('fs');
const { SCRIPTS_PATHS } = require('./constants/paths');

const projectsPath = SCRIPTS_PATHS.PROJECTS_FILE;
const data = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));

function toUrl(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

data.projects.forEach(project => {
  if (!project.url) {
    project.url = toUrl(project.title);
  }
});

fs.writeFileSync(projectsPath, JSON.stringify(data, null, 2));
console.log('Added url field to all projects (if missing).'); 