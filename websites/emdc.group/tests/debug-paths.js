const { DATA_PATHS } = require('./dist/src/constants/data-paths');

console.log('DATA_PATHS values:');
console.log('IMAGES_DIR:', DATA_PATHS.IMAGES_DIR);
console.log('PAGES_DIR:', DATA_PATHS.PAGES_DIR);
console.log('PUBLIC_DIR:', DATA_PATHS.PUBLIC_DIR);

const path = require('path');
const fs = require('fs');

// Test the generic directory
const genericDir = path.join(DATA_PATHS.IMAGES_DIR, 'generic');
console.log('Generic directory path:', genericDir);
console.log('Generic directory exists:', fs.existsSync(genericDir));

// Test the page editor directory
const pageEditorDir = path.join(DATA_PATHS.PAGES_DIR, 'asdfasdfasdfasdf', 'editor');
console.log('Page editor directory path:', pageEditorDir);
console.log('Page editor directory exists:', fs.existsSync(pageEditorDir));

// Test reading the generic directory
if (fs.existsSync(genericDir)) {
  try {
    const files = fs.readdirSync(genericDir);
    console.log('Files in generic directory:', files);
    
    // Test the exact logic from getImagesFromDirectory
    const images = [];
    files.forEach(file => {
      const filePath = path.join(genericDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        const ext = path.extname(file).toLowerCase();
        console.log(`File: ${file}, Extension: ${ext}`);
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
          const relativePath = path.relative(DATA_PATHS.PUBLIC_DIR, filePath);
          const publicUrl = '/' + relativePath.replace(/\\/g, '/');
          console.log(`Adding image: ${file}, URL: ${publicUrl}`);
          
          images.push({
            name: file,
            url: publicUrl,
            size: stats.size,
            modified: stats.mtime,
            path: filePath
          });
        }
      }
    });
    
    console.log('Final images array:', images);
  } catch (error) {
    console.error('Error reading generic directory:', error);
    console.error('Error stack:', error.stack);
  }
}
