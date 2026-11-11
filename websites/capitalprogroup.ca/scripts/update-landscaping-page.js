/**
 * Updates sector-landscaping page content in data/pages.json
 */
const fs = require('fs');
const path = require('path');
const { buildSectorPageHeader } = require('./sector-header');

const pagesFile = path.join(__dirname, '..', 'data', 'pages.json');
const data = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));

const body = `
<section class="sector-detail landscaping-page">
<div class="container">
<div class="sector-block sector-services">
<h2 class="sector-heading">Services</h2>
<p class="sector-services-text">Our team of horticulturists and architects collaborate closely with customers to design stunning gardens that blend in with the surroundings.</p>
<ul class="sector-service-list">
<li><a href="/landscape-design-and-execution">Landscape Design and Execution</a></li>
<li><a href="/gardening-and-maintenance">Gardening and Maintenance</a></li>
<li><a href="/irrigation">Irrigation</a></li>
</ul>
</div>
<div class="sector-block sector-company">
<h2 class="sector-heading">Company</h2>
<div class="sector-company-single">
<img src="/images/landscaping/albizia-landscape-services.png" alt="ALBIZIA Landscape Services"/>
</div>
</div>
<div class="sector-block sector-countries">
<h2 class="sector-heading">Countries</h2>
<ul class="sector-country-grid">
<li><img src="/images/agriculture/flags/lebanon.png" alt="" width="40" height="40"/><span>Lebanon</span></li>
<li><img src="/images/agriculture/flags/iraq.png" alt="" width="40" height="40"/><span>Iraq</span></li>
</ul>
</div>
</div>
</section>
</article>
`.trim();

const content = buildSectorPageHeader('Landscaping', 'Landscaping', 'landscaping') + body;

const pageImage = '/uploads/2024/03/Evolution-Header.jpg';
const now = new Date().toISOString();

data.pages['sector-landscaping'] = {
  key: 'sector-landscaping',
  title: 'Landscaping',
  url: '/sector/landscaping',
  content,
  pageImage,
  status: 'published',
  includeInMenu: true,
  menuSort: 100,
  lastUpdated: now,
  seo: {
    pageTitle: 'Landscaping | BlueField Group',
    pageDescription: 'ALBIZIA Landscape Services provides landscape design, gardening, and irrigation in Lebanon and Iraq.',
    pageKeywords: 'BlueField, landscaping, ALBIZIA, garden design, irrigation, Lebanon, Iraq',
    pageImage,
    pageType: 'website'
  }
};

fs.writeFileSync(pagesFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Updated sector-landscaping page in pages.json');
