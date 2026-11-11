const fs = require('fs');
const path = require('path');

// Script is in docs/Project Slides/extract-data/, so go up 3 levels to project root
const BASE_DIR = path.resolve(__dirname, '..', '..', '..');

// Paths (relative to project root)
const PROJECTS_JSON = path.join(BASE_DIR, 'data', 'projects.json');
const SOURCE_IMAGES_DIR = path.join(BASE_DIR, 'docs', 'CONSULT EMDC Projects Photos');
const TARGET_PROJECTS_DIR = path.join(BASE_DIR, 'public', 'projects');
const OUTPUT_LOG = path.join(BASE_DIR, 'docs', 'project-images-copy-log.txt');
const OUTPUT_REPORT = path.join(BASE_DIR, 'docs', 'project-images-copy-report.json');

// Logging function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  try {
    fs.appendFileSync(OUTPUT_LOG, logMessage + '\n', 'utf8');
  } catch (err) {
    // Ignore log file errors
  }
}

// Read projects.json
let projectsData = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf8'));
let projects = projectsData.projects || [];

// Track results
const results = {
  copied: [],
  missing: [],
  errors: [],
  removed: [] // Projects removed from JSON
};

/**
 * Normalize filename for comparison (remove extension, lowercase, trim)
 */
function normalizeFilename(filename) {
  if (!filename) return '';
  return filename.replace(/\.[^/.]+$/, '').toLowerCase().trim();
}

/**
 * Find image file in source directory
 * Searches in category folders and handles different extensions
 */
function findImageFile(imageName, category) {
  if (!imageName) return null;
  
  const normalizedTarget = normalizeFilename(imageName);
  const categoryDir = path.join(SOURCE_IMAGES_DIR, category);
  
  // Check if category directory exists
  if (!fs.existsSync(categoryDir)) {
    return null;
  }
  
  // Get all files in category directory
  const files = fs.readdirSync(categoryDir);
  
  // Try exact match first (case-insensitive)
  for (const file of files) {
    const normalizedFile = normalizeFilename(file);
    if (normalizedFile === normalizedTarget) {
      return path.join(categoryDir, file);
    }
  }
  
  // Try partial match (in case of slight differences)
  for (const file of files) {
    const normalizedFile = normalizeFilename(file);
    if (normalizedFile.includes(normalizedTarget) || normalizedTarget.includes(normalizedFile)) {
      return path.join(categoryDir, file);
    }
  }
  
  return null;
}

/**
 * Copy file from source to destination
 */
function copyFile(sourcePath, destPath) {
  try {
    // Create destination directory if it doesn't exist
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Copy file
    fs.copyFileSync(sourcePath, destPath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Process all projects
 */
function processProjects() {
  // Clear log file
  if (fs.existsSync(OUTPUT_LOG)) {
    fs.unlinkSync(OUTPUT_LOG);
  }
  
  log('='.repeat(80));
  log('Starting image copy process...');
  log(`Total projects to process: ${projects.length}`);
  log('='.repeat(80));
  
  // Filter projects - keep only those with valid images
  const validProjects = [];
  
  for (const project of projects) {
    const projectTitle = project.title || 'Unknown';
    const folderName = project.folder_name || '';
    const imageName = project.project_image || '';
    const categories = project.categories || [];
    
    // Check if project has required fields
    if (!imageName) {
      results.missing.push({
        project: projectTitle,
        folderName: folderName,
        reason: 'No project_image field in JSON'
      });
      results.removed.push({
        project: projectTitle,
        folderName: folderName,
        reason: 'No project_image field in JSON'
      });
      continue; // Skip this project - don't add to validProjects
    }
    
    if (!folderName) {
      results.missing.push({
        project: projectTitle,
        imageName: imageName,
        reason: 'No folder_name field in JSON'
      });
      results.removed.push({
        project: projectTitle,
        imageName: imageName,
        reason: 'No folder_name field in JSON'
      });
      continue; // Skip this project - don't add to validProjects
    }
    
    // Try to find image in category folders
    let sourceImagePath = null;
    let foundCategory = null;
    
    for (const category of categories) {
      const found = findImageFile(imageName, category);
      if (found) {
        sourceImagePath = found;
        foundCategory = category;
        break;
      }
    }
    
    // If not found in categories, search all folders
    if (!sourceImagePath) {
      const allCategories = fs.readdirSync(SOURCE_IMAGES_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      for (const category of allCategories) {
        const found = findImageFile(imageName, category);
        if (found) {
          sourceImagePath = found;
          foundCategory = category;
          break;
        }
      }
    }
    
    // If image not found, remove project from JSON
    if (!sourceImagePath) {
      results.missing.push({
        project: projectTitle,
        folderName: folderName,
        imageName: imageName,
        categories: categories,
        reason: 'Image file not found in source directory'
      });
      results.removed.push({
        project: projectTitle,
        folderName: folderName,
        imageName: imageName,
        categories: categories,
        reason: 'Image file not found in source directory'
      });
      continue; // Skip this project - don't add to validProjects
    }
    
    // Determine destination path
    const destDir = path.join(TARGET_PROJECTS_DIR, folderName);
    const destPath = path.join(destDir, imageName);
    
    // Copy file
    if (copyFile(sourceImagePath, destPath)) {
      results.copied.push({
        project: projectTitle,
        folderName: folderName,
        imageName: imageName,
        sourceCategory: foundCategory,
        sourcePath: sourceImagePath,
        destPath: destPath
      });
      // Add to valid projects (only if image was successfully copied)
      validProjects.push(project);
    } else {
      results.errors.push({
        project: projectTitle,
        imageName: imageName,
        reason: 'Failed to copy file'
      });
      results.removed.push({
        project: projectTitle,
        folderName: folderName,
        imageName: imageName,
        reason: 'Failed to copy file'
      });
      // Don't add to validProjects if copy failed
    }
  }
  
  // Update projects.json with only valid projects
  projectsData.projects = validProjects;
  fs.writeFileSync(PROJECTS_JSON, JSON.stringify(projectsData, null, 2), 'utf8');
  log(`\n📝 Updated projects.json: Removed ${results.removed.length} projects, kept ${validProjects.length} projects`);
  
  // Print results
  log('\n' + '='.repeat(80));
  log('RESULTS SUMMARY');
  log('='.repeat(80));
  log(`✅ Successfully copied: ${results.copied.length} images`);
  log(`❌ Missing images: ${results.missing.length}`);
  log(`⚠️  Errors: ${results.errors.length}`);
  log(`🗑️  Removed from JSON: ${results.removed.length} projects`);
  log(`📊 Final project count: ${validProjects.length} (was ${projects.length})`);
  log('');
  
  if (results.copied.length > 0) {
    log('\n📋 COPIED IMAGES:');
    log('-'.repeat(80));
    results.copied.forEach((item, index) => {
      log(`${index + 1}. ${item.project}`);
      log(`   Folder: ${item.folderName}`);
      log(`   Image: ${item.imageName}`);
      log(`   Source: ${path.relative(BASE_DIR, item.sourcePath)}`);
      log(`   Dest: ${path.relative(BASE_DIR, item.destPath)}`);
      log('');
    });
  }
  
  if (results.removed.length > 0) {
    log('\n🗑️  REMOVED PROJECTS (from projects.json):');
    log('-'.repeat(80));
    results.removed.forEach((item, index) => {
      log(`${index + 1}. ${item.project}`);
      log(`   Folder: ${item.folderName || 'N/A'}`);
      log(`   Image: ${item.imageName || 'N/A'}`);
      log(`   Categories: ${item.categories?.join(', ') || 'N/A'}`);
      log(`   Reason: ${item.reason}`);
      log('');
    });
  }
  
  if (results.missing.length > 0) {
    log('\n❌ MISSING IMAGES:');
    log('-'.repeat(80));
    results.missing.forEach((item, index) => {
      log(`${index + 1}. ${item.project}`);
      log(`   Image: ${item.imageName || 'N/A'}`);
      log(`   Categories: ${item.categories?.join(', ') || 'N/A'}`);
      log(`   Reason: ${item.reason}`);
      log('');
    });
  }
  
  if (results.errors.length > 0) {
    log('\n⚠️  ERRORS:');
    log('-'.repeat(80));
    results.errors.forEach((item, index) => {
      log(`${index + 1}. ${item.project}`);
      log(`   Image: ${item.imageName}`);
      log(`   Reason: ${item.reason}`);
      log('');
    });
  }
  
  // Save report to file
  const reportDir = path.dirname(OUTPUT_REPORT);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: projects.length,
      copied: results.copied.length,
      missing: results.missing.length,
      errors: results.errors.length,
      removed: results.removed.length,
      finalCount: validProjects.length
    },
    copied: results.copied,
    missing: results.missing,
    errors: results.errors,
    removed: results.removed
  };
  
  fs.writeFileSync(OUTPUT_REPORT, JSON.stringify(report, null, 2));
  log(`\n📄 Detailed report saved to: ${path.relative(BASE_DIR, OUTPUT_REPORT)}`);
  log(`📄 Log file saved to: ${path.relative(BASE_DIR, OUTPUT_LOG)}`);
}

// Run the script
try {
  // Ensure output directory exists
  const docsDir = path.dirname(OUTPUT_LOG);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  // Verify paths exist
  log(`Checking paths...`);
  log(`Base directory: ${BASE_DIR}`);
  log(`Projects JSON: ${PROJECTS_JSON}`);
  log(`Exists: ${fs.existsSync(PROJECTS_JSON)}`);
  log(`Source Images Dir: ${SOURCE_IMAGES_DIR}`);
  log(`Exists: ${fs.existsSync(SOURCE_IMAGES_DIR)}`);
  
  if (!fs.existsSync(PROJECTS_JSON)) {
    throw new Error(`Projects JSON file not found: ${PROJECTS_JSON}`);
  }
  if (!fs.existsSync(SOURCE_IMAGES_DIR)) {
    throw new Error(`Source images directory not found: ${SOURCE_IMAGES_DIR}`);
  }
  
  processProjects();
  log('\n✅ Process completed!');
  console.log('\n✅ Process completed! Check log file:', OUTPUT_LOG);
  process.exit(0);
} catch (error) {
  const errorMsg = `\n❌ Error: ${error.message}\n${error.stack}`;
  try {
    log(errorMsg);
  } catch (logErr) {
    // If logging fails, at least print to console
  }
  console.error(errorMsg);
  process.exit(1);
}






