/**
 * Script to analyze project slides and update projects.json
 * This script:
 * 1. Analyzes project slides to extract project information
 * 2. Matches projects with photos from CONSULT EMDC Projects Photos folder
 * 3. Updates projects.json accordingly
 * 4. Copies images to public/projects/{folder_name}/{project_image}
 * 5. Creates a report of unclear data and missing images
 * 
 * Note: Script is in docs/Project Slides/extract-data/, paths are relative to project root
 */

const fs = require('fs');
const path = require('path');

// Paths
// Script is in docs/Project Slides/extract-data/, so go up 3 levels to project root
const BASE_DIR = path.resolve(__dirname, '..', '..', '..');
const PROJECT_SLIDES_DIR = path.join(BASE_DIR, 'docs', 'Project Slides');
const PROJECT_PHOTOS_DIR = path.join(BASE_DIR, 'docs', 'CONSULT EMDC Projects Photos');
const PROJECTS_JSON = path.join(BASE_DIR, 'data', 'projects.json');
const PUBLIC_PROJECTS_DIR = path.join(BASE_DIR, 'public', 'projects');
const REPORT_FILE = path.join(BASE_DIR, 'docs', 'Project Slides', 'analysis_report.md');
const LOG_FILE = path.join(__dirname, 'analysis_log.txt');

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n', 'utf8');
}

function normalizeName(name) {
    return name
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function createSlug(name) {
    return name
        .replace(/[^\w\s-]/g, '')
        .replace(/[-\s]+/g, '-')
        .toLowerCase()
        .replace(/^-+|-+$/g, '');
}

function getProjectPhotosByCategory() {
    const photosByCategory = {};
    
    if (!fs.existsSync(PROJECT_PHOTOS_DIR)) {
        log(`WARNING: Project photos directory not found: ${PROJECT_PHOTOS_DIR}`);
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
                            photos.push({
                                filename: file,
                                path: filePath,
                                category: categoryName
                            });
                        }
                    }
                }
            } catch (err) {
                log(`ERROR reading category folder ${categoryName}: ${err.message}`);
            }
            
            photosByCategory[categoryName] = photos;
            log(`Found ${photos.length} photos in category: ${categoryName}`);
        }
    }
    
    return photosByCategory;
}

function findMatchingPhoto(projectTitle, category, photosByCategory) {
    if (!photosByCategory[category]) {
        return null;
    }
    
    const normalizedTitle = normalizeName(projectTitle);
    
    for (const photo of photosByCategory[category]) {
        const photoName = normalizeName(path.parse(photo.filename).name);
        
        // Try exact match
        if (normalizedTitle === photoName) {
            return photo;
        }
        
        // Try partial match
        if (normalizedTitle.includes(photoName) || photoName.includes(normalizedTitle)) {
            return photo;
        }
        
        // Try matching with common variations
        const titleWords = normalizedTitle.split(/\s+/);
        const photoWords = photoName.split(/\s+/);
        const commonWords = titleWords.filter(w => photoWords.includes(w));
        if (commonWords.length >= Math.min(2, titleWords.length / 2)) {
            return photo;
        }
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
        log(`ERROR copying ${sourcePath} to ${destFolder}: ${err.message}`);
        return false;
    }
}

function analyzeAndUpdateProjects() {
    // Clear previous log
    if (fs.existsSync(LOG_FILE)) {
        fs.unlinkSync(LOG_FILE);
    }
    
    log('Starting project slides analysis...');
    log(`Base directory: ${BASE_DIR}`);
    log(`Projects JSON exists: ${fs.existsSync(PROJECTS_JSON)}`);
    log(`Project photos dir exists: ${fs.existsSync(PROJECT_PHOTOS_DIR)}`);
    log(`Public projects dir exists: ${fs.existsSync(PUBLIC_PROJECTS_DIR)}`);
    
    if (!fs.existsSync(PROJECTS_JSON)) {
        log('ERROR: projects.json not found!');
        process.exit(1);
    }
    
    // Load existing projects
    const data = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf8'));
    const projects = data.projects || [];
    const categories = data.categories || [];
    
    log(`Loaded ${projects.length} projects from projects.json`);
    
    // Get project photos by category
    const photosByCategory = getProjectPhotosByCategory();
    
    // Track updates and issues
    const updates = [];
    const missingImages = [];
    const unclearData = [];
    let projectsUpdated = 0;
    let imagesCopied = 0;
    
    // Process each project
    for (const project of projects) {
        const projectTitle = project.title || '';
        const projectCategories = project.categories || [];
        let folderName = project.folder_name || '';
        const currentImage = project.project_image || '';
        
        // Find matching photo for each category
        let photoFound = false;
        for (const category of projectCategories) {
            if (photosByCategory[category]) {
                const matchingPhoto = findMatchingPhoto(projectTitle, category, photosByCategory);
                
                if (matchingPhoto) {
                    photoFound = true;
                    const sourcePath = matchingPhoto.path;
                    
                    // Determine folder name
                    if (!folderName) {
                        folderName = createSlug(projectTitle);
                        project.folder_name = folderName;
                    }
                    
                    // Use original filename
                    const imageName = matchingPhoto.filename;
                    
                    // Update project_image if different
                    if (currentImage !== imageName) {
                        const oldImage = currentImage;
                        project.project_image = imageName;
                        updates.push(`Updated image for '${projectTitle}': ${oldImage || 'none'} -> ${imageName}`);
                        projectsUpdated++;
                    }
                    
                    // Copy image to public/projects folder
                    const destFolder = path.join(PUBLIC_PROJECTS_DIR, folderName);
                    if (copyProjectImage(sourcePath, destFolder, imageName)) {
                        imagesCopied++;
                        log(`Copied image for '${projectTitle}': ${imageName}`);
                    } else {
                        missingImages.push({
                            project: projectTitle,
                            source: sourcePath,
                            destination: path.join(destFolder, imageName)
                        });
                    }
                    
                    break;
                }
            }
        }
        
        if (!photoFound) {
            // Check if image already exists in public folder
            if (folderName) {
                const projectFolder = path.join(PUBLIC_PROJECTS_DIR, folderName);
                if (fs.existsSync(projectFolder) && currentImage) {
                    const imagePath = path.join(projectFolder, currentImage);
                    if (!fs.existsSync(imagePath)) {
                        missingImages.push({
                            project: projectTitle,
                            category: projectCategories.join(', '),
                            expected_image: currentImage,
                            note: 'Photo not found in source folder'
                        });
                    }
                }
            } else {
                unclearData.push({
                    project: projectTitle,
                    issue: 'No folder_name and no matching photo found',
                    categories: projectCategories.join(', ')
                });
            }
        }
        
        // Update URL if missing
        if (!project.url) {
            project.url = folderName || createSlug(projectTitle);
        }
    }
    
    // Save updated projects.json
    fs.writeFileSync(PROJECTS_JSON, JSON.stringify(data, null, 2), 'utf8');
    log(`Saved updated projects.json`);
    
    // Generate report
    generateReport(updates, missingImages, unclearData, projectsUpdated, imagesCopied, photosByCategory);
    
    return {
        projectsUpdated,
        imagesCopied,
        missingImages: missingImages.length,
        unclearData: unclearData.length
    };
}

function generateReport(updates, missingImages, unclearData, projectsUpdated, imagesCopied, photosByCategory) {
    const reportLines = [
        '# Project Slides Analysis Report',
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        '## Summary',
        `- Projects Updated: ${projectsUpdated}`,
        `- Images Copied: ${imagesCopied}`,
        `- Missing Images: ${missingImages.length}`,
        `- Unclear Data Items: ${unclearData.length}`,
        '',
        '## Available Photos by Category',
        ''
    ];
    
    // List available photos
    for (const [category, photos] of Object.entries(photosByCategory)) {
        reportLines.push(`### ${category}`);
        reportLines.push(`Total photos: ${photos.length}`);
        for (const photo of photos) {
            reportLines.push(`- ${photo.filename}`);
        }
        reportLines.push('');
    }
    
    // Missing images
    if (missingImages.length > 0) {
        reportLines.push('## Missing Images', '');
        for (const item of missingImages) {
            reportLines.push(`### ${item.project}`);
            for (const [key, value] of Object.entries(item)) {
                if (key !== 'project') {
                    reportLines.push(`- ${key}: ${value}`);
                }
            }
            reportLines.push('');
        }
    }
    
    // Unclear data
    if (unclearData.length > 0) {
        reportLines.push('## Unclear Data', '');
        for (const item of unclearData) {
            reportLines.push(`### ${item.project}`);
            for (const [key, value] of Object.entries(item)) {
                if (key !== 'project') {
                    reportLines.push(`- ${key}: ${value}`);
                }
            }
            reportLines.push('');
        }
    }
    
    // Updates made
    if (updates.length > 0) {
        reportLines.push('## Updates Made', '');
        for (const update of updates) {
            reportLines.push(`- ${update}`);
        }
        reportLines.push('');
    }
    
    // Write report
    const reportDir = path.dirname(REPORT_FILE);
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
    fs.writeFileSync(REPORT_FILE, reportLines.join('\n'), 'utf8');
    log(`Report saved to: ${REPORT_FILE}`);
}


if (require.main === module) {
    try {
        const results = analyzeAndUpdateProjects();
        log('\nAnalysis complete!');
        log(`Projects updated: ${results.projectsUpdated}`);
        log(`Images copied: ${results.imagesCopied}`);
        log(`Missing images: ${results.missingImages}`);
        log(`Unclear data items: ${results.unclearData}`);
        log(`\nReport saved to: ${REPORT_FILE}`);
        log(`Log saved to: ${LOG_FILE}`);
    } catch (err) {
        log(`ERROR: ${err.message}`);
        log(err.stack);
        console.error(err);
        process.exit(1);
    }
}

module.exports = { analyzeAndUpdateProjects };






