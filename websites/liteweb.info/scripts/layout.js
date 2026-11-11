/**
 * Shared HTML chrome for LiteWeb static pages.
 * active: 'home' | 'about' | 'products' | 'services' | 'portfolio' | 'pricing' | 'contact'
 *
 * Flip SHOW_PORTFOLIO to restore Portfolio in nav, footer, and homepage sections.
 * Flip SHOW_ARABIC in scripts/i18n/index.js to publish the Arabic site.
 */
const { SHOW_ARABIC } = require("./i18n");
const { socialUrls, PUBLIC_EMAIL } = require("./seo");

const SHOW_PORTFOLIO = true;

const NAV_PRODUCT_GROUPS = [
  { id: "web", titleKey: "webCommerce" },
  { id: "systems", titleKey: "businessSystems" },
  { id: "apps", titleKey: "appsAi" },
];

const NAV_PRODUCTS = [
  { href: "product-company-website.html", labelKey: "companyWebsite", icon: "web", group: "web" },
  { href: "product-e-commerce.html", labelKey: "ecommerce", icon: "shopping_cart", group: "web" },
  { href: "product-listings-platform.html", labelKey: "marketplace", icon: "apartment", group: "web" },
  { href: "product-erp.html", labelKey: "erp", icon: "account_tree", group: "systems" },
  { href: "product-accounting.html", labelKey: "accounting", icon: "payments", group: "systems" },
  { href: "product-compound-manager.html", labelKey: "compound", icon: "home_work", group: "systems" },
  { href: "product-hospital-management.html", labelKey: "hospital", icon: "local_hospital", group: "systems" },
  { href: "product-mobile-apps.html", labelKey: "mobileApps", icon: "smartphone", group: "apps" },
  { href: "product-local-ai.html", labelKey: "localAi", icon: "psychology", group: "apps" },
  { href: "product-ai-agents.html", labelKey: "aiAgents", icon: "smart_toy", group: "apps" },
  { href: "product-custom-software.html", labelKey: "custom", icon: "settings_suggest", group: "apps" },
];

function labeledProducts(t) {
  return NAV_PRODUCTS.map((item) => ({ ...item, label: t.nav[item.labelKey] }));
}

function productsByGroup(t) {
  return NAV_PRODUCT_GROUPS.map((group) => ({
    id: group.id,
    title: t.nav[group.titleKey],
    products: labeledProducts(t).filter((item) => item.group === group.id),
  }));
}

function megaMenuColumns(t) {
  return productsByGroup(t)
    .map(
      (group) => `        <div class="nav-dropdown__col">
          <p class="nav-dropdown__heading">${group.title}</p>
${group.products
  .map(
    (item) => `          <a class="nav-dropdown__item" href="${item.href}">
            <span class="material-symbols-outlined" aria-hidden="true">${item.icon}</span>
            ${item.label}
          </a>`
  )
  .join("\n")}
        </div>`
    )
    .join("\n");
}

function drawerProductLinks(t) {
  const groups = productsByGroup(t)
    .map(
      (group) => `        <p class="drawer-accordion__heading">${group.title}</p>
${group.products
  .map((item) => `        <a class="drawer-accordion__link" href="${item.href}">${item.label}</a>`)
  .join("\n")}`
    )
    .join("\n");
  return `        <a class="drawer-accordion__link drawer-accordion__link--all" href="products.html">${t.nav.allProducts}</a>
${groups}`;
}

function footerProductLinks(t) {
  const items = labeledProducts(t)
    .map((item) => `        <li><a class="site-footer__link" href="${item.href}">${item.label}</a></li>`)
    .join("\n");
  return `        <li><a class="site-footer__link" href="products.html">${t.nav.allProducts}</a></li>
${items}`;
}

function isActive(active, key) {
  return active === key ? " is-active" : "";
}

function productsActive(active) {
  return active === "products" ? " is-active" : "";
}

function langSwitch(locale, file) {
  if (!SHOW_ARABIC) return "";
  const t = locale.copy;
  const name = file || "index.html";
  const enHref = locale.code === "en" ? name : `../${name}`;
  const arHref = locale.code === "ar" ? name : `ar/${name}`;
  const enCurrent = locale.code === "en" ? ' aria-current="true"' : "";
  const arCurrent = locale.code === "ar" ? ' aria-current="true"' : "";
  return `<nav class="lang-switch" aria-label="${t.langNav}">
      <a class="lang-switch__link${locale.code === "en" ? " is-active" : ""}" href="${enHref}" hreflang="en" lang="en"${enCurrent}>${t.langEn}</a>
      <span class="lang-switch__sep" aria-hidden="true">|</span>
      <a class="lang-switch__link${locale.code === "ar" ? " is-active" : ""}" href="${arHref}" hreflang="ar" lang="ar"${arCurrent}>${t.langAr}</a>
    </nav>`;
}

const SOCIAL_ICONS = {
  facebook:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12.07C22 6.48 17.52 2 12 2S2 6.48 2 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.03H7.9v-2.9h2.54V9.84c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.9h-2.34v7.03C18.34 21.25 22 17.09 22 12.07z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.25-1.69 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.64-.07-4.85s.01-3.58.07-4.85C2.38 3.92 3.92 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95C23.73 2.7 21.31.27 16.95.07 15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zM12 16a4 4 0 110-8 4 4 0 010 8zm6.41-11.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z"/></svg>',
};

function socialNav(locale) {
  const t = locale.copy;
  const urls = socialUrls();
  const items = [
    { key: "facebook", url: urls.facebook, label: t.socialFacebook, icon: SOCIAL_ICONS.facebook },
    { key: "x", url: urls.x, label: t.socialX, icon: SOCIAL_ICONS.x },
    { key: "instagram", url: urls.instagram, label: t.socialInstagram, icon: SOCIAL_ICONS.instagram },
  ].filter((item) => item.url);
  if (!items.length) return "";
  const links = items
    .map(
      (item) =>
        `<a class="site-footer__social-link" data-config="${item.key}" href="${item.url}" target="_blank" rel="noopener noreferrer" aria-label="${item.label}">${item.icon}</a>`
    )
    .join("\n      ");
  return `<nav class="site-footer__social" aria-label="${t.socialNav}">
      ${links}
    </nav>`;
}

function header(active, locale) {
  const t = locale.copy;
  const p = productsActive(active);

  return `<!-- Site Header -->
<header class="site-header">
  <div class="site-header__inner">
    <a class="logo" href="index.html" aria-label="${t.logoHome}">
      <span class="logo__lite">Lite</span><span class="logo__web">Web</span>
    </a>
    <nav class="site-header__nav" aria-label="${t.primaryNav}">
      <a class="site-header__link${isActive(active, "home")}" href="index.html">${t.nav.home}</a>
      <a class="site-header__link${isActive(active, "about")}" href="about.html">${t.nav.about}</a>
      <div class="nav-dropdown nav-dropdown--mega" data-products-dropdown>
        <button class="nav-dropdown__trigger${p}" type="button" data-products-trigger aria-haspopup="true" aria-expanded="false" aria-controls="products-menu">
          ${t.nav.products} <span class="material-symbols-outlined" aria-hidden="true">expand_more</span>
        </button>
        <div class="nav-dropdown__menu" id="products-menu" data-products-menu>
          <div class="nav-dropdown__inner" role="region" aria-label="${t.nav.products}">
${megaMenuColumns(t)}
            <div class="nav-dropdown__footer">
              <a class="btn btn--primary" href="products.html">
                ${t.nav.allProducts}
                <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
              </a>
            </div>
          </div>
        </div>
      </div>
      <a class="site-header__link${isActive(active, "services")}" href="services.html">${t.nav.services}</a>${SHOW_PORTFOLIO ? `
      <a class="site-header__link${isActive(active, "portfolio")}" href="portfolio.html">${t.nav.portfolio}</a>` : ""}
      <a class="site-header__link${isActive(active, "pricing")}" href="pricing.html">${t.nav.pricing}</a>
      <a class="site-header__link${isActive(active, "contact")}" href="contact.html">${t.nav.contact}</a>
    </nav>
    <div class="site-header__actions">
      <a class="btn btn--primary site-header__cta" href="start-a-project.html">${t.nav.startProject}</a>
      <button class="site-header__menu-btn" type="button" data-drawer-open aria-label="${t.openMenu}" aria-expanded="false" aria-controls="mobile-drawer">
        <span class="material-symbols-outlined" aria-hidden="true">menu</span>
      </button>
    </div>
  </div>
</header>

<div class="drawer-overlay" data-drawer-overlay></div>
<aside class="drawer" id="mobile-drawer" data-drawer aria-label="${t.mobileNav}">
  <div class="drawer__header">
    <a class="logo" href="index.html"><span class="logo__lite">Lite</span><span class="logo__web">Web</span></a>
    <div class="drawer__header-actions">
      <button class="drawer__close" type="button" data-drawer-close aria-label="${t.closeMenu}">
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
    </div>
  </div>
  <nav class="drawer__nav">
    <a class="drawer__link${isActive(active, "home")}" href="index.html">${t.nav.home}</a>
    <a class="drawer__link${isActive(active, "about")}" href="about.html">${t.nav.about}</a>
    <div class="drawer-accordion">
      <button class="drawer-accordion__trigger${p}" type="button" data-products-accordion aria-expanded="false">
        ${t.nav.products} <span class="material-symbols-outlined" aria-hidden="true">expand_more</span>
      </button>
      <div class="drawer-accordion__panel" data-products-panel>
${drawerProductLinks(t)}
      </div>
    </div>
    <a class="drawer__link${isActive(active, "services")}" href="services.html">${t.nav.services}</a>${SHOW_PORTFOLIO ? `
    <a class="drawer__link${isActive(active, "portfolio")}" href="portfolio.html">${t.nav.portfolio}</a>` : ""}
    <a class="drawer__link${isActive(active, "pricing")}" href="pricing.html">${t.nav.pricing}</a>
    <a class="drawer__link${isActive(active, "contact")}" href="contact.html">${t.nav.contact}</a>
  </nav>
  <div class="drawer__footer">
    <a class="btn btn--primary btn--block" href="start-a-project.html">${t.nav.startProject}</a>
  </div>
</aside>`;
}

function footer(dark, locale, file) {
  const t = locale.copy;
  const cls = dark ? "site-footer site-footer--dark" : "site-footer";
  return `<footer class="${cls}">
  <div class="site-footer__grid">
    <div class="site-footer__brand">
      <a class="logo" href="index.html"><span class="logo__lite">Lite</span><span class="logo__web">Web</span></a>
      <p class="site-footer__text">${t.footer.blurb1}</p>
      <p class="site-footer__text">${t.footer.blurb2}</p>
      <p class="site-footer__meta"><a href="mailto:${PUBLIC_EMAIL}" data-config="email">${PUBLIC_EMAIL}</a><a href="tel:+96176653348" data-config="phone">+961 76 653 348</a></p>
      ${socialNav(locale)}
    </div>
    <div>
      <h4 class="site-footer__title">${t.footer.products}</h4>
      <ul class="site-footer__list">
${footerProductLinks(t)}
      </ul>
    </div>
    <div>
      <h4 class="site-footer__title">${t.footer.company}</h4>
      <ul class="site-footer__list">
        <li><a class="site-footer__link" href="about.html">${t.nav.about}</a></li>
        <li><a class="site-footer__link" href="services.html">${t.nav.services}</a></li>${SHOW_PORTFOLIO ? `
        <li><a class="site-footer__link" href="portfolio.html">${t.nav.portfolio}</a></li>` : ""}
        <li><a class="site-footer__link" href="pricing.html">${t.nav.pricing}</a></li>
        <li><a class="site-footer__link" href="contact.html">${t.nav.contact}</a></li>
      </ul>
    </div>
  </div>
  <div class="site-footer__bottom">
    <div class="site-footer__bottom-inner">
      ${langSwitch(locale, file)}
      <p class="site-footer__copy">${t.footer.copy}</p>
    </div>
  </div>
</footer>
<a class="whatsapp-fab" data-whatsapp href="https://wa.me/96176653348" target="_blank" rel="noopener noreferrer" aria-label="${t.chatWhatsApp}">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
</a>`;
}

function fontLinks(locale) {
  const arabic =
    locale.code === "ar"
      ? `&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700`
      : "";
  return `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800${arabic}&display=swap" rel="stylesheet">`;
}

function page({ title, active, body, darkFooter = false, extraHead = "", locale, file }) {
  const t = locale.copy;
  const prefix = locale.assetPrefix;
  return `<!DOCTYPE html>
<html lang="${locale.lang}" dir="${locale.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#3498db">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${fontLinks(locale)}
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${prefix}css/main.css">
  <link rel="icon" href="${prefix}favicon.ico" type="image/x-icon">
  <script>document.documentElement.classList.add("js");</script>
  ${extraHead}
</head>
<body>
<a class="skip-link" href="#main">${t.skipToContent}</a>
${header(active, locale)}
<main class="page-main" id="main">
${body}
</main>
${footer(darkFooter, locale, file)}
<script src="${prefix}js/site-config.js"></script>
<script src="${prefix}js/main.js"></script>
</body>
</html>
`;
}

module.exports = { page, header, footer, SHOW_PORTFOLIO };
