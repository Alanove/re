/**
 * Generates every static HTML page for the LiteWeb site into html/ (en)
 * and, when SHOW_ARABIC is on, html/ar/ (ar). Copy lives in scripts/i18n —
 * edit those files, then run `npm run generate:pages`.
 */
const fs = require("fs");
const path = require("path");
const { page, SHOW_PORTFOLIO } = require("./layout");
const { CATEGORIES, sites, sitesByCategory } = require("./portfolio-data");
const { loadEnv } = require("./load-env");
const { SITE_URL, PUBLIC_EMAIL, PHONE, absUrl, seoHead, serviceNode, faqNode, socialUrls } = require("./seo");
const { LOCALES, SHOW_ARABIC, assertSameKeys } = require("./i18n");

loadEnv();

const OUT_DIR = path.join(__dirname, "..", "html");

function icon(name, extraClass = "") {
  const directional = new Set(["arrow_forward", "arrow_back", "chevron_left", "chevron_right"]);
  const parts = ["material-symbols-outlined"];
  if (extraClass) parts.push(extraClass);
  if (directional.has(name)) parts.push("icon-dir");
  return `<span class="${parts.join(" ")}" aria-hidden="true">${name}</span>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stat(value, label) {
  return `<div class="stat"><div class="stat__value">${value}</div><div class="stat__label">${label}</div></div>`;
}

function checkList(items) {
  return `<ul class="check-list">${items.map((i) => `<li>${icon("check_circle")} ${i}</li>`).join("\n")}</ul>`;
}

function featureCard({ iconName, title, text }) {
  return `<div class="feature-card">
  <div class="feature-card__icon">${icon(iconName)}</div>
  <h3 class="feature-card__title">${title}</h3>
  <p class="card__text">${text}</p>
</div>`;
}

function featureList(items) {
  return `<ul class="feature-list">
          ${items.map((item) => `<li>${icon("check_circle")} ${item}</li>`).join("\n          ")}
        </ul>`;
}

function painList(items) {
  return `<ul class="pain-list">
      ${items.map((item) => `<li>${icon(item.icon)} ${item.text}</li>`).join("\n      ")}
    </ul>`;
}

function audienceTable(col1, col2, rows) {
  return `<div class="table-scroll">
      <table class="audience-table">
        <thead>
          <tr>
            <th scope="col">${col1}</th>
            <th scope="col">${col2}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `<tr>
            <td><strong>${row.role}</strong></td>
            <td>${row.help}</td>
          </tr>`
            )
            .join("\n          ")}
        </tbody>
      </table>
    </div>`;
}

function whySteps(steps) {
  return `<div class="why-steps">
      ${steps
        .map(
          (step, i) => `<div class="why-steps__item">
        <div class="why-steps__num">${i + 1}</div>
        <h3>${step.title}</h3>
        <p>${step.text}</p>
      </div>`
        )
        .join("\n      ")}
    </div>`;
}

function makeBuilders(locale) {
  const t = locale.copy;
  const asset = (src) => `${locale.assetPrefix}${src}`;

  function priceCard({
    tier,
    name,
    intro,
    oneTime,
    monthly,
    price,
    note,
    features,
    featured,
    compact,
    cta,
    moreHref,
  }) {
    const classes = ["price-card"];
    if (featured) classes.push("price-card--featured");
    if (compact) classes.push("price-card--compact");
    const options =
      oneTime && monthly
        ? `<div class="price-card__options">
          <div class="price-option">
            <span class="price-option__label">${t.common.oneTime}</span>
            <div class="price-option__amount">${oneTime}</div>
            <span class="price-option__hint">${t.common.startingFee}</span>
          </div>
          <div class="price-option__divider" aria-hidden="true">${t.common.or}</div>
          <div class="price-option">
            <span class="price-option__label">${t.common.monthly}</span>
            <div class="price-option__amount">${monthly}<span>${t.common.perMonth}</span></div>
            <span class="price-option__hint">${t.common.for12Months}</span>
          </div>
        </div>`
        : `<div class="price-card__price">${price}</div>`;
    const introHtml = intro ? `<p class="price-card__intro">${intro}</p>` : "";
    const moreHtml = moreHref
      ? `<a class="price-card__more" href="${moreHref}">${t.common.seeProduct}</a>`
      : "";
    return `<div class="${classes.join(" ")}">
  <span class="price-card__tier">${tier}</span>
  <h3 class="price-card__name">${name}</h3>
  ${introHtml}
  ${options}
  <p class="price-card__note">${note}</p>
  <ul class="price-card__features">
    ${features.map((f) => `<li>${icon("check")} ${f}</li>`).join("\n    ")}
  </ul>
  <a class="btn btn--primary btn--block" href="start-a-project.html">${cta || t.common.selectPlan}</a>
  ${moreHtml}
</div>`;
  }

  function productTile({ modifier, href, iconName, title, text, cta }) {
    return `<a class="product-tile${modifier ? ` product-tile--${modifier}` : ""}" href="${href}">
  <div>
    <div class="product-tile__icon">${icon(iconName)}</div>
    <h3 class="product-tile__title">${title}</h3>
    <p class="product-tile__text">${text}</p>
  </div>
  <span class="product-tile__link">${cta} ${icon("arrow_forward")}</span>
</a>`;
  }

  function productHero({ eyebrow, titleHtml, lead, img, alt, secondaryCta, secondaryHref }) {
    return `<section class="section">
  <div class="container">
    <div class="product-hero">
      <div>
        <span class="eyebrow">${eyebrow}</span>
        <h1 class="headline-xl mb-md">${titleHtml}</h1>
        <p class="body-lg mb-lg max-w-xl">${lead}</p>
        <div class="btn-group">
          <a class="btn btn--primary btn--lg" href="start-a-project.html">${t.common.startProject}</a>
          <a class="btn btn--secondary btn--lg" href="${secondaryHref || "#"}">${secondaryCta}</a>
        </div>
      </div>
      <div class="product-hero__media"><img src="${asset(`images/${img}`)}" alt="${alt}" fetchpriority="high" decoding="async"></div>
    </div>
  </div>
</section>`;
  }

  function productDetailCta({ title, text, cta }) {
    return `<section class="product-detail-cta">
  <div class="container">
    <h2>${title}</h2>
    <p>${text}</p>
    <a class="btn btn--white btn--lg" href="start-a-project.html">${cta}</a>
  </div>
</section>`;
  }

  function detailedProductBody(p, images) {
    const rowsHtml = p.rows
      .map((row, i) => {
        const reverse = i % 2 === 1 ? " feature-row--reverse" : "";
        const surface = i % 2 === 0 ? " section--surface" : "";
        return `<section class="section${surface}">
  <div class="container">
    <div class="feature-row${reverse}">
      <div>
        <h2 class="headline-lg feature-row__title">${row.title}</h2>
        <p class="body-md feature-row__lead">${row.lead}</p>
        <p class="feature-kicker">${p.whatYouGet}</p>
        ${featureList(row.items)}
        <p class="body-md">${row.close}</p>
      </div>
      <div class="feature-row__media">
        <img src="${asset("images/" + images.rows[i])}" alt="${row.alt}" loading="lazy">
      </div>
    </div>
  </div>
</section>`;
      })
      .join("\n\n");

    return `${productHero({
      eyebrow: p.eyebrow,
      titleHtml: p.heading,
      lead: p.lead,
      img: images.hero,
      alt: p.alt,
      secondaryCta: p.secondaryCta,
      secondaryHref: "start-a-project.html",
    })}

<section class="section section--surface">
  <div class="container">
    <div class="product-band max-w-3xl mx-auto text-center">
      <h2 class="headline-lg mb-md">${p.messTitle}</h2>
      <p class="body-md mb-lg">${p.messLead}</p>
    </div>
    ${painList(p.pains)}
    <div class="max-w-3xl mx-auto text-center mt-xl">
      <p class="body-md mb-lg">${p.messClose}</p>
      <p class="closing-line">${p.betterWay}</p>
    </div>
    <div class="product-band__media">
      <img src="${asset("images/" + images.problem)}" alt="${p.problemAlt}" loading="lazy">
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="text-center mb-xl max-w-3xl mx-auto">
      <h2 class="headline-lg mb-md">${p.meetTitle}</h2>
      <p class="body-md">${p.meetLead}</p>
    </div>
    <div class="feature-bento">
      ${p.features.map((f) => featureCard({ iconName: f.icon, title: f.title, text: f.text })).join("\n      ")}
    </div>
    <p class="body-md text-center mt-xl max-w-2xl mx-auto">${p.meetClose}</p>
    <div class="product-band__media">
      <img src="${asset("images/" + images.dash)}" alt="${p.dashAlt}" loading="lazy">
    </div>
  </div>
</section>

${rowsHtml}

<section class="section section--surface">
  <div class="container">
    <div class="text-center mb-xl max-w-3xl mx-auto">
      <h2 class="headline-lg mb-md">${p.whoTitle}</h2>
      <p class="body-md">${p.whoLead}</p>
    </div>
    <div class="product-band__media mb-xl">
      <img src="${asset("images/" + images.audience)}" alt="${p.audienceAlt}" loading="lazy">
    </div>
    ${audienceTable(p.tableRole, p.tableHelps, p.audience)}
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="max-w-3xl mx-auto text-center">
      <h2 class="headline-lg mb-md">${p.whyTitle}</h2>
      <p class="body-md">${p.whyLead}</p>
      <p class="body-md mt-md">${p.whyMore}</p>
    </div>
    ${whySteps(p.whySteps)}
    <p class="body-md text-center mt-xl">${p.whyClose}</p>
    <div class="product-band__media">
      <img src="${asset("images/" + images.brand)}" alt="${p.brandAlt}" loading="lazy">
    </div>
  </div>
</section>

${productDetailCta({ title: p.ctaTitle, text: p.ctaText, cta: p.cta })}`;
  }

  function ctaBanner({ title, text, cta }) {
    return `<section class="cta-banner">
  <div class="container cta-banner__inner">
    <div>
      <h2 class="headline-lg">${title}</h2>
      <p class="body-md">${text}</p>
    </div>
    <a class="btn btn--white btn--lg" href="start-a-project.html">${cta || t.common.startProject}</a>
  </div>
</section>`;
  }

  function categoryLabel(id) {
    return t.portfolio.categories[id] || id;
  }

  function localizedSite(site) {
    return {
      ...site,
      description: t.portfolio.sites[site.id] || site.description,
    };
  }

  function portfolioCard(site) {
    const item = localizedSite(site);
    const alt = t.common.screenshotAlt.replace("{name}", item.name);
    return `<article class="portfolio-card" data-category="${item.category}">
  <a class="portfolio-card__media" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
    <img src="${asset(`images/portfolio/${item.id}.jpg`)}" alt="${escapeHtml(alt)}" loading="lazy">
  </a>
  <span class="portfolio-card__meta">${escapeHtml(categoryLabel(item.category))}</span>
  <h3 class="portfolio-card__title">${escapeHtml(item.name)}</h3>
  <p class="portfolio-card__text">${escapeHtml(item.description)}</p>
  <a class="portfolio-card__link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${t.common.visitSite} ${icon("open_in_new")}</a>
</article>`;
  }

  function relatedWorkSection(categoryIds, { title, text, limit } = {}) {
    const ids = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
    const matches = sitesByCategory(ids);
    const shown = typeof limit === "number" ? matches.slice(0, limit) : matches;
    const viewHref = ids.length === 1 ? `portfolio.html?category=${ids[0]}` : "portfolio.html";
    return `<section class="section section--surface">
  <div class="container">
    <div class="mb-xl">
      <h2 class="headline-lg mb-sm">${title || t.common.relatedTitle}</h2>
      <p class="body-md">${text || t.common.relatedText}</p>
    </div>
    <div class="portfolio-grid">
      ${shown.map((site) => portfolioCard(site)).join("\n")}
    </div>
    <p class="mt-xl text-center"><a class="btn btn--outline" href="${viewHref}">${t.common.viewAllPortfolio} ${icon("arrow_forward")}</a></p>
  </div>
</section>`;
  }

  const home = t.home;
  const indexBody = `<section class="hero">
  <div class="container hero__grid">
    <div>
      <span class="eyebrow">${home.heroEyebrow}</span>
      <h1 class="hero__title">${home.heroTitle}</h1>
      <p class="hero__lead">${home.heroLead}</p>
      <div class="btn-group">
        <a class="btn btn--primary btn--lg" href="start-a-project.html">${home.startCta}</a>${SHOW_PORTFOLIO ? `
        <a class="btn btn--outline btn--lg" href="portfolio.html">${home.viewPortfolio}</a>` : ""}
      </div>
    </div>
    <div class="hero__media">
      <img src="${asset("images/hero-home.jpg")}" alt="${home.heroAlt}" fetchpriority="high" decoding="async">
    </div>
  </div>
</section>

<section class="section section--white">
  <div class="container">
    <div class="grid-stats">
      ${home.stats.map((s) => stat(s.value, s.label)).join("\n      ")}
    </div>
  </div>
</section>

<section class="section" id="products">
  <div class="container">
    <div class="max-w-2xl mx-auto text-center mb-xl">
      <span class="eyebrow">${home.productsEyebrow}</span>
      <h2 class="headline-xl mb-md">${home.productsTitle}</h2>
      <p class="body-md">${home.productsLead}</p>
    </div>
    <div class="grid-4">
      ${home.productCards
        .map(
          (card) => `<a class="card card--hover" href="${card.href}">
        <div class="card__icon card__icon--soft">${icon(card.icon)}</div>
        <h3 class="card__title">${card.title}</h3>
        <p class="card__text">${card.text}</p>
      </a>`
        )
        .join("\n      ")}
    </div>
    <p class="mt-xl text-center"><a class="btn btn--outline" href="products.html">${home.exploreProducts}</a></p>
  </div>
</section>

<section class="section section--surface">
  <div class="container">
    <div class="grid-2">
      <div>
        <h2 class="headline-xl mb-md">${home.whyTitle}</h2>
        <p class="body-md mb-lg">${home.whyLead}</p>
        ${checkList(home.whyChecks)}
      </div>
      <div class="grid-2">
        <div class="card">
          <h4 class="card__title">${home.whoTitle}</h4>
          <p class="card__text">${home.whoText}</p>
        </div>
        <div class="card">
          <h4 class="card__title">${home.howTitle}</h4>
          <p class="card__text">${home.howText}</p>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="mb-xl">
      <h2 class="headline-xl mb-sm">${home.processTitle}</h2>
      <p class="body-md">${home.processLead}</p>
    </div>
    <div class="grid-4">
      ${home.processSteps
        .map(
          (s) => `<div class="method-step"><div class="method-step__num">${s.num}</div><h5 class="card__title">${s.title}</h5><p class="card__text">${s.text}</p></div>`
        )
        .join("\n      ")}
    </div>
  </div>
</section>

${SHOW_PORTFOLIO ? `<section class="section section--surface" id="portfolio">
  <div class="container">
    <div class="mb-xl">
      <h2 class="headline-xl mb-sm">${home.selectedTitle}</h2>
      <p class="body-md">${home.selectedLead}</p>
    </div>
    <div class="grid-2">
      <a class="case-study" href="portfolio.html?category=e-commerce">
        <div class="case-study__media"><img src="${asset("images/portfolio/antonios-couture.jpg")}" alt="${home.caseAntoniosAlt}" loading="lazy"></div>
        <span class="case-study__tag">${home.caseAntoniosTag}</span>
        <h3 class="case-study__title">Antonios Couture</h3>
        <p class="card__text">${home.caseAntoniosText}</p>
      </a>
      <a class="case-study" href="portfolio.html?category=cms">
        <div class="case-study__media"><img src="${asset("images/portfolio/gwip.jpg")}" alt="${home.caseGwipAlt}" loading="lazy"></div>
        <span class="case-study__tag">${home.caseGwipTag}</span>
        <h3 class="case-study__title">GWIP</h3>
        <p class="card__text">${home.caseGwipText}</p>
      </a>
    </div>
    <p class="mt-xl text-center"><a class="btn btn--outline" href="portfolio.html">${home.viewAllProjects} ${icon("arrow_forward")}</a></p>
  </div>
</section>` : ""}

<section class="section section--surface">
  <div class="container max-w-3xl mx-auto">
    <h2 class="headline-xl text-center mb-xl">${home.faqTitle}</h2>
    <div class="faq">
      ${home.faqs
        .map(
          (faq, i) => `<details${i === 0 ? " open" : ""}>
        <summary>${faq.q} ${icon("expand_more")}</summary>
        <div class="faq__body">${faq.a}</div>
      </details>`
        )
        .join("\n      ")}
    </div>
  </div>
</section>

<section class="home-cta">
  <div class="container">
    <h2 class="headline-xl mb-md">${home.ctaTitle}</h2>
    <p class="body-lg mb-lg max-w-2xl mx-auto">${home.ctaLead}</p>
    <div class="btn-group btn-group--center">
      <a class="btn btn--primary btn--lg" href="start-a-project.html">${home.ctaConsult}</a>
      <a class="btn btn--white btn--lg" href="start-a-project.html">${home.ctaQuote}</a>
    </div>
  </div>
</section>`;

  const sv = t.services;
  const servicesBody = `<section class="section services-hero">
  <div class="container">
    <span class="eyebrow">${sv.eyebrow}</span>
    <h1 class="headline-xl mb-md">${sv.heading}</h1>
    <p class="body-lg max-w-2xl mx-auto">${sv.lead}</p>
  </div>
</section>

<section class="section section--tight">
  <div class="container">
    <div class="service-bento">
      <div class="service-bento__item service-bento__item--wide">
        <div class="card__icon card__icon--soft">${icon("web")}</div>
        <h3 class="card__title">${sv.websitesTitle}</h3>
        <p class="card__text mb-lg">${sv.websitesText}</p>
        <div class="grid-3">
          ${sv.websitesItems
            .map((item) => `<div><span class="label-md text-primary">${item.label}</span><p class="body-sm">${item.text}</p></div>`)
            .join("\n          ")}
        </div>
      </div>
      <a class="service-bento__item service-bento__item--narrow service-bento__item--dark" href="product-ai-agents.html">
        <div class="card__icon card__icon--green">${icon("smart_toy")}</div>
        <h3 class="card__title">${sv.aiTitle}</h3>
        <p class="card__text mb-lg">${sv.aiText}</p>
        ${checkList(sv.aiChecks)}
      </a>
      <div class="service-bento__item service-bento__item--narrow">
        <div class="card__icon card__icon--soft">${icon("terminal")}</div>
        <h3 class="card__title">${sv.customTitle}</h3>
        <p class="card__text">${sv.customText}</p>
      </div>
      <div class="service-bento__item service-bento__item--wide">
        <div class="card__icon card__icon--soft">${icon("shopping_bag")}</div>
        <h3 class="card__title">${sv.ecomTitle}</h3>
        <p class="card__text">${sv.ecomText}</p>
      </div>
    </div>
  </div>
</section>

<section class="section section--surface">
  <div class="container text-center">
    <h2 class="headline-xl mb-md">${sv.stackTitle}</h2>
    <p class="body-md max-w-2xl mx-auto mb-xl">${sv.stackLead}</p>
    <div class="tech-pills">
      <div class="tech-pills__item">Node.js</div>
      <div class="tech-pills__item">React</div>
      <div class="tech-pills__item">.NET</div>
      <div class="tech-pills__item">PostgreSQL</div>
      <div class="tech-pills__item">TypeScript</div>
      <div class="tech-pills__item">Kubernetes</div>
    </div>
  </div>
</section>

${ctaBanner({ title: sv.ctaTitle, text: sv.ctaText, cta: t.common.startProject })}`;

  const hw = t.howWeWork;
  const howWeWorkBody = `<section class="section">
  <div class="container hero__grid">
    <div>
      <span class="eyebrow">${hw.eyebrow}</span>
      <h1 class="hero__title">${hw.heading}</h1>
      <p class="hero__lead">${hw.lead}</p>
    </div>
    <div class="hero__media">
      <img src="${asset("images/process-hero.jpg")}" alt="${hw.heroAlt}" fetchpriority="high" decoding="async">
    </div>
  </div>
</section>

<section class="section section--surface">
  <div class="container">
    <div class="text-center mb-xl">
      <h2 class="headline-lg mb-sm">${hw.stagesTitle}</h2>
      <p class="body-md max-w-xl mx-auto">${hw.stagesLead}</p>
    </div>
    <div class="grid-3">
      ${hw.steps
        .map(
          (s) => `<div class="card process-step">
        <div class="process-step__head">
          <div class="card__icon">${icon(s.icon, "is-filled")}</div>
          <span class="process-step__num">${s.num}</span>
        </div>
        <h3 class="card__title">${s.title}</h3>
        <p class="card__text mb-md">${s.text}</p>
        ${checkList(s.items)}
      </div>`
        )
        .join("\n")}
    </div>
  </div>
</section>

${ctaBanner({ title: hw.ctaTitle, text: hw.ctaText, cta: t.common.startProject })}`;

  const pf = t.portfolioPage;
  const portfolioBody = `<section class="section">
  <div class="container">
    <div class="max-w-3xl">
      <span class="eyebrow eyebrow--green">${pf.eyebrow}</span>
      <h1 class="headline-xl mb-md">${pf.heading}</h1>
      <p class="body-lg max-w-2xl">${pf.lead}</p>
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="container">
    <div class="btn-group mb-xl" data-portfolio-filters>
      <button class="filter-chip is-active" type="button" data-category="">${t.portfolio.all}</button>
      ${CATEGORIES.map((cat) => `<button class="filter-chip" type="button" data-category="${cat.id}">${escapeHtml(categoryLabel(cat.id))}</button>`).join("\n      ")}
    </div>
    <div class="portfolio-grid" data-portfolio-grid>
      ${sites.map((site) => portfolioCard(site)).join("\n")}
    </div>
    <p class="portfolio-empty body-md text-center" data-portfolio-empty hidden>${t.portfolio.empty}</p>
  </div>
</section>

${ctaBanner({ title: pf.ctaTitle, text: pf.ctaText, cta: t.common.startProject })}`;

  const pr = t.pricing;
  const pricingBody = `<section class="section text-center">
  <div class="container">
    <h1 class="headline-xl mb-md">${pr.heading}</h1>
    <p class="body-lg max-w-2xl mx-auto">${pr.lead}</p>
  </div>
</section>

<section class="section section--tight">
  <div class="container">
    <div class="pricing-grid pricing-grid--featured">
      ${priceCard({
        featured: true,
        tier: pr.websiteTier,
        name: t.nav.companyWebsite,
        intro: pr.websiteIntro,
        oneTime: "$500",
        monthly: "$50",
        note: pr.websiteNote,
        features: pr.websiteFeatures,
        cta: pr.websiteCta,
        moreHref: "product-company-website.html",
      })}
      ${priceCard({
        tier: pr.ecomTier,
        name: t.nav.ecommerce,
        intro: pr.ecomIntro,
        oneTime: "$1,500",
        monthly: "$150",
        note: pr.ecomNote,
        features: pr.ecomFeatures,
        cta: pr.ecomCta,
        moreHref: "product-e-commerce.html",
      })}
    </div>
  </div>
</section>

<section class="section section--surface">
  <div class="container">
    <div class="text-center mb-xl">
      <h2 class="headline-lg mb-md">${pr.customTitle}</h2>
      <p class="body-md max-w-2xl mx-auto">${pr.customLead}</p>
    </div>
    <div class="pricing-grid pricing-grid--custom">
      ${priceCard({ compact: true, tier: pr.listingsTier, name: t.nav.marketplace, price: t.common.customQuote, note: pr.listingsNote, features: [pr.listingsFeature], cta: pr.requestQuote, moreHref: "product-listings-platform.html" })}
      ${priceCard({ compact: true, tier: pr.erpTier, name: t.nav.erp, price: t.common.customQuote, note: pr.discoveryNote, features: [pr.erpFeature], cta: pr.requestQuote, moreHref: "product-erp.html" })}
      ${priceCard({ compact: true, tier: pr.accountingTier, name: t.nav.accounting, price: t.common.customQuote, note: pr.discoveryNote, features: [pr.accountingFeature], cta: pr.requestQuote, moreHref: "product-accounting.html" })}
      ${priceCard({ compact: true, tier: pr.compoundTier, name: t.nav.compound, price: t.common.customQuote, note: pr.discoveryNote, features: [pr.compoundFeature], cta: pr.requestQuote, moreHref: "product-compound-manager.html" })}
      ${priceCard({ compact: true, tier: pr.hospitalTier, name: t.nav.hospital, price: t.common.customQuote, note: pr.discoveryNote, features: [pr.hospitalFeature], cta: pr.requestQuote, moreHref: "product-hospital-management.html" })}
      ${priceCard({ compact: true, tier: pr.mobileTier, name: t.nav.mobileApps, price: t.common.customQuote, note: pr.discoveryNote, features: [pr.mobileFeature], cta: pr.requestQuote, moreHref: "product-mobile-apps.html" })}
      ${priceCard({ compact: true, tier: pr.localAiTier, name: t.nav.localAi, price: t.common.customQuote, note: pr.discoveryNote, features: [pr.localAiFeature], cta: pr.requestQuote, moreHref: "product-local-ai.html" })}
      ${priceCard({ compact: true, tier: pr.agentsTier, name: t.nav.aiAgents, price: t.common.customQuote, note: pr.discoveryNote, features: [pr.agentsFeature], cta: pr.requestQuote, moreHref: "product-ai-agents.html" })}
      ${priceCard({ compact: true, tier: pr.customTier, name: t.nav.custom, price: t.common.customQuote, note: pr.discoveryNote, features: [pr.customFeature], cta: pr.consultExperts, moreHref: "product-custom-software.html" })}
    </div>
  </div>
</section>

${ctaBanner({ title: pr.ctaTitle, text: pr.ctaText, cta: pr.cta })}`;

  const ab = t.about;
  const aboutBody = `<section class="about-hero">
  <div class="container about-hero__grid">
    <div>
      <span class="eyebrow">${ab.eyebrow}</span>
      <h1 class="headline-xl mb-lg">${ab.heading}</h1>
      <p class="body-lg max-w-xl mb-xl">${ab.lead}</p>
    </div>
    <div class="about-hero__media">
      <img src="${asset("images/about-hero.jpg")}" alt="${ab.heroAlt}" fetchpriority="high" decoding="async">
      <div class="about-hero__badge">
        <p class="label-md mb-xs">${icon("check_circle")} ${ab.badge}</p>
        <p class="body-sm">${ab.badgeText}</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="text-center mb-xl"><h2 class="headline-lg">${ab.valuesTitle}</h2></div>
    <div class="grid-3">
      <div class="card value-card">
        <div class="card__icon card__icon--soft">${icon("shield")}</div>
        <h3 class="card__title">${ab.reliabilityTitle}</h3>
        <p class="card__text">${ab.reliabilityText}</p>
      </div>
      <div class="card value-card value-card--innovation">
        <div class="card__icon card__icon--green">${icon("lightbulb")}</div>
        <h3 class="card__title">${ab.innovationTitle}</h3>
        <p class="card__text">${ab.innovationText}</p>
      </div>
      <div class="card value-card">
        <div class="card__icon card__icon--soft">${icon("visibility")}</div>
        <h3 class="card__title">${ab.transparencyTitle}</h3>
        <p class="card__text">${ab.transparencyText}</p>
      </div>
    </div>
  </div>
</section>

<section class="about-cta">
  <div class="container">
    <h2 class="headline-lg mb-md">${ab.ctaTitle}</h2>
    <p class="body-lg mb-xl max-w-2xl mx-auto">${ab.ctaLead}</p>
    <div class="btn-group btn-group--center">
      <a class="btn btn--white btn--lg" href="start-a-project.html">${ab.workWithUs}</a>${SHOW_PORTFOLIO ? `
      <a class="btn btn--outline btn--lg" href="portfolio.html">${ab.viewPortfolio}</a>` : ""}
    </div>
  </div>
</section>`;

  const pd = t.products;
  const productsBody = `<section class="section">
  <div class="container">
    <div class="max-w-3xl">
      <span class="eyebrow eyebrow--green">${pd.eyebrow}</span>
      <h1 class="headline-xl mb-md">${pd.heading}</h1>
      <p class="body-lg mb-xl">${pd.lead}</p>
      <div class="btn-group">
        <a class="btn btn--primary btn--lg" href="start-a-project.html">${t.common.startProject}</a>
        <a class="btn btn--outline btn--lg" href="pricing.html">${pd.viewPricing}</a>
      </div>
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="container">
    <div class="products-bento">
      ${pd.tiles
        .map((tile) =>
          productTile({
            modifier: tile.modifier,
            href: tile.href,
            iconName: tile.icon,
            title: tile.title,
            text: tile.text,
            cta: tile.cta,
          })
        )
        .join("\n      ")}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="grid-stats">
      ${pd.stats.map((s) => stat(s.value, s.label)).join("\n      ")}
    </div>
  </div>
</section>`;

  const pw = t.productWebsite;
  const productCompanyWebsiteBody = `${productHero({
    eyebrow: pw.eyebrow,
    titleHtml: pw.heading,
    lead: pw.lead,
    img: "product-website-hero.jpg",
    alt: pw.alt,
    secondaryCta: pw.secondaryCta,
    secondaryHref: "portfolio.html?category=company",
  })}

<section class="section section--surface">
  <div class="container">
    <div class="text-center mb-xl">
      <h2 class="headline-lg mb-md">${pw.whatTitle}</h2>
      <p class="body-md max-w-2xl mx-auto">${pw.whatLead}</p>
    </div>
    <div class="feature-bento">
      ${pw.features.map((f) => featureCard({ iconName: f.icon, title: f.title, text: f.text })).join("\n      ")}
    </div>
  </div>
</section>

${relatedWorkSection(["company"], { title: pw.relatedTitle, text: pw.relatedText })}

${productDetailCta({ title: pw.ctaTitle, text: pw.ctaText, cta: pw.cta })}`;

  const pe = t.productEcommerce;
  const productECommerceBody = `${productHero({
    eyebrow: pe.eyebrow,
    titleHtml: pe.heading,
    lead: pe.lead,
    img: "product-ecommerce-hero.jpg",
    alt: pe.alt,
    secondaryCta: pe.secondaryCta,
    secondaryHref: "portfolio.html?category=e-commerce",
  })}

<section class="section section--surface">
  <div class="container">
    <div class="text-center mb-xl">
      <h2 class="headline-lg mb-md">${pe.whatTitle}</h2>
      <p class="body-md max-w-2xl mx-auto">${pe.whatLead}</p>
    </div>
    <div class="feature-bento">
      ${pe.features.map((f) => featureCard({ iconName: f.icon, title: f.title, text: f.text })).join("\n      ")}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="product-hero">
      <div class="product-hero__media"><img src="${asset("images/product-ecommerce-api.jpg")}" alt="${pe.growAlt}" loading="lazy"></div>
      <div>
        <h2 class="headline-lg mb-lg">${pe.growTitle}</h2>
        <ul class="check-list">
          ${pe.growItems.map((item) => `<li>${icon("check_circle")} <strong>${item.strong}</strong> &mdash; ${item.text}</li>`).join("\n          ")}
        </ul>
      </div>
    </div>
  </div>
</section>

${relatedWorkSection(["e-commerce"], { title: pe.relatedTitle, text: pe.relatedText })}

${productDetailCta({ title: pe.ctaTitle, text: pe.ctaText, cta: pe.cta })}`;

  const pl = t.productListings;
  const productListingsBody = `${productHero({
    eyebrow: pl.eyebrow,
    titleHtml: pl.heading,
    lead: pl.lead,
    img: "product-listings-hero.jpg",
    alt: pl.alt,
    secondaryCta: pl.secondaryCta,
    secondaryHref: "start-a-project.html",
  })}

<section class="section section--surface">
  <div class="container">
    <div class="grid-stats">
      ${pl.stats.map((s) => stat(s.value, s.label)).join("\n      ")}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="product-band max-w-3xl mx-auto text-center">
      <h2 class="headline-lg mb-md">${pl.familiarTitle}</h2>
      <p class="body-md mb-lg">${pl.familiarLead}</p>
    </div>
    ${painList(pl.pains)}
    <div class="max-w-3xl mx-auto text-center mt-xl">
      <p class="body-md mb-lg">${pl.familiarClose}</p>
      <p class="closing-line">${pl.betterWay}</p>
    </div>
  </div>
</section>

<section class="section section--surface">
  <div class="container">
    <div class="text-center mb-xl max-w-3xl mx-auto">
      <h2 class="headline-lg mb-md">${pl.engineTitle}</h2>
      <p class="body-md">${pl.engineLead}</p>
      <p class="body-md mt-md">${pl.engineMore}</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="feature-row">
      <div>
        <h2 class="headline-lg feature-row__title">${pl.reTitle}</h2>
        <p class="body-md feature-row__lead">${pl.reLead}</p>
        <p class="feature-kicker">${pl.whatYouGet}</p>
        ${featureList(pl.reItems)}
        <p class="body-md">${pl.reClose}</p>
      </div>
      <div class="feature-row__media">
        <img src="${asset("images/product-listings-house.jpg")}" alt="${pl.reAlt}" loading="lazy">
      </div>
    </div>
  </div>
</section>

<section class="section section--surface">
  <div class="container">
    <div class="feature-row feature-row--reverse">
      <div>
        <h2 class="headline-lg feature-row__title">${pl.autoTitle}</h2>
        <p class="body-md feature-row__lead">${pl.autoLead}</p>
        <p class="feature-kicker">${pl.whatYouGet}</p>
        ${featureList(pl.autoItems)}
        <p class="body-md">${pl.autoClose}</p>
      </div>
      <div class="feature-row__media">
        <img src="${asset("images/product-listings-car.jpg")}" alt="${pl.autoAlt}" loading="lazy">
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="text-center mb-xl">
      <h2 class="headline-lg mb-md">${pl.sharedTitle}</h2>
      <p class="body-md max-w-2xl mx-auto">${pl.sharedLead}</p>
    </div>
    <div class="feature-bento">
      ${pl.sharedFeatures.map((f) => featureCard({ iconName: f.icon, title: f.title, text: f.text })).join("\n      ")}
    </div>
    <div class="feature-row mt-xl">
      <div>
        <h2 class="headline-lg feature-row__title">${pl.mapsTitle}</h2>
        <p class="body-md feature-row__lead">${pl.mapsLead}</p>
        <p class="feature-kicker">${pl.whatYouGet}</p>
        ${featureList(pl.mapsItems)}
      </div>
      <div class="feature-row__media">
        <img src="${asset("images/product-listings-map.jpg")}" alt="${pl.mapsAlt}" loading="lazy">
      </div>
    </div>
  </div>
</section>

<section class="section section--surface">
  <div class="container">
    <div class="text-center mb-xl max-w-3xl mx-auto">
      <h2 class="headline-lg mb-md">${pl.cardsTitle}</h2>
      <p class="body-md">${pl.cardsLead}</p>
    </div>
    <div class="grid-2">
      <div class="portfolio-card">
        <div class="portfolio-card__media"><img src="${asset("images/product-listings-house.jpg")}" alt="${pl.reAlt}" loading="lazy"></div>
        <span class="portfolio-card__meta">${pl.houseMeta}</span>
        <h3 class="portfolio-card__title">${pl.houseTitle}</h3>
        <p class="card__text">${pl.houseText}</p>
      </div>
      <div class="portfolio-card">
        <div class="portfolio-card__media"><img src="${asset("images/product-listings-car.jpg")}" alt="${pl.autoAlt}" loading="lazy"></div>
        <span class="portfolio-card__meta">${pl.carMeta}</span>
        <h3 class="portfolio-card__title">${pl.carTitle}</h3>
        <p class="card__text">${pl.carText}</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="text-center mb-xl max-w-3xl mx-auto">
      <h2 class="headline-lg mb-md">${pl.whoTitle}</h2>
      <p class="body-md">${pl.whoLead}</p>
    </div>
    ${audienceTable(pl.tableBusiness, pl.tableHelps, pl.audience)}
  </div>
</section>

<section class="section section--surface" id="how-it-works">
  <div class="container">
    <div class="max-w-3xl mx-auto text-center">
      <h2 class="headline-lg mb-md">${pl.buildTitle}</h2>
      <p class="body-md">${pl.buildLead}</p>
    </div>
    ${whySteps(pl.buildSteps)}
  </div>
</section>

${productDetailCta({ title: pl.ctaTitle, text: pl.ctaText, cta: pl.cta })}`;

  const erp = t.productErp;
  const productErpBody = `${productHero({
    eyebrow: erp.eyebrow,
    titleHtml: erp.heading,
    lead: erp.lead,
    img: "product-erp-hero.jpg",
    alt: erp.alt,
    secondaryCta: erp.secondaryCta,
    secondaryHref: "start-a-project.html",
  })}

<section class="section section--surface">
  <div class="container">
    <div class="grid-stats">
      ${erp.stats.map((s) => stat(s.value, s.label)).join("\n      ")}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="text-center mb-xl">
      <h2 class="headline-lg mb-md">${erp.modulesTitle}</h2>
      <p class="body-md max-w-2xl mx-auto">${erp.modulesLead}</p>
    </div>
    <div class="feature-bento">
      ${erp.features.map((f) => featureCard({ iconName: f.icon, title: f.title, text: f.text })).join("\n      ")}
    </div>
  </div>
</section>

<section class="section section--surface">
  <div class="container">
    <div class="product-hero">
      <div>
        <h2 class="headline-lg mb-lg">${erp.connectTitle}</h2>
        <ul class="check-list">
          ${erp.connectItems.map((item) => `<li>${icon(item.icon)} <strong>${item.strong}</strong> &mdash; ${item.text}</li>`).join("\n          ")}
        </ul>
      </div>
      <div class="product-hero__media"><img src="${asset("images/product-erp-team.jpg")}" alt="${erp.teamAlt}" loading="lazy"></div>
    </div>
  </div>
</section>

${productDetailCta({ title: erp.ctaTitle, text: erp.ctaText, cta: erp.cta })}`;

  const ac = t.productAccounting;
  const productAccountingBody = `${productHero({
    eyebrow: ac.eyebrow,
    titleHtml: ac.heading,
    lead: ac.lead,
    img: "product-accounting-hero.jpg",
    alt: ac.alt,
    secondaryCta: ac.secondaryCta,
    secondaryHref: "start-a-project.html",
  })}

<section class="section section--surface">
  <div class="container">
    <div class="text-center mb-xl">
      <h2 class="headline-lg mb-md">${ac.whatTitle}</h2>
      <p class="body-md max-w-2xl mx-auto">${ac.whatLead}</p>
    </div>
    <div class="feature-bento">
      ${ac.features.map((f) => featureCard({ iconName: f.icon, title: f.title, text: f.text })).join("\n      ")}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="grid-stats">
      ${ac.stats.map((s) => stat(s.value, s.label)).join("\n      ")}
    </div>
  </div>
</section>

${productDetailCta({ title: ac.ctaTitle, text: ac.ctaText, cta: ac.cta })}`;

  const cs = t.productCustom;
  const productCustomSoftwareBody = `${productHero({
    eyebrow: cs.eyebrow,
    titleHtml: cs.heading,
    lead: cs.lead,
    img: "product-custom-hero.jpg",
    alt: cs.alt,
    secondaryCta: cs.secondaryCta,
    secondaryHref: "portfolio.html?category=dynamic",
  })}

<section class="section section--surface">
  <div class="container">
    <div class="text-center mb-xl">
      <h2 class="headline-lg mb-md">${cs.howTitle}</h2>
      <p class="body-md max-w-2xl mx-auto">${cs.howLead}</p>
    </div>
    <div class="feature-bento">
      ${cs.features.map((f) => featureCard({ iconName: f.icon, title: f.title, text: f.text })).join("\n      ")}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="product-hero">
      <div>
        <h2 class="headline-lg mb-lg">${cs.keepTitle}</h2>
        <p class="body-md mb-lg">${cs.keepLead}</p>
        ${checkList(cs.keepChecks)}
      </div>
      <div class="product-hero__media"><img src="${asset("images/product-custom-hero.jpg")}" alt="${cs.keepAlt}" loading="lazy"></div>
    </div>
  </div>
</section>

${relatedWorkSection(["dynamic", "cms"], { title: cs.relatedTitle, text: cs.relatedText, limit: 3 })}

${productDetailCta({ title: cs.ctaTitle, text: cs.ctaText, cta: cs.cta })}`;

  const ag = t.productAgents;
  const productAiAgentsBody = `${productHero({
    eyebrow: ag.eyebrow,
    titleHtml: ag.heading,
    lead: ag.lead,
    img: "product-agents-hero.jpg",
    alt: ag.alt,
    secondaryCta: ag.secondaryCta,
    secondaryHref: "start-a-project.html",
  })}

<section class="section section--surface">
  <div class="container">
    <div class="product-band max-w-3xl mx-auto text-center">
      <h2 class="headline-lg mb-md">${ag.familiarTitle}</h2>
      <p class="body-md mb-lg">${ag.familiarLead}</p>
    </div>
    ${painList(ag.pains)}
    <div class="max-w-3xl mx-auto text-center mt-xl">
      <p class="body-md mb-lg">${ag.familiarClose}</p>
      <p class="closing-line">${ag.betterWay}</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="text-center mb-xl max-w-3xl mx-auto">
      <h2 class="headline-lg mb-md">${ag.whatTitle}</h2>
      <p class="body-md">${ag.whatLead}</p>
      <p class="body-md mt-md">${ag.whatMore}</p>
    </div>
    <div class="product-band__media">
      <img src="${asset("images/product-agents-team.jpg")}" alt="${ag.teamAlt}" loading="lazy">
    </div>
  </div>
</section>

<section class="section section--surface">
  <div class="container">
    <div class="feature-row">
      <div>
        <h2 class="headline-lg feature-row__title">${ag.phoneTitle}</h2>
        <p class="body-md feature-row__lead">${ag.phoneLead}</p>
        <p class="feature-kicker">${ag.callerHears}</p>
        ${featureList(ag.phoneItems)}
        <p class="body-md">${ag.phoneClose}</p>
      </div>
      <div class="feature-row__media">
        <img src="${asset("images/product-agents-calls.jpg")}" alt="${ag.phoneAlt}" loading="lazy">
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="text-center mb-xl max-w-3xl mx-auto">
      <h2 class="headline-lg mb-md">${ag.otherTitle}</h2>
      <p class="body-md">${ag.otherLead}</p>
    </div>
    <div class="feature-bento feature-bento--3">
      ${ag.otherFeatures.map((f) => featureCard({ iconName: f.icon, title: f.title, text: f.text })).join("\n      ")}
    </div>
    <div class="feature-row feature-row--reverse mt-xl">
      <div>
        <h2 class="headline-lg feature-row__title">${ag.waTitle}</h2>
        <p class="body-md feature-row__lead">${ag.waLead}</p>
        <p class="feature-kicker">${ag.whatYouGet}</p>
        ${featureList(ag.waItems)}
      </div>
      <div class="feature-row__media">
        <img src="${asset("images/product-agents-whatsapp.jpg")}" alt="${ag.waAlt}" loading="lazy">
      </div>
    </div>
  </div>
</section>

<section class="section section--surface">
  <div class="container">
    <div class="feature-row">
      <div>
        <h2 class="headline-lg feature-row__title">${ag.bookTitle}</h2>
        <p class="body-md feature-row__lead">${ag.bookLead}</p>
        <p class="feature-kicker">${ag.whatYouGet}</p>
        ${featureList(ag.bookItems)}
      </div>
      <div class="feature-row__media">
        <img src="${asset("images/product-agents-booking.jpg")}" alt="${ag.bookAlt}" loading="lazy">
      </div>
    </div>
  </div>
</section>

<section class="section" id="how-it-works">
  <div class="container">
    <div class="max-w-3xl mx-auto text-center">
      <h2 class="headline-lg mb-md">${ag.howTitle}</h2>
      <p class="body-md">${ag.howLead}</p>
    </div>
    ${whySteps(ag.howSteps)}
  </div>
</section>

<section class="section section--surface">
  <div class="container">
    <div class="text-center mb-xl max-w-3xl mx-auto">
      <h2 class="headline-lg mb-md">${ag.whoTitle}</h2>
      <p class="body-md">${ag.whoLead}</p>
    </div>
    ${audienceTable(ag.tableBusiness, ag.tableHelps, ag.audience)}
  </div>
</section>

${productDetailCta({ title: ag.ctaTitle, text: ag.ctaText, cta: ag.cta })}`;

  const cm = t.productCompound;
  const productCompoundManagerBody = `${productHero({
    eyebrow: cm.eyebrow,
    titleHtml: cm.heading,
    lead: cm.lead,
    img: "product-compound-hero.jpg",
    alt: cm.alt,
    secondaryCta: cm.secondaryCta,
    secondaryHref: "portfolio.html?category=compound",
  })}

<section class="section section--surface">
  <div class="container">
    <div class="product-band max-w-3xl mx-auto text-center">
      <h2 class="headline-lg mb-md">${cm.messTitle}</h2>
      <p class="body-md mb-lg">${cm.messLead}</p>
    </div>
    ${painList(cm.pains)}
    <div class="max-w-3xl mx-auto text-center mt-xl">
      <p class="body-md mb-lg">${cm.messClose}</p>
      <p class="closing-line">${cm.betterWay}</p>
    </div>
    <div class="product-band__media">
      <img src="${asset("images/product-compound-problem.jpg")}" alt="${cm.problemAlt}" loading="lazy">
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="text-center mb-xl max-w-3xl mx-auto">
      <h2 class="headline-lg mb-md">${cm.meetTitle}</h2>
      <p class="body-md">${cm.meetLead}</p>
    </div>
    <div class="feature-bento">
      ${cm.features.map((f) => featureCard({ iconName: f.icon, title: f.title, text: f.text })).join("\n      ")}
    </div>
    <p class="body-md text-center mt-xl max-w-2xl mx-auto">${cm.meetClose}</p>
    <div class="product-band__media">
      <img src="${asset("images/product-compound-dashboard.jpg")}" alt="${cm.dashAlt}" loading="lazy">
    </div>
  </div>
</section>

<section class="section section--surface">
  <div class="container">
    <div class="feature-row">
      <div>
        <h2 class="headline-lg feature-row__title">${cm.aptTitle}</h2>
        <p class="body-md feature-row__lead">${cm.aptLead}</p>
        <p class="feature-kicker">${cm.whatYouGet}</p>
        ${featureList(cm.aptItems)}
        <p class="body-md">${cm.aptClose}</p>
      </div>
      <div class="feature-row__media">
        <img src="${asset("images/product-compound-apartments.jpg")}" alt="${cm.aptAlt}" loading="lazy">
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="feature-row feature-row--reverse">
      <div>
        <h2 class="headline-lg feature-row__title">${cm.txTitle}</h2>
        <p class="body-md feature-row__lead">${cm.txLead}</p>
        <p class="feature-kicker">${cm.whatYouGet}</p>
        ${featureList(cm.txItems)}
        <p class="body-md">${cm.txClose}</p>
      </div>
      <div class="feature-row__media">
        <img src="${asset("images/product-compound-transactions.jpg")}" alt="${cm.txAlt}" loading="lazy">
      </div>
    </div>
  </div>
</section>

<section class="section section--surface">
  <div class="container">
    <div class="feature-row">
      <div>
        <h2 class="headline-lg feature-row__title">${cm.walletTitle}</h2>
        <p class="body-md feature-row__lead">${cm.walletLead}</p>
        <p class="feature-kicker">${cm.whatYouGet}</p>
        ${featureList(cm.walletItems)}
        <p class="body-md">${cm.walletClose}</p>
      </div>
      <div class="feature-row__media">
        <img src="${asset("images/product-compound-wallets.jpg")}" alt="${cm.walletAlt}" loading="lazy">
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="feature-row feature-row--reverse">
      <div>
        <h2 class="headline-lg feature-row__title">${cm.gateTitle}</h2>
        <p class="body-md feature-row__lead">${cm.gateLead}</p>
        <p class="feature-kicker">${cm.whatYouGet}</p>
        ${featureList(cm.gateItems)}
        <p class="body-md">${cm.gateClose}</p>
      </div>
      <div class="feature-row__media">
        <img src="${asset("images/product-compound-gate.jpg")}" alt="${cm.gateAlt}" loading="lazy">
      </div>
    </div>
  </div>
</section>

<section class="section section--surface">
  <div class="container">
    <div class="feature-row">
      <div>
        <h2 class="headline-lg feature-row__title">${cm.listTitle}</h2>
        <p class="body-md feature-row__lead">${cm.listLead}</p>
        <p class="feature-kicker">${cm.whatYouGet}</p>
        ${featureList(cm.listItems)}
        <p class="body-md">${cm.listClose}</p>
      </div>
      <div class="feature-row__media">
        <img src="${asset("images/product-compound-listings.jpg")}" alt="${cm.listAlt}" loading="lazy">
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="text-center mb-xl max-w-3xl mx-auto">
      <h2 class="headline-lg mb-md">${cm.whoTitle}</h2>
      <p class="body-md">${cm.whoLead}</p>
    </div>
    <div class="product-band__media mb-xl">
      <img src="${asset("images/product-compound-audience.jpg")}" alt="${cm.audienceAlt}" loading="lazy">
    </div>
    ${audienceTable(cm.tableRole, cm.tableHelps, cm.audience)}
  </div>
</section>

<section class="section section--surface">
  <div class="container">
    <div class="max-w-3xl mx-auto text-center">
      <h2 class="headline-lg mb-md">${cm.whyTitle}</h2>
      <p class="body-md">${cm.whyLead}</p>
      <p class="body-md mt-md">${cm.whyMore}</p>
    </div>
    ${whySteps(cm.whySteps)}
    <p class="body-md text-center mt-xl">${cm.whyClose}</p>
    <div class="product-band__media">
      <img src="${asset("images/product-compound-brand.jpg")}" alt="${cm.brandAlt}" loading="lazy">
    </div>
  </div>
</section>

${relatedWorkSection("compound", { title: cm.relatedTitle, text: cm.relatedText })}

${productDetailCta({ title: cm.ctaTitle, text: cm.ctaText, cta: cm.cta })}`;

  const hs = t.productHospital;
  const productHospitalManagementBody = detailedProductBody(hs, {
    hero: "home-case-health.jpg",
    problem: "product-compound-problem.jpg",
    dash: "product-compound-dashboard.jpg",
    audience: "home-case-health.jpg",
    brand: "product-custom-hero.jpg",
    rows: [
      "product-agents-booking.jpg",
      "product-accounting-invoice.jpg",
      "product-erp-team.jpg",
      "product-agents-team.jpg",
      "product-erp-security.jpg",
    ],
  });

  const mb = t.productMobile;
  const productMobileAppsBody = detailedProductBody(mb, {
    hero: "product-ecommerce-hero.jpg",
    problem: "product-agents-whatsapp.jpg",
    dash: "process-hero.jpg",
    audience: "product-ecommerce-hero.jpg",
    brand: "product-custom-hero.jpg",
    rows: [
      "product-ecommerce-funnel.jpg",
      "product-agents-team.jpg",
      "product-ecommerce-api.jpg",
      "home-architecture.jpg",
    ],
  });

  const la = t.productLocalAi;
  const productLocalAiBody = detailedProductBody(la, {
    hero: "product-agents-hero.jpg",
    problem: "product-erp-security.jpg",
    dash: "product-agents-team.jpg",
    audience: "about-hero.jpg",
    brand: "product-agents-hero.jpg",
    rows: [
      "product-accounting-invoice.jpg",
      "product-erp-security.jpg",
      "home-architecture.jpg",
      "product-custom-hero.jpg",
    ],
  });

  const ct = t.contact;
  const contactBody = `<section class="section">
  <div class="container">
    <div class="page-hero">
      <span class="eyebrow">${ct.eyebrow}</span>
      <h1 class="headline-xl mb-md">${ct.heading}</h1>
      <p class="body-lg max-w-2xl mx-auto">${ct.lead}</p>
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="container">
    <div class="contact-layout">
      <div class="contact-info">
        <div class="contact-info__card">
          <div class="card__icon card__icon--soft">${icon("mail")}</div>
          <h3 class="card__title">${ct.email}</h3>
          <p class="card__text"><a href="mailto:${PUBLIC_EMAIL}" data-config="email">${PUBLIC_EMAIL}</a></p>
        </div>
        <div class="contact-info__card">
          <div class="card__icon card__icon--soft">${icon("call")}</div>
          <h3 class="card__title">${ct.phone}</h3>
          <p class="card__text"><a href="tel:+96176653348" data-config="phone">+961 76 653 348</a></p>
        </div>
        <div class="contact-info__card">
          <div class="card__icon card__icon--soft">${icon("schedule")}</div>
          <h3 class="card__title">${ct.hours}</h3>
          <p class="card__text">${ct.hoursValue}</p>
        </div>
        <div class="contact-info__cta">
          <h3 class="card__title mb-sm">${ct.projectTitle}</h3>
          <p class="card__text mb-md">${ct.projectText}</p>
          <a class="btn btn--primary" href="start-a-project.html">${t.nav.startProject}</a>
        </div>
      </div>
      <div class="contact-panel">
        <form class="form" method="post" action="/api/contact" data-form data-success="${escapeHtml(ct.success)}" data-error="${escapeHtml(ct.error)}" data-error-email="${escapeHtml(ct.errorEmail)}" data-error-captcha="${escapeHtml(ct.errorCaptcha)}">
          <input type="hidden" name="form" value="contact">
          <input type="hidden" name="locale" value="${locale.code}">
          <div class="form__hp" aria-hidden="true">
            <label for="contact-hp">${ct.websiteHp}</label>
            <input id="contact-hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off">
          </div>
          <div class="form__row">
            <div class="form__field">
              <label class="form__label" for="contact-name">${ct.name}</label>
              <input class="form__input" id="contact-name" name="name" type="text" placeholder="${ct.namePh}" autocomplete="name" required>
            </div>
            <div class="form__field">
              <label class="form__label" for="contact-email">${ct.emailLabel}</label>
              <input class="form__input" id="contact-email" name="email" type="email" placeholder="${ct.emailPh}" autocomplete="email" required>
            </div>
          </div>
          <div class="form__field">
            <label class="form__label" for="contact-company">${ct.company} <span class="form__optional">${ct.optional}</span></label>
            <input class="form__input" id="contact-company" name="company" type="text" placeholder="${ct.companyPh}" autocomplete="organization">
          </div>
          <div class="form__field">
            <label class="form__label" for="contact-subject">${ct.subject}</label>
            <input class="form__input" id="contact-subject" name="subject" type="text" placeholder="${ct.subjectPh}" required>
          </div>
          <div class="form__field">
            <label class="form__label" for="contact-message">${ct.message}</label>
            <textarea class="form__textarea" id="contact-message" name="message" rows="5" placeholder="${ct.messagePh}" required></textarea>
          </div>
          <p class="form__status" data-form-status role="status" hidden></p>
          <button class="btn btn--primary btn--block btn--lg form__submit" type="submit">${ct.send}</button>
        </form>
      </div>
    </div>
  </div>
</section>`;

  const pj = t.project;
  const startProjectBody = `<section class="section">
  <div class="container">
    <div class="page-hero">
      <span class="eyebrow">${pj.eyebrow}</span>
      <h1 class="headline-xl mb-md">${pj.heading}</h1>
      <p class="body-lg max-w-2xl mx-auto">${pj.lead}</p>
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="container max-w-3xl mx-auto">
    <div class="contact-panel">
      <form class="form" method="post" action="/api/contact" data-form data-success="${escapeHtml(pj.success)}" data-error="${escapeHtml(pj.error)}" data-error-email="${escapeHtml(pj.errorEmail)}" data-error-captcha="${escapeHtml(pj.errorCaptcha)}">
        <input type="hidden" name="form" value="project">
        <input type="hidden" name="locale" value="${locale.code}">
        <div class="form__hp" aria-hidden="true">
          <label for="project-hp">${pj.websiteHp}</label>
          <input id="project-hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off">
        </div>
        <div class="form__row">
          <div class="form__field">
            <label class="form__label" for="project-name">${pj.name}</label>
            <input class="form__input" id="project-name" name="name" type="text" placeholder="${pj.namePh}" autocomplete="name" required>
          </div>
          <div class="form__field">
            <label class="form__label" for="project-email">${pj.email}</label>
            <input class="form__input" id="project-email" name="email" type="email" placeholder="${pj.emailPh}" autocomplete="email" required>
          </div>
        </div>
        <div class="form__row">
          <div class="form__field">
            <label class="form__label" for="project-company">${pj.company}</label>
            <input class="form__input" id="project-company" name="company" type="text" placeholder="${pj.companyPh}" autocomplete="organization" required>
          </div>
          <div class="form__field">
            <label class="form__label" for="project-phone">${pj.phone} <span class="form__optional">${pj.optional}</span></label>
            <input class="form__input" id="project-phone" name="phone" type="tel" placeholder="${pj.phonePh}" autocomplete="tel">
          </div>
        </div>
        <div class="form__row">
          <div class="form__field">
            <label class="form__label" for="project-type">${pj.type}</label>
            <select class="form__select" id="project-type" name="project_type" required>
              <option value="" disabled selected>${pj.typePlaceholder}</option>
              ${pj.types.map((opt) => `<option value="${opt.value}">${opt.label}</option>`).join("\n              ")}
            </select>
          </div>
          <div class="form__field">
            <label class="form__label" for="project-timeline">${pj.timeline}</label>
            <select class="form__select" id="project-timeline" name="timeline" required>
              <option value="" disabled selected>${pj.timelinePlaceholder}</option>
              ${pj.timelines.map((opt) => `<option value="${opt.value}">${opt.label}</option>`).join("\n              ")}
            </select>
          </div>
        </div>
        <div class="form__field">
          <label class="form__label" for="project-details">${pj.details}</label>
          <textarea class="form__textarea" id="project-details" name="details" rows="5" placeholder="${pj.detailsPh}" required></textarea>
        </div>
        <p class="form__status" data-form-status role="status" hidden></p>
        <button class="btn btn--primary btn--block btn--lg form__submit" type="submit">${pj.submit}</button>
      </form>
    </div>
    <p class="body-sm text-center mt-xl">${pj.preferContact}</p>
  </div>
</section>`;

  const nf = t.notFound;
  const notFoundBody = `<section class="section">
  <div class="container">
    <div class="page-hero">
      <span class="eyebrow">404</span>
      <h1 class="headline-xl mb-md">${nf.heading}</h1>
      <p class="body-lg max-w-2xl mx-auto mb-xl">${nf.lead}</p>
      <div class="btn-group btn-group--center">
        <a class="btn btn--primary btn--lg" href="index.html">${nf.home}</a>
        <a class="btn btn--outline btn--lg" href="products.html">${nf.products}</a>
        <a class="btn btn--outline btn--lg" href="contact.html">${nf.contact}</a>
      </div>
    </div>
  </div>
</section>`;

  const homeCrumbs = [{ name: home.crumb, file: "index.html" }];
  const productCrumbs = (name, file) => [
    ...homeCrumbs,
    { name: pd.crumb, file: "products.html" },
    { name, file },
  ];

  const pages = [
    {
      file: "index.html",
      title: home.title,
      description: home.description,
      active: "home",
      darkFooter: true,
      body: indexBody,
      image: "images/hero-home.jpg",
      breadcrumbs: homeCrumbs,
      extraJsonLd: [faqNode(home.faqs)],
      sitemapPriority: "1.0",
    },
    {
      file: "services.html",
      title: sv.title,
      description: sv.description,
      active: "services",
      body: servicesBody,
      breadcrumbs: [...homeCrumbs, { name: sv.crumb, file: "services.html" }],
      sitemapPriority: "0.8",
    },
    {
      file: "how-we-work.html",
      title: hw.title,
      description: hw.description,
      active: "",
      body: howWeWorkBody,
      image: "images/process-hero.jpg",
      breadcrumbs: [...homeCrumbs, { name: hw.crumb, file: "how-we-work.html" }],
    },
    {
      file: "portfolio.html",
      title: pf.title,
      description: pf.description,
      active: "portfolio",
      body: portfolioBody,
      breadcrumbs: [...homeCrumbs, { name: pf.crumb, file: "portfolio.html" }],
      sitemapPriority: "0.8",
    },
    {
      file: "pricing.html",
      title: pr.title,
      description: pr.description,
      active: "pricing",
      body: pricingBody,
      breadcrumbs: [...homeCrumbs, { name: pr.crumb, file: "pricing.html" }],
      sitemapPriority: "0.8",
    },
    {
      file: "about.html",
      title: ab.title,
      description: ab.description,
      active: "about",
      body: aboutBody,
      image: "images/about-hero.jpg",
      breadcrumbs: [...homeCrumbs, { name: ab.crumb, file: "about.html" }],
    },
    {
      file: "products.html",
      title: pd.title,
      description: pd.description,
      active: "products",
      body: productsBody,
      breadcrumbs: [...homeCrumbs, { name: pd.crumb, file: "products.html" }],
      sitemapPriority: "0.9",
    },
    {
      file: "product-company-website.html",
      title: pw.title,
      description: pw.description,
      active: "products",
      body: productCompanyWebsiteBody,
      image: "images/product-website-hero.jpg",
      breadcrumbs: productCrumbs(pw.crumb, "product-company-website.html"),
      extraJsonLd: [serviceNode({ name: pw.serviceName, description: pw.serviceDescription, file: "product-company-website.html", locale })],
    },
    {
      file: "product-e-commerce.html",
      title: pe.title,
      description: pe.description,
      active: "products",
      body: productECommerceBody,
      image: "images/product-ecommerce-hero.jpg",
      breadcrumbs: productCrumbs(pe.crumb, "product-e-commerce.html"),
      extraJsonLd: [serviceNode({ name: pe.serviceName, description: pe.serviceDescription, file: "product-e-commerce.html", locale })],
    },
    {
      file: "product-listings-platform.html",
      title: pl.title,
      description: pl.description,
      active: "products",
      body: productListingsBody,
      image: "images/product-listings-hero.jpg",
      breadcrumbs: productCrumbs(pl.crumb, "product-listings-platform.html"),
      extraJsonLd: [serviceNode({ name: pl.serviceName, description: pl.serviceDescription, file: "product-listings-platform.html", locale })],
    },
    {
      file: "product-erp.html",
      title: erp.title,
      description: erp.description,
      active: "products",
      body: productErpBody,
      image: "images/product-erp-hero.jpg",
      breadcrumbs: productCrumbs(erp.crumb, "product-erp.html"),
      extraJsonLd: [serviceNode({ name: erp.serviceName, description: erp.serviceDescription, file: "product-erp.html", locale })],
    },
    {
      file: "product-accounting.html",
      title: ac.title,
      description: ac.description,
      active: "products",
      body: productAccountingBody,
      image: "images/product-accounting-hero.jpg",
      breadcrumbs: productCrumbs(ac.crumb, "product-accounting.html"),
      extraJsonLd: [serviceNode({ name: ac.serviceName, description: ac.serviceDescription, file: "product-accounting.html", locale })],
    },
    {
      file: "product-compound-manager.html",
      title: cm.title,
      description: cm.description,
      active: "products",
      body: productCompoundManagerBody,
      image: "images/product-compound-hero.jpg",
      breadcrumbs: productCrumbs(cm.crumb, "product-compound-manager.html"),
      extraJsonLd: [serviceNode({ name: cm.serviceName, description: cm.serviceDescription, file: "product-compound-manager.html", locale })],
      sitemapPriority: "0.8",
    },
    {
      file: "product-hospital-management.html",
      title: hs.title,
      description: hs.description,
      active: "products",
      body: productHospitalManagementBody,
      image: "images/home-case-health.jpg",
      breadcrumbs: productCrumbs(hs.crumb, "product-hospital-management.html"),
      extraJsonLd: [serviceNode({ name: hs.serviceName, description: hs.serviceDescription, file: "product-hospital-management.html", locale })],
    },
    {
      file: "product-mobile-apps.html",
      title: mb.title,
      description: mb.description,
      active: "products",
      body: productMobileAppsBody,
      image: "images/product-ecommerce-hero.jpg",
      breadcrumbs: productCrumbs(mb.crumb, "product-mobile-apps.html"),
      extraJsonLd: [serviceNode({ name: mb.serviceName, description: mb.serviceDescription, file: "product-mobile-apps.html", locale })],
    },
    {
      file: "product-local-ai.html",
      title: la.title,
      description: la.description,
      active: "products",
      body: productLocalAiBody,
      image: "images/product-agents-hero.jpg",
      breadcrumbs: productCrumbs(la.crumb, "product-local-ai.html"),
      extraJsonLd: [serviceNode({ name: la.serviceName, description: la.serviceDescription, file: "product-local-ai.html", locale })],
    },
    {
      file: "product-custom-software.html",
      title: cs.title,
      description: cs.description,
      active: "products",
      body: productCustomSoftwareBody,
      image: "images/product-custom-hero.jpg",
      breadcrumbs: productCrumbs(cs.crumb, "product-custom-software.html"),
      extraJsonLd: [serviceNode({ name: cs.serviceName, description: cs.serviceDescription, file: "product-custom-software.html", locale })],
    },
    {
      file: "product-ai-agents.html",
      title: ag.title,
      description: ag.description,
      active: "products",
      body: productAiAgentsBody,
      image: "images/product-agents-hero.jpg",
      breadcrumbs: productCrumbs(ag.crumb, "product-ai-agents.html"),
      extraJsonLd: [serviceNode({ name: ag.serviceName, description: ag.serviceDescription, file: "product-ai-agents.html", locale })],
    },
    {
      file: "contact.html",
      title: ct.title,
      description: ct.description,
      active: "contact",
      body: contactBody,
      breadcrumbs: [...homeCrumbs, { name: ct.crumb, file: "contact.html" }],
      sitemapPriority: "0.8",
    },
    {
      file: "start-a-project.html",
      title: pj.title,
      description: pj.description,
      active: "",
      body: startProjectBody,
      breadcrumbs: [...homeCrumbs, { name: pj.crumb, file: "start-a-project.html" }],
      sitemapPriority: "0.8",
    },
  ];

  return { pages, notFoundBody };
}

function writeSiteConfig() {
  const jsDir = path.join(OUT_DIR, "js");
  if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir, { recursive: true });
  const email = PUBLIC_EMAIL;
  const phone = process.env.PHONE || PHONE || "+96176653348";
  const whatsapp = process.env.WHATSAPP || phone;
  const recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY || "";
  const social = socialUrls();
  const contents = `window.SITE_CONFIG = {
  email: ${JSON.stringify(email)},
  phone: ${JSON.stringify(phone)},
  whatsapp: ${JSON.stringify(whatsapp)},
  recaptchaSiteKey: ${JSON.stringify(recaptchaSiteKey)},
  facebook: ${JSON.stringify(social.facebook)},
  x: ${JSON.stringify(social.x)},
  instagram: ${JSON.stringify(social.instagram)}
};
`;
  fs.writeFileSync(path.join(jsDir, "site-config.js"), contents, "utf8");
}

function writeRobots() {
  const hideArabic = SHOW_ARABIC ? "" : "Disallow: /ar/\n";
  const contents = `User-agent: *
Allow: /
${hideArabic}
Sitemap: ${SITE_URL}/sitemap.xml
`;
  fs.writeFileSync(path.join(OUT_DIR, "robots.txt"), contents, "utf8");
}

function writeSitemap(publicPages) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = publicPages
    .map((p) => {
      const loc = absUrl(p.file, p.locale);
      const priority = p.sitemapPriority || (p.file.startsWith("product-") ? "0.7" : "0.6");
      const alternates = SHOW_ARABIC
        ? `
    <xhtml:link rel="alternate" hreflang="en" href="${absUrl(p.file, "en")}"/>
    <xhtml:link rel="alternate" hreflang="ar" href="${absUrl(p.file, "ar")}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${absUrl(p.file, "en")}"/>`
        : "";
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>${alternates}
  </url>`;
    })
    .join("\n");
  const xmlnsXhtml = SHOW_ARABIC ? '\n        xmlns:xhtml="http://www.w3.org/1999/xhtml"' : "";
  const contents = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${xmlnsXhtml}>
${urls}
</urlset>
`;
  fs.writeFileSync(path.join(OUT_DIR, "sitemap.xml"), contents, "utf8");
}

assertSameKeys();

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

writeSiteConfig();

const sitemapPages = [];

LOCALES.forEach((locale) => {
  const dest = locale.prefix ? path.join(OUT_DIR, locale.prefix) : OUT_DIR;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const { pages, notFoundBody } = makeBuilders(locale);

  pages.forEach((entry) => {
    const extraHead = seoHead({
      file: entry.file,
      title: entry.title,
      description: entry.description,
      image: entry.image,
      breadcrumbs: entry.breadcrumbs || [],
      extraJsonLd: entry.extraJsonLd || [],
      locale,
    });
    const html = page({
      title: entry.title,
      active: entry.active,
      body: entry.body,
      darkFooter: !!entry.darkFooter,
      extraHead,
      locale,
      file: entry.file,
    });
    const outPath = path.join(dest, entry.file);
    fs.writeFileSync(outPath, html, "utf8");
    console.log(outPath);
    sitemapPages.push({ ...entry, locale });
  });

  const notFoundHtml = page({
    title: locale.copy.notFound.title,
    active: "",
    body: notFoundBody,
    extraHead: seoHead({
      file: "404.html",
      title: locale.copy.notFound.title,
      description: locale.copy.notFound.description,
      noindex: true,
      locale,
    }),
    locale,
    file: "404.html",
  });
  fs.writeFileSync(path.join(dest, "404.html"), notFoundHtml, "utf8");
  console.log(path.join(dest, "404.html"));
});

writeRobots();
writeSitemap(sitemapPages);

["blog.html", "blog-detail.html"].forEach((file) => {
  const stale = path.join(OUT_DIR, file);
  if (fs.existsSync(stale)) {
    fs.unlinkSync(stale);
    console.log("removed", stale);
  }
});

if (!SHOW_ARABIC) {
  const arDir = path.join(OUT_DIR, "ar");
  if (fs.existsSync(arDir)) {
    fs.rmSync(arDir, { recursive: true, force: true });
    console.log("removed", arDir);
  }
}
