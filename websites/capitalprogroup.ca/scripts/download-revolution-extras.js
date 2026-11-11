const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://capitalpro.liteweb.info';
const ROOT = path.resolve(__dirname, '..');

function download(urlPath, destRel) {
  return new Promise((resolve) => {
    const dest = path.join(ROOT, destRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    const url = urlPath.startsWith('http') ? urlPath : BASE + urlPath;
    https
      .get(url, { headers: { 'User-Agent': 'CapitalCMS-Migrator' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(dest, () => {});
          return download(res.headers.location, destRel).then(resolve);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          return resolve(false);
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('OK', destRel);
          resolve(true);
        });
      })
      .on('error', () => {
        file.close();
        fs.unlink(dest, () => {});
        resolve(false);
      });
  });
}

const extras = [
  '/plugins/revolution-slider/revolution/js/extensions/revolution.extension.slideanims.min.js',
  '/plugins/revolution-slider/revolution/js/extensions/revolution.extension.layeranimation.min.js',
  '/plugins/revolution-slider/revolution/js/extensions/revolution.extension.navigation.min.js',
  '/plugins/revolution-slider/revolution/js/extensions/revolution.extension.kenburn.min.js',
  '/plugins/revolution-slider/revolution/js/extensions/revolution.extension.parallax.min.js',
  '/plugins/revolution-slider/revolution/js/extensions/revolution.extension.actions.min.js',
  '/plugins/revolution-slider/revolution/js/extensions/revolution.extension.video.min.js',
  '/plugins/revolution-slider/revolution/js/extensions/revolution.extension.migration.min.js',
  '/plugins/revolution-slider/revolution/fonts/revicons/revicons.woff',
  '/plugins/revolution-slider/revolution/fonts/revicons/revicons.ttf',
  '/plugins/revolution-slider/revolution/fonts/revicons/revicons.eot',
  '/plugins/revolution-slider/revolution/fonts/revicons/revicons.svg',
  '/plugins/revolution-slider/revolution/fonts/pe-icon-7-stroke/fonts/Pe-icon-7-stroke.woff',
  '/plugins/revolution-slider/revolution/fonts/pe-icon-7-stroke/fonts/Pe-icon-7-stroke.ttf',
  '/release/bundle.min.js'
];

(async () => {
  for (const file of extras) {
    await download(file, `public${file}`);
  }
})();
