/**
 * Updates sector-cleaning-services page content in data/pages.json
 */
const fs = require('fs');
const path = require('path');
const { buildSectorPageHeader } = require('./sector-header');

const pagesFile = path.join(__dirname, '..', 'data', 'pages.json');
const data = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));

const body = `
<section class="sector-detail cleaning-services-page">
<div class="container">
<div class="sector-block sector-services">
<h2 class="sector-heading">Services</h2>
<p class="sector-services-text">Our cleaning services offer full solutions for various types of properties to maintain healthy living and working environments, cleanliness, and hygiene.</p>
<ul class="sector-service-columns sector-service-columns-2">
<li class="sector-service-col">
<ul>
<li>Vacuum Cleaning</li>
<li>Toilet Sanitization Cleaning</li>
<li>School Cleaning</li>
<li>Restaurant Cleaning</li>
<li>Post Construction Cleaning</li>
</ul>
</li>
<li class="sector-service-col">
<ul>
<li>Patio and Sidewalks Cleaning</li>
<li>Office Cleaning</li>
<li>Glass and Fa&ccedil;ade Cleaning</li>
<li>Furniture Cleaning</li>
<li>Carpet Cleaning</li>
</ul>
</li>
</ul>
</div>
<div class="sector-block sector-company">
<h2 class="sector-heading">Company</h2>
<div class="sector-company-single">
<img src="/images/cleaning-services/bf-core-cleaning-services.png" alt="BF CORE Cleaning Services"/>
</div>
</div>
<div class="sector-block sector-countries">
<h2 class="sector-heading">Country</h2>
<ul class="sector-country-grid">
<li><img src="/images/agriculture/flags/lebanon.png" alt="" width="40" height="40"/><span>Lebanon</span></li>
<li><img src="/images/agriculture/flags/iraq.png" alt="" width="40" height="40"/><span>Iraq</span></li>
</ul>
</div>
</div>
</section>
</article>
`.trim();

const content = buildSectorPageHeader('Cleaning Services', 'Cleaning Services', 'cleaning-services') + body;

const pageImage = '/uploads/2024/03/Innovation-Header.jpg';
const now = new Date().toISOString();

data.pages['sector-cleaning-services'] = {
  key: 'sector-cleaning-services',
  title: 'Cleaning Services',
  url: '/sector/cleaning-services',
  content,
  pageImage,
  status: 'published',
  includeInMenu: true,
  menuSort: 100,
  lastUpdated: now,
  seo: {
    pageTitle: 'Cleaning Services | BlueField Group',
    pageDescription: 'BF CORE Cleaning Services provides professional cleaning for offices, schools, restaurants, and more in Lebanon and Iraq.',
    pageKeywords: 'BlueField, cleaning services, BF CORE, office cleaning, Lebanon, Iraq',
    pageImage,
    pageType: 'website'
  }
};

fs.writeFileSync(pagesFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Updated sector-cleaning-services page in pages.json');
