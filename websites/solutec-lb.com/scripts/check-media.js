const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const uploads = path.join(root, 'public', 'uploads');

function main() {
  fs.mkdirSync(uploads, { recursive: true });
  const probe = path.join(uploads, `.media-check-${process.pid}`);
  fs.writeFileSync(probe, 'ok');
  fs.unlinkSync(probe);
  console.log(`uploads      ${uploads} is writable`);
  console.log('Media check passed.');
}

try {
  main();
} catch (error) {
  console.error('Media check failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
