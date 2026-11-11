/**
 * Updates environmental-sustainability page content in data/pages.json
 */
const fs = require('fs');
const path = require('path');

const pagesFile = path.join(__dirname, '..', 'data', 'pages.json');
const data = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));
const icon = (name) => `/images/icons/${name}`;

const checkIcon = (file) =>
  `<span class="es-item-icon" aria-hidden="true"><img src="${icon(file)}" alt="" width="48" height="48" loading="lazy" decoding="async"/></span>`;

const content = `<article class="es-page scrollReveal">
<section class="breadcrumb_wrapper"><div class="container"><h1 class="title big white">Environmental Sustainability</h1><div class="breadcrumb"><p id="breadcrumbs"><span><span><a href="/"><img src="/themes/bluefieldco/images/home.png" alt="Home"/></a></span> &raquo; <span class="breadcrumb_last" aria-current="page">Environmental Sustainability</span></span></p></div></div></section>

<section class="es-section">
<div class="container">
<div class="es-content">
<h2 class="es-title title blue">Environmental Sustainability</h2>
<div class="es-icon" aria-hidden="true"><img src="${icon('Environmental-sustainability.png')}" alt="" width="72" height="72" loading="lazy" decoding="async"/></div>
<ul class="es-list">
<li class="es-item">${checkIcon('correct-sign.png')}<span>We focus on preserving and protecting the environment in the MENA region.</span></li>
<li class="es-item">${checkIcon('correct-sign.png')}<span>We are committed to reducing environmental negative impacts through initiatives.</span></li>
<li class="es-item">${checkIcon('correct-sign.png')}<span>Our practices prioritize soil health, reduce water usage, and minimize waste in agriculture.</span></li>
<li class="es-item">${checkIcon('correct-sign.png')}<span>We aim to leave a greener and healthier world for future generations.</span></li>
</ul>
</div>
</div>
</section>
</article>`;

const key = 'sustainability-environmental-sustainability';
if (!data.pages[key]) {
  console.error('Page not found:', key);
  process.exit(1);
}

data.pages[key].content = content;
data.pages[key].lastUpdated = new Date().toISOString();

fs.writeFileSync(pagesFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Updated', key);
