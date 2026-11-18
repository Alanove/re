const fs = require('fs');
const path = require('path');
const { presentProductBody } = require('../dist/src/services/productsService');

const write = process.argv.includes('--write');
const fileArg = process.argv.find((arg) => arg.endsWith('.json'));
const file = fileArg ? path.resolve(fileArg) : path.join(__dirname, '..', 'data', 'products.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const products = data.products || {};
let changed = 0;
let withPdf = 0;
let leftover = 0;

for (const product of Object.values(products)) {
  const before = product.content || '';
  const result = presentProductBody(before, product.pdf || '');
  if (/download\s+pdf/i.test(result.content)) leftover += 1;
  if (result.pdf) withPdf += 1;
  if (result.content !== before || (result.pdf && result.pdf !== (product.pdf || ''))) {
    changed += 1;
    product.content = result.content;
    if (result.pdf) product.pdf = result.pdf;
  }
}

console.log(JSON.stringify({
  file,
  products: Object.keys(products).length,
  changed,
  withPdf,
  leftover
}));

if (write) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}
