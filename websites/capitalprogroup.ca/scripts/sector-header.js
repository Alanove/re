/**
 * Shared sector page header with horizontal sub-menu (matches About Us a-sub-menu).
 */
const SECTOR_LINKS = [
  { slug: 'agriculture', label: 'Agriculture', url: '/sector/agriculture' },
  { slug: 'pest-management', label: 'Pest Management', url: '/sector/pest-management' },
  { slug: 'landscaping', label: 'Landscaping', url: '/sector/landscaping' },
  { slug: 'cleaning-services', label: 'Cleaning Services', url: '/sector/cleaning-services' }
];

function buildSectorSubMenu(activeSlug) {
  const items = SECTOR_LINKS.map(({ slug, label, url }) => {
    const activeClass = slug === activeSlug ? ' class="active"' : '';
    return `<li${activeClass}><a href="${url}">${label}</a></li>`;
  }).join('\n');
  return `<nav class="a-sub-menu"><ul>\n${items}\n</ul></nav>`;
}

function buildSectorPageHeader(title, breadcrumbLabel, activeSlug) {
  const subMenu = buildSectorSubMenu(activeSlug);
  const breadcrumb =
    `<p id="breadcrumbs"><span><span><a href="/"><img src="/themes/bluefieldco/images/home.png" alt="Home"/></a></span> &raquo; <span class="breadcrumb_last" aria-current="page">${breadcrumbLabel}</span></span></p>`;

  return `<article class="sector-page scrollReveal">
<section class="a-header section breadcrumb_wrapper sr-top desktop-view">
<div class="a-header-text">
<div class="container">
<h1 class="title big white">${title}</h1>
<div class="breadcrumb">${breadcrumb}</div>
${subMenu}
</div>
</div>
</section>
<section class="a-headerm section breadcrumb_wrapper sr-top mobile-view">
<div class="a-header-text">
<div class="container">
<h1 class="title big white">${title}</h1>
<div class="breadcrumb">${breadcrumb}</div>
</div>
</div>
</section>`;
}

module.exports = { buildSectorPageHeader, SECTOR_LINKS };
