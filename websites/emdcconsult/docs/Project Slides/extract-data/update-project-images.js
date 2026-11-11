/**
 * Comprehensive script to update all project images
 * Run with: node update-project-images.js
 * 
 * Note: Script is in docs/Project Slides/extract-data/, paths are relative to project root
 */

const fs = require('fs');
const path = require('path');

// Script is in docs/Project Slides/extract-data/, so go up 3 levels to project root
const BASE_DIR = path.resolve(__dirname, '..', '..', '..');
const PROJECT_PHOTOS_DIR = path.join(BASE_DIR, 'docs', 'CONSULT EMDC Projects Photos');
const PROJECTS_JSON = path.join(BASE_DIR, 'data', 'projects.json');
const PUBLIC_PROJECTS_DIR = path.join(BASE_DIR, 'public', 'projects');
const OUTPUT_FILE = path.join(__dirname, 'project-update-results.txt');

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(OUTPUT_FILE, logMessage + '\n', 'utf8');
}

function normalizeName(name) {
    return name.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function getProjectPhotosByCategory() {
    const photosByCategory = {};
    if (!fs.existsSync(PROJECT_PHOTOS_DIR)) {
        log(`ERROR: Project photos directory not found: ${PROJECT_PHOTOS_DIR}`);
        return photosByCategory;
    }
    
    const categoryFolders = fs.readdirSync(PROJECT_PHOTOS_DIR, { withFileTypes: true });
    for (const categoryFolder of categoryFolders) {
        if (categoryFolder.isDirectory()) {
            const categoryName = categoryFolder.name;
            const categoryPath = path.join(PROJECT_PHOTOS_DIR, categoryName);
            const photos = [];
            
            try {
                const files = fs.readdirSync(categoryPath);
                for (const file of files) {
                    const filePath = path.join(categoryPath, file);
                    const stat = fs.statSync(filePath);
                    if (stat.isFile()) {
                        const ext = path.extname(file).toLowerCase();
                        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
                            photos.push({ filename: file, path: filePath, category: categoryName });
                        }
                    }
                }
            } catch (err) {
                log(`ERROR reading ${categoryName}: ${err.message}`);
            }
            
            photosByCategory[categoryName] = photos;
            log(`Found ${photos.length} photos in ${categoryName}`);
        }
    }
    return photosByCategory;
}

function findMatchingPhoto(projectTitle, category, photosByCategory) {
    if (!photosByCategory[category]) return null;
    
    const normalizedTitle = normalizeName(projectTitle);
    for (const photo of photosByCategory[category]) {
        const photoName = normalizeName(path.parse(photo.filename).name);
        if (normalizedTitle === photoName) return photo;
        if (normalizedTitle.includes(photoName) || photoName.includes(normalizedTitle)) return photo;
        
        const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 2);
        const photoWords = photoName.split(/\s+/).filter(w => w.length > 2);
        const commonWords = titleWords.filter(w => photoWords.includes(w));
        if (commonWords.length >= Math.min(2, Math.max(1, titleWords.length / 2))) return photo;
    }
    return null;
}

function copyProjectImage(sourcePath, destFolder, imageName) {
    try {
        if (!fs.existsSync(destFolder)) {
            fs.mkdirSync(destFolder, { recursive: true });
        }
        const destPath = path.join(destFolder, imageName);
        if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, destPath);
            return true;
        }
        return false;
    } catch (err) {
        log(`ERROR copying: ${err.message}`);
        return false;
    }
}

// Clear output file
if (fs.existsSync(OUTPUT_FILE)) fs.unlinkSync(OUTPUT_FILE);

log('=== Starting Project Image Update ===');
log(`Base directory: ${BASE_DIR}`);

if (!fs.existsSync(PROJECTS_JSON)) {
    log('ERROR: projects.json not found!');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf8'));
const projects = data.projects || [];
log(`Loaded ${projects.length} projects`);

const photosByCategory = getProjectPhotosByCategory();
const updates = [];
const missingImages = [];
const unclearData = [];
let imagesCopied = 0;
let projectsUpdated = 0;

for (const project of projects) {
    const projectTitle = project.title || '';
    const projectCategories = project.categories || [];
    let folderName = project.folder_name || '';
    const currentImage = project.project_image || '';
    
    let photoFound = false;
    for (const category of projectCategories) {
        if (photosByCategory[category]) {
            const matchingPhoto = findMatchingPhoto(projectTitle, category, photosByCategory);
            if (matchingPhoto) {
                photoFound = true;
                const sourcePath = matchingPhoto.path;
                
                if (!folderName) {
                    folderName = projectTitle.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
                    project.folder_name = folderName;
                }
                
                const imageName = matchingPhoto.filename;
                if (currentImage !== imageName) {
                    project.project_image = imageName;
                    updates.push(`${projectTitle}: ${currentImage || 'none'} -> ${imageName}`);
                    projectsUpdated++;
                }
                
                const destFolder = path.join(PUBLIC_PROJECTS_DIR, folderName);
                if (copyProjectImage(sourcePath, destFolder, imageName)) {
                    imagesCopied++;
                    log(`✓ ${projectTitle}: Copied ${imageName}`);
                } else {
                    missingImages.push({ project: projectTitle, source: sourcePath });
                }
                break;
            }
        }
    }
    
    if (!photoFound) {
        if (!folderName) {
            unclearData.push({ project: projectTitle, categories: projectCategories.join(', ') });
        }
    }
    
    if (!project.url) {
        project.url = folderName || projectTitle.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').trim();
    }
}

fs.writeFileSync(PROJECTS_JSON, JSON.stringify(data, null, 2), 'utf8');
log(`✓ Saved updated projects.json`);

log('\n=== Summary ===');
log(`Projects updated: ${projectsUpdated}`);
log(`Images copied: ${imagesCopied}`);
log(`Missing images: ${missingImages.length}`);
log(`Unclear data: ${unclearData.length}`);

if (updates.length > 0) {
    log('\n=== Updates ===');
    updates.forEach(u => log(u));
}

if (missingImages.length > 0) {
    log('\n=== Missing Images ===');
    missingImages.forEach(m => log(`${m.project}: ${m.source}`));
}

if (unclearData.length > 0) {
    log('\n=== Unclear Data ===');
    unclearData.forEach(u => log(`${u.project}: ${u.categories}`));
}

log(`\nResults saved to: ${OUTPUT_FILE}`);






