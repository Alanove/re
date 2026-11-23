import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(pathToFileURL('c:/ai/tests/re/tmp/xlsx-tool/package.json'));
const ExcelJS = require('exceljs');

const lines = fs.readFileSync('c:/ai/tests/re/tmp/guerra-truly-missing.tsv', 'utf8').split(/\r?\n/).filter(Boolean);
const rows = lines
  .map((l) => {
    const [id, name, file] = l.split('\t');
    return { productName: name.trim(), file: file.trim(), productId: Number(id) };
  })
  .sort((a, b) => a.productName.localeCompare(b.productName, 'en') || a.file.localeCompare(b.file));

const wb = new ExcelJS.Workbook();
const s = wb.addWorksheet('Missing images');
s.columns = [
  { header: 'Product name', key: 'productName', width: 45 },
  { header: 'File', key: 'file', width: 85 },
  { header: 'Product id', key: 'productId', width: 12 },
];
s.getRow(1).font = { bold: true };
for (const r of rows) s.addRow(r);

const outPrimary = 'c:/ai/tests/re/tmp/guerrasports-missing-images.xlsx';
const outFallback = 'c:/ai/tests/re/tmp/guerrasports-missing-images-truly.xlsx';
let out = outPrimary;
try {
  await wb.xlsx.writeFile(out);
} catch (e) {
  if (e && e.code === 'EBUSY') {
    out = outFallback;
    await wb.xlsx.writeFile(out);
  } else {
    throw e;
  }
}
console.log(`rows=${rows.length} wrote=${out}`);
