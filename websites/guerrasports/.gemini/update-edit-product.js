const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../../admin/views/products/edit-product.ejs');
let content = fs.readFileSync(filePath, 'utf8');

// First replacement: Basic Info through SEO (lines 43-211)
const searchPattern1 = /\t\t\t\t\t\t\t\t\t\t\t<!-- Basic Information -->[\s\S]*?\t\t\t\t\t\t\t\t\t\t\t<\/div>\n\t\t\t\t\t\t\t\t\t\t\t<\/div>/;
const replacement1 = '\t\t\t\t\t\t\t\t\t\t\t<%- include(\'product-form-fields\', { product: product }) %>';

// Second replacement: Settings card (after line 214)
const searchPattern2 = /\t\t\t\t\t\t\t\t\t\t\t<!-- Settings -->[\s\S]*?\t\t\t\t\t\t\t\t\t\t\t<\/div>\n\t\t\t\t\t\t\t\t\t\t\t<\/div>\n\n\t\t\t\t\t\t\t\t\t\t\t<!-- Product Images -->/;
const replacement2 = '\t\t\t\t\t\t\t\t\t\t\t<%- include(\'product-settings-card\', { product: product }) %>\n\n\t\t\t\t\t\t\t\t\t\t\t<!-- Product Images -->';

content = content.replace(searchPattern1, replacement1);
content = content.replace(searchPattern2, replacement2);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated edit-product.ejs');
