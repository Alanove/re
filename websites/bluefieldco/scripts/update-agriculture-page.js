/**
 * Updates sector-agriculture page content in data/pages.json
 */
const fs = require('fs');
const path = require('path');
const { buildSectorPageHeader } = require('./sector-header');

const pagesFile = path.join(__dirname, '..', 'data', 'pages.json');
const data = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));

const body = `
<section class="sector-detail agriculture-page">
<div class="container">
<div class="sector-block sector-products">
<h2 class="sector-heading">Products</h2>
<ul class="sector-product-grid">
<li><a href="/vegetable-seeds"><img src="/images/agriculture/icons/vegetable-seeds.svg" alt="" width="48" height="48"/><span>Vegetable Seeds</span></a></li>
<li><a href="/fertilizers"><img src="/images/agriculture/icons/fertilizers.svg" alt="" width="48" height="48"/><span>Fertilizers</span></a></li>
<li><a href="/field-crop-seeds"><img src="/images/agriculture/icons/field-crop-seeds.svg" alt="" width="48" height="48"/><span>Field Crop Seeds</span></a></li>
<li><a href="/irrigation-materials"><img src="/images/agriculture/icons/irrigation-materials.svg" alt="" width="48" height="48"/><span>Irrigation Materials</span></a></li>
<li><a href="/pesticides"><img src="/images/agriculture/icons/pesticides.svg" alt="" width="48" height="48"/><span>Pesticides</span></a></li>
<li><a href="/potato-tubers"><img src="/images/agriculture/icons/potato-tubers.svg" alt="" width="48" height="48"/><span>Potato Tubers</span></a></li>
<li><a href="/agri-covers"><img src="/images/agriculture/icons/agri-covers.svg" alt="" width="48" height="48"/><span>Agri Covers</span></a></li>
</ul>
</div>
<div class="sector-block sector-services">
<h2 class="sector-heading">Services</h2>
<p class="sector-services-text">A commitment to supporting and empowering farmers, agricultural enterprises and industry stakeholders, our team of experienced agricultural engineers and specialists is devoted to deliver professional guidance aimed at enhancing agricultural practices, increasing productivity and tackling challenges encountered by farmers.</p>
</div>
<div class="sector-block sector-companies">
<h2 class="sector-heading">Companies</h2>
<ul class="sector-company-grid">
<li><a href="/member_company/bluefield-agriculture-uae" class="sector-company-logo"><img src="/images/agriculture/companies/bluefield-agriculture-uae.png" alt="BlueField Agriculture UAE"/></a></li>
<li><a href="/member_company/bluefield-agriculture-jordan" class="sector-company-logo"><img src="/images/agriculture/companies/bluefield-agriculture-jordan.png" alt="BlueField Agriculture Jordan"/></a></li>
<li><a href="/member_company/bluefield-agriculture-lebanon" class="sector-company-logo"><img src="/images/agriculture/companies/bluefield-agriculture-lebanon.png" alt="BlueField Agriculture Lebanon"/></a></li>
<li><a href="/member_company/bluefield-agriculture-iraq" class="sector-company-logo"><img src="/images/agriculture/companies/bluefield-agriculture-iraq.png" alt="BlueField Agriculture Iraq"/></a></li>
</ul>
</div>
<div class="sector-block sector-countries">
<h2 class="sector-heading">Countries</h2>
<ul class="sector-country-grid">
<li><img src="/images/agriculture/flags/uae.png" alt="" width="40" height="40"/><span>UAE</span></li>
<li><img src="/images/agriculture/flags/jordan.png" alt="" width="40" height="40"/><span>Jordan</span></li>
<li><img src="/images/agriculture/flags/lebanon.png" alt="" width="40" height="40"/><span>Lebanon</span></li>
<li><img src="/images/agriculture/flags/iraq.png" alt="" width="40" height="40"/><span>Iraq</span></li>
</ul>
</div>
</div>
</section>
</article>
`.trim();

const content = buildSectorPageHeader('Agriculture', 'Agriculture', 'agriculture') + body;

const pageImage = '/uploads/2026/06/Agriculture-Header.jpg';
const now = new Date().toISOString();

data.pages['sector-agriculture'] = {
  key: 'sector-agriculture',
  title: 'Agriculture',
  url: '/sector/agriculture',
  content,
  pageImage,
  status: 'published',
  includeInMenu: true,
  menuSort: 100,
  lastUpdated: now,
  seo: {
    pageTitle: 'Agriculture | BlueField Group',
    pageDescription: 'BlueField Group Agriculture — products, services, and member companies across UAE, Jordan, Lebanon, and Iraq.',
    pageKeywords: 'BlueField, agriculture, vegetable seeds, fertilizers, pesticides, UAE, Jordan, Lebanon, Iraq',
    pageImage,
    pageType: 'website'
  }
};

fs.writeFileSync(pagesFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Updated sector-agriculture page in pages.json');
