const https = require('https');
const fs = require('fs');
const path = require('path');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        get(res.headers.location).then(resolve, reject);
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const html = await get('https://solutec-lb.com/');
  const match = html.match(/<style id="theme_options-dynamic-css"[^>]*>([\s\S]*?)<\/style>/);
  if (!match) throw new Error('dynamic css not found');
  const out = path.join(__dirname, '..', 'public', 'theme', 'manufacturer', 'dynamic.css');
  fs.writeFileSync(out, match[1]);
  console.log('dynamic', match[1].length);
  const dir = path.join(__dirname, '..', 'public', 'theme', 'elementor', 'css');
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    const css = fs.readFileSync(filePath, 'utf8');
    const next = css
      .replace(/https?:\/\/(?:www\.)?solutec-lb\.com\/wp-content\/uploads\//gi, '/uploads/')
      .replace(/https?:\/\/linuxfinal\.liteweb\.info\/~zazoo\/wp-content\/uploads\//gi, '/uploads/');
    if (next !== css) {
      fs.writeFileSync(filePath, next);
      console.log('rewrote', file);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
