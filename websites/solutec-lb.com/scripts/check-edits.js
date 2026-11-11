const fs = require('fs');
const path = require('path');

const base = 'http://localhost:3030';

function cookiesFrom(response) {
  const raw = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  return raw.map((item) => item.split(';')[0]).join('; ');
}

async function main() {
  const login = await fetch(base + '/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'email=admin@solutec.local&password=SolutecAdmin1',
    redirect: 'manual'
  });
  const cookie = cookiesFrom(login);
  if (!cookie) throw new Error('login failed ' + login.status);
  const productPage = await fetch(base + '/admin/products/srp-350iii/edit', { headers: { cookie } });
  const productHtml = await productPage.text();
  console.log('product form', productPage.status, productHtml.includes('type="file"'), productHtml.includes('Image path'), productHtml.includes('galleryFiles'));
  const categoryPage = await fetch(base + '/admin/product-categories/barcode-printers/edit', { headers: { cookie } });
  const categoryHtml = await categoryPage.text();
  console.log('category form', categoryPage.status, categoryHtml.includes('name="imageFile"'), categoryHtml.includes('Image path'));
  const page = await fetch(base + '/admin/pages/about-us/edit', { headers: { cookie } });
  const pageHtml = await page.text();
  console.log('page form', page.status, pageHtml.includes('name="pagePicture"'), pageHtml.includes('name="logoFile"'), pageHtml.includes('Header logo URL'), pageHtml.includes('name="seoImageUrl"'));

  const before = JSON.parse(fs.readFileSync(path.join('data', 'products.json'), 'utf8'));
  const original = JSON.parse(JSON.stringify(before.products['srp-350iii']));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const form = new FormData();
  form.set('key', 'srp-350iii');
  form.set('title', 'SRP-350III');
  form.set('sku', 'test-sku');
  form.set('excerpt', 'edit check');
  form.set('content', '<p>edit check</p>');
  form.set('status', 'published');
  form.set('seoTitle', 'SRP-350III – Solutec');
  form.set('imageFile', new Blob([png], { type: 'image/png' }), 'dot.png');
  form.set('galleryFiles', new Blob([png], { type: 'image/png' }), 'gallery.png');
  const saved = await fetch(base + '/admin/products/save', { method: 'POST', headers: { cookie }, body: form, redirect: 'manual' });
  console.log('save', saved.status, saved.headers.get('location'));
  const data = JSON.parse(fs.readFileSync(path.join('data', 'products.json'), 'utf8'));
  const product = data.products['srp-350iii'];
  console.log('saved image', product.image, 'gallery', product.gallery, 'excerpt', product.excerpt);

  const remove = new FormData();
  remove.set('key', 'srp-350iii');
  remove.set('title', 'SRP-350III');
  remove.set('status', 'published');
  remove.set('seoTitle', 'SRP-350III – Solutec');
  remove.set('removeImage', '1');
  (product.gallery || []).forEach((image) => remove.append('removeGallery', image));
  const removed = await fetch(base + '/admin/products/save', { method: 'POST', headers: { cookie }, body: remove, redirect: 'manual' });
  console.log('remove', removed.status, removed.headers.get('location'));
  const after = JSON.parse(fs.readFileSync(path.join('data', 'products.json'), 'utf8')).products['srp-350iii'];
  console.log('after image', JSON.stringify(after.image), 'gallery', after.gallery);
  const restored = JSON.parse(fs.readFileSync(path.join('data', 'products.json'), 'utf8'));
  restored.products['srp-350iii'] = original;
  fs.writeFileSync(path.join('data', 'products.json'), JSON.stringify(restored, null, 2));
  console.log('restored original product');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
