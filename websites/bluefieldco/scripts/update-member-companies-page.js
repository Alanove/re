/**
 * Updates member-companies page content in data/pages.json
 */
const fs = require('fs');
const path = require('path');

const pagesFile = path.join(__dirname, '..', 'data', 'pages.json');
const data = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));
const img = (name) => `/images/member-companies/${name}`;
const icon = (name) => `/images/icons/${name}`;
const featureIcon = (file) =>
  `<span class="mc-feature-icon" aria-hidden="true"><img src="${icon(file)}" alt="" width="48" height="48" loading="lazy" decoding="async"/></span>`;

const content = `<article class="member-companies-page scrollReveal">
<section class="breadcrumb_wrapper"><div class="container"><h1 class="title big white">Member Companies</h1><div class="breadcrumb"><p id="breadcrumbs"><span><span><a href="/"><img src="/themes/bluefieldco/images/home.png" alt="Home"/></a></span> &raquo; <span class="breadcrumb_last" aria-current="page">Member Companies</span></span></p></div></div></section>

<section class="mc-board-section" id="our-footprint">
<div class="container">
<div class="mc-board mc-footprint-board">
<h2 class="mc-board-title">Our Footprint</h2>

<div class="mc-footprint-stage">
<div class="mc-footprint-grid">

<div class="mc-fp-lead mc-feature">
${featureIcon('fast-growing.png')}
<p class="mc-feature-text mc-feature-lead">Fastest Growing Company In The Middle East</p>
</div>

<div class="mc-fp-col mc-fp-col-left">
<div class="mc-block mc-icon-layout">
<span class="mc-num-icon" aria-hidden="true">7</span>
<h3 class="mc-block-label">Member Companies</h3>
<ul class="mc-list mc-list-split mc-block-body">
<li><a href="/member_company/bluefield-agriculture-uae">BlueField Agriculture UAE</a></li>
<li><a href="/member_company/bluefield-agriculture-jordan">BlueField Agriculture Jordan</a></li>
<li><a href="/member_company/bluefield-agriculture-lebanon">BlueField Agriculture Lebanon</a></li>
<li><a href="/member_company/bluefield-agriculture-iraq">BlueField Agriculture Iraq</a></li>
<li><a href="/member_company/bluefield-public-health-lebanon">BlueField Public Health</a></li>
<li><a href="/member_company/albizia-landscape-services-lebanon">ALBIZIA Landscape Services</a></li>
<li><a href="/member_company/bf-core-cleaning-services-lebanon">BF CORE Cleaning Services</a></li>
</ul>
</div>
</div>

<div class="mc-fp-col mc-fp-col-right mc-fp-dual-row">
<div class="mc-block mc-icon-layout">
<span class="mc-num-icon" aria-hidden="true">4</span>
<h3 class="mc-block-label">Sectors</h3>
<ul class="mc-list mc-block-body">
<li>Agriculture</li>
<li>Pest Control &amp; Management</li>
<li>Landscaping</li>
<li>Cleaning Services</li>
</ul>
</div>
<div class="mc-block mc-icon-layout">
<span class="mc-num-icon" aria-hidden="true">4</span>
<h3 class="mc-block-label">Countries</h3>
<ul class="mc-list mc-block-body">
<li>UAE</li>
<li>Jordan</li>
<li>Lebanon</li>
<li>Iraq</li>
</ul>
</div>
</div>

<div class="mc-fp-col mc-fp-col-left">
<div class="mc-feature">
${featureIcon('over-2-decades.jpg')}
<p class="mc-feature-text">Over <span class="mc-em">2</span> Decades of Experience</p>
</div>
</div>

<div class="mc-fp-col mc-fp-col-right">
<div class="mc-feature">
${featureIcon('market-presence.png')}
<p class="mc-feature-text"><span class="mc-em">Strong Market Presence</span> In The Middle East: UAE, Jordan, Lebanon, Iraq</p>
</div>
</div>

<div class="mc-fp-col mc-fp-col-left">
<div class="mc-feature">
${featureIcon('proven-track-record.png')}
<p class="mc-feature-text">Proven track record of <span class="mc-em">growth</span> and <span class="mc-em">expansion</span></p>
</div>
</div>

<div class="mc-fp-col mc-fp-col-right">
<div class="mc-feature">
${featureIcon('commitment.png')}
<p class="mc-feature-text">Commitment to <span class="mc-em">innovation</span>, <span class="mc-em">sustainability</span>, and <span class="mc-em">quality</span></p>
</div>
</div>

<div class="mc-fp-capabilities-head mc-feature">
${featureIcon('capabilities.png')}
<h3 class="mc-block-title">Capabilities</h3>
</div>

<div class="mc-fp-col mc-fp-col-left">
<ul class="mc-capabilities-list">
<li class="mc-cap-item">${featureIcon('correct-sign.png')}<span>Precision Agriculture &amp; Smart Farming</span></li>
<li class="mc-cap-item">${featureIcon('correct-sign.png')}<span>Collaborative Learning Ecosystem</span></li>
</ul>
</div>

<div class="mc-fp-col mc-fp-col-right">
<ul class="mc-capabilities-list">
<li class="mc-cap-item">${featureIcon('correct-sign.png')}<span>Smart Technology Integration</span></li>
<li class="mc-cap-item">${featureIcon('correct-sign.png')}<span>Responsible Pest Control Practices</span></li>
</ul>
</div>

</div>
</div>
</div>
</div>
</section>

<section class="mc-board-section" id="global-presence">
<div class="container">
<div class="mc-board mc-global-board">
<h2 class="mc-board-title">Global Presence</h2>

<div class="mc-global-map">
<img src="${img('global-presence-map.png')}" alt="World map showing BlueField Group presence in UAE, Jordan, Lebanon, and Iraq"/>
</div>

<div class="mc-global-columns">
<div class="mc-global-col mc-global-ag">
<div class="mc-col-bar"></div>
<h3 class="mc-col-title">Agriculture</h3>
<ul class="mc-col-list">
<li><a href="/member_company/bluefield-agriculture-uae">BlueField Agriculture UAE</a></li>
<li><a href="/member_company/bluefield-agriculture-jordan">BlueField Agriculture Jordan</a></li>
<li><a href="/member_company/bluefield-agriculture-lebanon">BlueField Agriculture Lebanon</a></li>
<li><a href="/member_company/bluefield-agriculture-iraq">BlueField Agriculture Iraq</a></li>
</ul>
<div class="mc-col-logos">
<ul class="sector-company-grid mc-sector-logos">
<li><a href="/member_company/bluefield-agriculture-uae" class="sector-company-logo"><img src="/images/agriculture/companies/bluefield-agriculture-uae.png" alt="BlueField Agriculture UAE"/></a></li>
<li><a href="/member_company/bluefield-agriculture-jordan" class="sector-company-logo"><img src="/images/agriculture/companies/bluefield-agriculture-jordan.png" alt="BlueField Agriculture Jordan"/></a></li>
<li><a href="/member_company/bluefield-agriculture-lebanon" class="sector-company-logo"><img src="/images/agriculture/companies/bluefield-agriculture-lebanon.png" alt="BlueField Agriculture Lebanon"/></a></li>
<li><a href="/member_company/bluefield-agriculture-iraq" class="sector-company-logo"><img src="/images/agriculture/companies/bluefield-agriculture-iraq.png" alt="BlueField Agriculture Iraq"/></a></li>
</ul>
</div>
</div>

<div class="mc-global-col mc-global-pest">
<div class="mc-col-bar"></div>
<h3 class="mc-col-title">Pest Control &amp; Management</h3>
<ul class="mc-col-list">
<li><a href="/member_company/bluefield-public-health-lebanon">BlueField Public Health</a></li>
</ul>
<div class="mc-col-logos">
<ul class="sector-company-grid mc-sector-logos">
<li><a href="/member_company/bluefield-public-health-lebanon" class="sector-company-logo"><img src="/images/pest-management/bluefield-public-health.png" alt="BlueField Public Health"/></a></li>
</ul>
</div>
</div>

<div class="mc-global-col mc-global-land">
<div class="mc-col-bar"></div>
<h3 class="mc-col-title">Landscaping</h3>
<ul class="mc-col-list">
<li><a href="/member_company/albizia-landscape-services-lebanon">ALBIZIA Landscape Services</a></li>
</ul>
<div class="mc-col-logos">
<ul class="sector-company-grid mc-sector-logos">
<li><a href="/member_company/albizia-landscape-services-lebanon" class="sector-company-logo"><img src="/images/landscaping/albizia-landscape-services.png" alt="ALBIZIA Landscape Services"/></a></li>
</ul>
</div>
</div>

<div class="mc-global-col mc-global-clean">
<div class="mc-col-bar"></div>
<h3 class="mc-col-title">Cleaning Services</h3>
<ul class="mc-col-list">
<li><a href="/member_company/bf-core-cleaning-services-lebanon">BF Core Cleaning Services</a></li>
</ul>
<div class="mc-col-logos">
<ul class="sector-company-grid mc-sector-logos">
<li><a href="/member_company/bf-core-cleaning-services-lebanon" class="sector-company-logo"><img src="/images/cleaning-services/bf-core-cleaning-services.png" alt="BF CORE Cleaning Services"/></a></li>
</ul>
</div>
</div>
</div>
</div>
</div>
</section>
</article>`;

const now = new Date().toISOString();

data.pages['member-companies'] = {
  key: 'member-companies',
  title: 'Member Companies',
  url: '/member-companies',
  content,
  pageImage: '',
  status: 'published',
  includeInMenu: true,
  menuSort: 100,
  lastUpdated: now,
  seo: {
    pageTitle: 'Member Companies | BlueField Group',
    pageDescription:
      'BlueField Group member companies across UAE, Jordan, Lebanon, and Iraq — agriculture, pest control, landscaping, and cleaning services.',
    pageKeywords:
      'BlueField, member companies, agriculture, pest management, landscaping, cleaning, UAE, Jordan, Lebanon, Iraq',
    pageImage: '/themes/bluefieldco/images/bluefield_logo.svg',
    pageType: 'website'
  }
};

fs.writeFileSync(pagesFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Updated member-companies page in pages.json');
