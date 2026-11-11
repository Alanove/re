/**
 * Updates sector-pest-management page content in data/pages.json
 */
const fs = require('fs');
const path = require('path');
const { buildSectorPageHeader } = require('./sector-header');

const pagesFile = path.join(__dirname, '..', 'data', 'pages.json');
const data = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));

const body = `
<section class="sector-detail pest-management-page">
<div class="container">
<div class="sector-block sector-services">
<h2 class="sector-heading">Services</h2>
<p class="sector-services-text">Our trained specialists use safe and efficient techniques to provide best in class pest control and management services to control pests and reduce health hazards.</p>
<ul class="sector-service-columns">
<li class="sector-service-col">
<ul>
<li>Termite Control</li>
<li>Spider Control</li>
<li><a href="/reptiles-treatment">Snake Control</a></li>
<li>Scorpion Control</li>
</ul>
</li>
<li class="sector-service-col">
<ul>
<li><a href="/rodents-mice-treatment">Rat and Mouse Control</a></li>
<li><a href="/flying-insects-treatment">Mosquito Control</a></li>
<li><a href="/reptiles-treatment">Lizard Control</a></li>
<li><a href="/flying-insects-treatment">Fly Control</a></li>
</ul>
</li>
<li class="sector-service-col">
<ul>
<li><a href="/crawling-insects-treatment">Cockroach Control</a></li>
<li>Black Millipede Control</li>
<li><a href="/bed-bugs-treatment">Bed Bug Control</a></li>
<li><a href="/crawling-insects-treatment">Ant Control</a></li>
</ul>
</li>
</ul>
</div>
<div class="sector-block sector-company">
<h2 class="sector-heading">Company</h2>
<div class="sector-company-single">
<img src="/images/pest-management/bluefield-public-health.png" alt="BlueField Public Health"/>
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

const content =
  buildSectorPageHeader(
    'Pest Control &amp; Management',
    'Pest Control &amp; Management',
    'pest-management'
  ) + body;

const pageImage = '/uploads/2026/06/Pest-Management-Header.jpg';
const now = new Date().toISOString();

data.pages['sector-pest-management'] = {
  key: 'sector-pest-management',
  title: 'Pest Control & Management',
  url: '/sector/pest-management',
  content,
  pageImage,
  status: 'published',
  includeInMenu: true,
  menuSort: 100,
  lastUpdated: now,
  seo: {
    pageTitle: 'Pest Control & Management | BlueField Group',
    pageDescription: 'BlueField Public Health provides professional pest control and management services in Lebanon and Iraq.',
    pageKeywords: 'BlueField, pest control, pest management, public health, termite, rodent, Lebanon, Iraq',
    pageImage,
    pageType: 'website'
  }
};

fs.writeFileSync(pagesFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Updated sector-pest-management page in pages.json');
