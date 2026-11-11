const { loadEnv } = require("./load-env");
const { LOCALES, SHOW_ARABIC } = require("./i18n");

loadEnv();

const SITE_URL = (process.env.SITE_URL || "https://www.liteweb.info").replace(/\/$/, "");
const PUBLIC_EMAIL = process.env.PUBLIC_EMAIL || "hello@liteweb.info";
const MAIL_FROM = process.env.MAIL_FROM || PUBLIC_EMAIL;
const PHONE = process.env.PHONE || "+96176653348";
const DEFAULT_IMAGE = "/images/hero-home.jpg";

function publicHttpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
  } catch (_) {
    /* ignore invalid URLs */
  }
  return "";
}

function socialUrls() {
  return {
    facebook: publicHttpUrl(process.env.FACEBOOK),
    x: publicHttpUrl(process.env.X || process.env.TWITTER),
    instagram: publicHttpUrl(process.env.INSTAGRAM || process.env.INSTA),
  };
}

function localeByCode(code) {
  return LOCALES.find((item) => item.code === code) || LOCALES[0];
}

function absUrl(file, locale = LOCALES[0]) {
  const loc = typeof locale === "string" ? localeByCode(locale) : locale;
  const prefix = loc.prefix ? `/${loc.prefix}` : "";
  if (!file || file === "index.html") return `${SITE_URL}${prefix}/`;
  return `${SITE_URL}${prefix}/${String(file).replace(/^\//, "")}`;
}

function absAsset(src) {
  if (!src) return `${SITE_URL}${DEFAULT_IMAGE}`;
  if (/^https?:\/\//i.test(src)) return src;
  return `${SITE_URL}/${String(src).replace(/^\//, "")}`;
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function organizationNode() {
  const node = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "LiteWeb",
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/favicon.ico`,
    email: PUBLIC_EMAIL,
    telephone: PHONE,
  };
  const sameAs = Object.values(socialUrls()).filter(Boolean);
  if (sameAs.length) node.sameAs = sameAs;
  return node;
}

function hreflangLinks(file) {
  if (!SHOW_ARABIC) return "";
  const en = absUrl(file, "en");
  const ar = absUrl(file, "ar");
  return `  <link rel="alternate" hreflang="en" href="${escapeAttr(en)}">
  <link rel="alternate" hreflang="ar" href="${escapeAttr(ar)}">
  <link rel="alternate" hreflang="x-default" href="${escapeAttr(en)}">`;
}

function seoHead({
  file,
  title,
  description,
  image,
  type = "website",
  breadcrumbs = [],
  extraJsonLd = [],
  noindex = false,
  locale = LOCALES[0],
}) {
  const loc = typeof locale === "string" ? localeByCode(locale) : locale;
  const url = absUrl(file, loc);
  const ogImage = absAsset(image);
  const robots = noindex ? "noindex, nofollow" : "index, follow";

  const graph = [
    organizationNode(),
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "LiteWeb",
      url: `${SITE_URL}/`,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: loc.inLanguage,
    },
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: title,
      description,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#organization` },
      inLanguage: loc.inLanguage,
    },
  ];

  if (breadcrumbs.length) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((crumb, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: crumb.name,
        item: absUrl(crumb.file, loc),
      })),
    });
  }

  extraJsonLd.forEach((node) => graph.push(node));

  return `
  <meta name="description" content="${escapeAttr(description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${escapeAttr(url)}">
${hreflangLinks(file)}
  <meta property="og:type" content="${escapeAttr(type)}">
  <meta property="og:site_name" content="LiteWeb">
  <meta property="og:locale" content="${escapeAttr(loc.ogLocale)}">${SHOW_ARABIC ? `
  <meta property="og:locale:alternate" content="${loc.code === "ar" ? "en_US" : "ar_LB"}">` : ""}
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:url" content="${escapeAttr(url)}">
  <meta property="og:image" content="${escapeAttr(ogImage)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(title)}">
  <meta name="twitter:description" content="${escapeAttr(description)}">
  <meta name="twitter:image" content="${escapeAttr(ogImage)}">
  <script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph })}</script>`;
}

function serviceNode({ name, description, file, locale = LOCALES[0] }) {
  return {
    "@type": "Service",
    name,
    description,
    url: absUrl(file, locale),
    provider: { "@id": `${SITE_URL}/#organization` },
  };
}

function faqNode(items) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

module.exports = {
  SITE_URL,
  PUBLIC_EMAIL,
  MAIL_FROM,
  PHONE,
  absUrl,
  seoHead,
  serviceNode,
  faqNode,
  socialUrls,
  publicHttpUrl,
};
