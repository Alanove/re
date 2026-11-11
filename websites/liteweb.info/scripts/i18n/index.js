/**
 * Locale registry for the static site generator.
 * English is the key-tree source of truth; Arabic must define the same paths.
 *
 * Flip SHOW_ARABIC to publish /ar/ pages, the language switcher, and hreflang.
 */
const en = require("./en");
const ar = require("./ar");

const SHOW_ARABIC = true;

const ALL_LOCALES = [
  {
    code: "en",
    lang: "en",
    dir: "ltr",
    ogLocale: "en_US",
    inLanguage: "en",
    hreflang: "en",
    prefix: "",
    assetPrefix: "",
    copy: en,
  },
  {
    code: "ar",
    lang: "ar",
    dir: "rtl",
    ogLocale: "ar_LB",
    inLanguage: "ar",
    hreflang: "ar",
    prefix: "ar",
    assetPrefix: "../",
    copy: ar,
  },
];

const LOCALES = SHOW_ARABIC
  ? ALL_LOCALES
  : ALL_LOCALES.filter((item) => item.code !== "ar");

function collectKeys(value, prefix = "") {
  const keys = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      const path = `${prefix}[${i}]`;
      if (item && typeof item === "object") keys.push(...collectKeys(item, path));
      else keys.push(path);
    });
    return keys;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([k, v]) => {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object") keys.push(...collectKeys(v, path));
      else keys.push(path);
    });
    return keys;
  }
  if (prefix) keys.push(prefix);
  return keys;
}

function assertSameKeys() {
  const enKeys = new Set(collectKeys(en));
  const arKeys = new Set(collectKeys(ar));
  const missing = [...enKeys].filter((k) => !arKeys.has(k));
  const extra = [...arKeys].filter((k) => !enKeys.has(k));
  if (missing.length || extra.length) {
    const lines = ["i18n key mismatch between en.js and ar.js"];
    if (missing.length) lines.push(`missing in ar:\n  ${missing.join("\n  ")}`);
    if (extra.length) lines.push(`extra in ar:\n  ${extra.join("\n  ")}`);
    throw new Error(lines.join("\n"));
  }
}

function switchHref(locale, file) {
  const name = file || "index.html";
  return locale.code === "ar" ? `../${name}` : `ar/${name}`;
}

function absPath(locale, file) {
  const name = !file || file === "index.html" ? "" : file;
  if (locale.prefix) {
    return name ? `/${locale.prefix}/${name}` : `/${locale.prefix}/`;
  }
  return name ? `/${name}` : "/";
}

module.exports = {
  SHOW_ARABIC,
  LOCALES,
  ALL_LOCALES,
  assertSameKeys,
  switchHref,
  absPath,
};
