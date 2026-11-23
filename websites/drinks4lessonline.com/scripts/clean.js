const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist');

try {
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
    console.log('✓ Cleaned dist directory');
  } else {
    console.log('✓ dist directory does not exist (already clean)');
  }
} catch (error) {
  console.error('✗ Error cleaning dist directory:', error.message);
  process.exit(1);
}





