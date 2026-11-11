/**
 * Updates social-responsibility page content in data/pages.json
 */
const fs = require('fs');
const path = require('path');

const pagesFile = path.join(__dirname, '..', 'data', 'pages.json');
const data = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));
const icon = (name) => `/images/icons/${name}`;

const checkIcon = (file) =>
  `<span class="es-item-icon" aria-hidden="true"><img src="${icon(file)}" alt="" width="48" height="48" loading="lazy" decoding="async"/></span>`;

const content = `<article class="es-page scrollReveal">
<section class="breadcrumb_wrapper"><div class="container"><h1 class="title big white">Social Responsibility</h1><div class="breadcrumb"><p id="breadcrumbs"><span><span><a href="/"><img src="/themes/bluefieldco/images/home.png" alt="Home"/></a></span> &raquo; <span class="breadcrumb_last" aria-current="page">Social Responsibility</span></span></p></div></div></section>

<section class="es-section">
<div class="container">
<div class="es-content">
<h2 class="es-title title blue">Social Responsibility</h2>
<div class="es-icon" aria-hidden="true"><img src="${icon('social-sustainability.png')}" alt="" width="72" height="72" loading="lazy" decoding="async"/></div>
<ul class="es-list">
<li class="es-item">${checkIcon('correct-sign.png')}<span>We prioritize the well-being of people and communities.</span></li>
<li class="es-item">${checkIcon('correct-sign.png')}<span>We drive positive change through economic development.</span></li>
<li class="es-item">${checkIcon('correct-sign.png')}<span>We improve living conditions and promote inclusivity and well-being for all.</span></li>
<li class="es-item">${checkIcon('correct-sign.png')}<span>We actively support farmers and empower vulnerable communities.</span></li>
<li class="es-item">${checkIcon('correct-sign.png')}<span>We create job opportunities.</span></li>
</ul>
</div>
</div>
</section>
</article>`;

const key = 'sustainability-social-responsibility';
if (!data.pages[key]) {
  console.error('Page not found:', key);
  process.exit(1);
}

data.pages[key].content = content;
data.pages[key].lastUpdated = new Date().toISOString();

fs.writeFileSync(pagesFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Updated', key);
