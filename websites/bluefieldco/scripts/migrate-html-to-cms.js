/**
 * One-time migration: public/html static export → CMS JSON data
 * Run: node scripts/migrate-html-to-cms.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML_ROOT = path.join(ROOT, 'public', 'html');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(ROOT, 'public', 'uploads');
const PAGES_PUBLIC = path.join(ROOT, 'public', 'pages');

const SKIP_FILES = new Set(['404.html']);
const FLAT_SUSTAINABILITY_REDIRECTS = new Set([
  'waste-management', 'tree-planting', 'eco-friendly-pesticides',
  'supporting-farmers', 'women-empowerment-through-agriculture',
  'partnerships-for-sustainable-progress', 'empowering-youths-though-agriculture',
  'bluefields-partnership-with-ministries-of-agriculture-for-workforce-development'
]);

function walkHtmlFiles(dir, base = '') {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (fs.statSync(full).isDirectory()) {
      results.push(...walkHtmlFiles(full, rel));
    } else if (name === 'index.html' || name.endsWith('.html')) {
      if (name === 'index.html') {
        results.push({ filePath: full, relDir: base || '' });
      }
    }
  }
  return results;
}

function pathToUrl(relDir) {
  if (!relDir) return '/';
  const clean = relDir.replace(/\\/g, '/');
  return '/' + clean;
}

function pathToKey(relDir) {
  if (!relDir) return 'home';
  return relDir.replace(/\\/g, '/').replace(/\//g, '-').replace(/member_company/g, 'member-company');
}

function normalizeAssetPaths(html, depth) {
  let out = html;
  const prefix = depth > 0 ? '../'.repeat(depth) : '';
  // wp-content paths → site root
  out = out.replace(/(?:\.\.\/)*wp-content\/uploads\//g, '/uploads/');
  out = out.replace(/(?:\.\.\/)*wp-content\/themes\/bluefieldco\//g, '/themes/bluefieldco/');
  out = out.replace(/(?:\.\.\/)*wp-includes\//g, '/wp-includes/');
  // Fix index.html links to CMS paths
  out = out.replace(/href="(?:\.\.\/)*([^"#?]+?)\/?index\.html"/gi, (_, p) => {
    const slug = p.replace(/\/+/g, '/').replace(/^\.\.\//, '').replace(/\/$/, '');
    if (!slug || slug === '.') return 'href="/"';
    if (slug.startsWith('#')) return `href="/${slug}"`;
    return `href="/${slug}"`;
  });
  out = out.replace(/href="index\.html"/gi, 'href="/"');
  out = out.replace(/href="\/\.\."/gi, 'href="/"');
  out = out.replace(/href="\/\.\.\/"/gi, 'href="/"');
  out = out.replace(/href="#contact-us[^"]*"/gi, 'href="/#contact-us"');
  out = out.replace(/href="#submit_your_inquiry"/gi, 'href="/#submit_your_inquiry"');
  out = out.replace(/href="#sectors"/gi, 'href="/#sectors"');
  out = out.replace(/href="news-events\/[^"]*"/gi, 'href="/news"');
  out = out.replace(
    /<img([^>]*?)src="\/uploads\/2024\/02\/BLUEFIELD-Favicon\.png"([^>]*?)width="512"([^>]*?)height="512"([^>]*?)\/?>/gi,
    '<img$1src="/themes/bluefieldco/images/BLUEFIELD-Favicon.png"$2width="48"$3height="48"$4 class="contact-hq-icon"$5/>'
  );
  out = out.replace(
    /<img([^>]*?)(?:src="\/uploads\/2024\/02\/BLUEFIELD-Favicon\.png"|src="(?:\.\.\/)*wp-content\/uploads\/2024\/02\/BLUEFIELD-Favicon\.png")([^>]*?)\/?>/gi,
    '<img$1src="/themes/bluefieldco/images/BLUEFIELD-Favicon.png"$2width="48" height="48" class="contact-hq-icon"$3/>'
  );
  // Remove wayback URLs
  out = out.replace(/https:\/\/web\.archive\.org\/[^"']+/g, '#');
  out = out.replace(/static-form-notice[\s\S]*?<\/p>/gi, '');
  out = out.replace(/ disabled/gi, '');
  out = out.replace(/get_permalink\(\$subpage->ID\)/g, '#');
  out = out.replace(/'\s*\.\s*get_permalink[^']*'/g, '"#"');
  return out;
}

function extractMainContent(html) {
  const mainMatch = html.match(/<main[^>]*id="primary"[^>]*>([\s\S]*?)<\/main>/i)
    || html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];
  return '';
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].replace(/\s*\|.*$/, '').trim() : '';
}

function extractMetaDescription(html) {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return m ? m[1] : '';
}

function depthFromRel(relDir) {
  if (!relDir) return 0;
  return relDir.split(/[/\\]/).length;
}

function collectAssetRefs(html) {
  const refs = new Set();
  const re = /(?:src|href)="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].includes('uploads/') || m[1].includes('themes/bluefieldco/images')) {
      refs.add(m[1]);
    }
  }
  return [...refs];
}

function copyAssetIfExists(ref, missing) {
  if (!ref.startsWith('/uploads/') && !ref.startsWith('/themes/')) return ref;
  const srcRel = ref.replace(/^\//, '').replace(/^uploads\//, 'wp-content/uploads/').replace(/^themes\//, 'wp-content/themes/');
  const srcPath = path.join(HTML_ROOT, srcRel);
  const destPath = path.join(ROOT, 'public', ref.replace(/^\//, ''));
  if (fs.existsSync(srcPath)) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    if (!fs.existsSync(destPath)) fs.copyFileSync(srcPath, destPath);
  } else {
    missing.add(ref);
  }
  return ref;
}

function extractSliderFromHome(html) {
  const section = html.match(/<section class="homeslider">([\s\S]*?)<\/section>/i);
  if (!section) return [];
  const slides = [];
  const divRe = /<div>\s*<img[^>]+src="([^"]+)"[^>]*\/?>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  let m;
  let i = 0;
  while ((m = divRe.exec(section[0])) !== null) {
    const img = m[1].replace(/(?:\.\.\/)*wp-content\/uploads\//, '/uploads/');
    const titleHtml = m[2];
    const lines = [...titleHtml.matchAll(/<p>([^<]*)<\/p>/gi)].map(x => x[1].trim());
    slides.push({
      id: `slide-${i + 1}`,
      image: img,
      alt: lines.join(' '),
      order: i + 1,
      active: true,
      headlineLine1: lines[0] || '',
      headlineLine2: lines[1] || ''
    });
    i++;
  }
  return slides;
}

function buildMenus(pages) {
  const item = (id, title, link, sort, children = [], type = 'page') => ({
    id, title, type, link, sort, active: true, children
  });

  return {
    menus: [
      {
        id: 'main-menu',
        name: 'Main Menu',
        description: 'Primary navigation',
        items: [
          item('home', 'Home', 'home', 1),
          item('about-us', 'About Us', 'about-us', 2),
          item('sectors', 'Sectors', '#sectors', 3, [
            item('sector-agriculture', 'Agriculture', 'sector-agriculture', 1),
            item('sector-pest-management', 'Pest Management', 'sector-pest-management', 2),
            item('sector-landscaping', 'Landscaping', 'sector-landscaping', 3),
            item('sector-cleaning-services', 'Cleaning Services', 'sector-cleaning-services', 4)
          ], 'anchor'),
          item('member-companies', 'Member Companies', 'member-companies', 4),
          item('sustainability-env', 'Sustainability', 'sustainability-environmental-sustainability', 5)
        ]
      },
      {
        id: 'utility-menu',
        name: 'Utility Menu',
        description: 'Pre-header links',
        items: [
          item('news-link', 'News & Events', 'news-listing', 1),
          item('contact-link', 'Contact Us', 'contact-us', 2, [], 'anchor')
        ]
      },
      {
        id: 'footer-menu',
        name: 'Footer Menu',
        description: 'Footer navigation columns',
        items: [
          item('f-home', 'Home', 'home', 1),
          item('f-about', 'About Us', 'about-us', 2),
          item('f-members', 'Member Companies', 'member-companies', 3),
          item('f-sustain', 'Sustainability', 'sustainability-environmental-sustainability', 4),
          item('f-news', 'News & Events', 'news-listing', 5),
          item('f-contact', 'Contact Us', 'contact-us', 6, [], 'anchor')
        ]
      }
    ]
  };
}

function main() {
  const entries = walkHtmlFiles(HTML_ROOT);
  const pages = {};
  const news = {};
  const missingAssets = new Set();
  let homeHtml = '';

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  for (const { filePath, relDir } of entries) {
    const baseName = path.basename(filePath);
    if (SKIP_FILES.has(baseName)) continue;
    if (!relDir && baseName !== 'index.html') continue;

    const relPath = relDir.replace(/\\/g, '/');
    const firstSegment = relPath.split('/')[0];

    if (FLAT_SUSTAINABILITY_REDIRECTS.has(firstSegment) && relPath.indexOf('/') === -1) continue;
    if (relPath === 'sector/pest-control-and-management') continue;
    if (relPath.startsWith('news/')) continue; // handled separately
    if (relPath === 'news-events') continue; // use /news

    const raw = fs.readFileSync(filePath, 'utf8');
    const depth = depthFromRel(relDir);
    let content = extractMainContent(raw);
    content = normalizeAssetPaths(content, depth);

    collectAssetRefs(content).forEach(ref => copyAssetIfExists(ref, missingAssets));

    const url = pathToUrl(relPath);
    let key = pathToKey(relPath);
    if (relPath === 'news-events') key = 'news-listing';

    const title = extractTitle(raw) || key.replace(/-/g, ' ');
    const pageImage = (content.match(/src="(\/uploads\/[^"]+)"/) || [])[1] || '';

    if (!relDir) {
      homeHtml = raw;
      // Home: content without slider (slider is separate)
      content = content.replace(/<section class="homeslider">[\s\S]*?<\/section>/i, '');
    }

    pages[key] = {
      key,
      title: relDir ? title : 'BlueField Group',
      url,
      content,
      pageImage: pageImage || '',
      status: 'published',
      includeInMenu: key !== 'home',
      menuSort: 100,
      lastUpdated: new Date().toISOString(),
      seo: {
        pageTitle: title,
        pageDescription: extractMetaDescription(raw) || '',
        pageKeywords: 'BlueField, agriculture, pest management, landscaping, cleaning',
        pageImage: pageImage || '/themes/bluefieldco/images/bluefield_logo.svg',
        pageType: 'website'
      }
    };
  }

  // News articles
  const newsDir = path.join(HTML_ROOT, 'news');
  if (fs.existsSync(newsDir)) {
    for (const slug of fs.readdirSync(newsDir)) {
      const idx = path.join(newsDir, slug, 'index.html');
      if (!fs.existsSync(idx)) continue;
      const raw = fs.readFileSync(idx, 'utf8');
      let content = extractMainContent(raw);
      content = normalizeAssetPaths(content, 2);
      collectAssetRefs(content).forEach(ref => copyAssetIfExists(ref, missingAssets));
      const title = extractTitle(raw) || slug;
      const pageImage = (content.match(/src="(\/uploads\/[^"]+)"/) || [])[1] || '';
      news[slug] = {
        key: slug,
        title,
        url: `/news/${slug}`,
        content,
        pageImage,
        status: 'published',
        lastUpdated: new Date().toISOString(),
        seo: {
          pageTitle: title,
          pageDescription: extractMetaDescription(raw) || '',
          pageKeywords: '',
          pageImage: pageImage || '',
          pageType: 'article'
        }
      };
    }
  }

  // News listing page
  const newsEventsPath = path.join(HTML_ROOT, 'news-events', 'index.html');
  if (fs.existsSync(newsEventsPath)) {
    const raw = fs.readFileSync(newsEventsPath, 'utf8');
    let content = extractMainContent(raw);
    content = normalizeAssetPaths(content, 1);
    pages['news-listing'] = {
      key: 'news-listing',
      title: 'News & Events',
      url: '/news',
      content,
      pageImage: '',
      status: 'published',
      includeInMenu: false,
      menuSort: 50,
      lastUpdated: new Date().toISOString(),
      seo: {
        pageTitle: 'News & Events | BlueField Group',
        pageDescription: extractMetaDescription(raw) || '',
        pageKeywords: '',
        pageImage: '/themes/bluefieldco/images/bluefield_logo.svg',
        pageType: 'website'
      }
    };
  }

  const slides = homeHtml ? extractSliderFromHome(homeHtml) : [];
  slides.forEach(s => copyAssetIfExists(s.image, missingAssets));

  const site = {
    name: 'BlueField Group',
    domain: 'http://localhost:3001',
    description: 'Leading holding company in UAE, Jordan, Lebanon, and Iraq',
    logo: '/themes/bluefieldco/images/bluefield_logo.svg',
    favicon: '/themes/bluefieldco/images/BLUEFIELD-Favicon.png',
    social: {
      facebook: '',
      linkedin: 'https://www.linkedin.com/company/bluefieldgrp/',
      twitter: '',
      instagram: ''
    }
  };

  const pagesData = { site, pages };
  const newsData = { site, news };
  const sliderData = { slides };
  const menuData = buildMenus(pages);

  const contactInfo = [
    { id: '1', country: 'Lebanon', city: 'Beirut', address: 'Zalka Highway, Warde Bldg. 8th floor, Beirut, Lebanon', phone: '+961 1 898 198/199', coordinates: '33.8969865,35.5462693', email: 'beirut.office@bluefieldco.com' },
    { id: '2', country: 'Jordan', city: 'Amman', address: 'South Um Al Sammak, Mamdouh al Sarayra street, Bldg. No. 11', phone: '+962 79 551 1350', coordinates: '31.9454,35.9284', email: '' },
    { id: '3', country: 'Iraq', city: 'Baghdad', address: 'Al Andalus Square, Iraqi Engineers Society Street, Baghdad', phone: '+964 750 539 3333', coordinates: '33.3152,44.3661', email: 'baghdad.office@bluefieldco.com' },
    { id: '4', country: 'UAE', city: 'Sharjah', address: 'P6-ELOB No. 20F-11, Hamriyah Free Zone, Sharjah', phone: '+971 54 3567233', coordinates: '25.3463,55.4209', email: '' }
  ];

  const siteSettings = {
    siteTitle: 'BlueField Group',
    siteDescription: 'Leading holding company providing agricultural products and services across MENA',
    logo: '/themes/bluefieldco/images/bluefield_logo.svg',
    favicon: '/themes/bluefieldco/images/BLUEFIELD-Favicon.png',
    siteImage: '/themes/bluefieldco/images/bluefield_logo.svg',
    siteUrl: 'http://localhost:3001',
    contactEmail: 'beirut.office@bluefieldco.com',
    contactPhone: '+961 1 898 198',
    address: 'Zalka Highway, Beirut, Lebanon',
    socialMedia: {
      facebook: '',
      twitter: '',
      instagram: '',
      linkedin: 'https://www.linkedin.com/company/bluefieldgrp/'
    },
    seo: {
      defaultTitle: 'BlueField Group',
      defaultDescription: 'BlueField Group - Agriculture, Pest Management, Landscaping, Cleaning',
      defaultKeywords: 'BlueField, agriculture, MENA'
    },
    downloadLinks: { portfolio: '', brochure: '', catalog: '' },
    successIndicators: {},
    careersEmail: ''
  };

  fs.writeFileSync(path.join(DATA_DIR, 'pages.json'), JSON.stringify(pagesData, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'news.json'), JSON.stringify(newsData, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'slider.json'), JSON.stringify(sliderData, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'menu.json'), JSON.stringify(menuData, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'contact-info.json'), JSON.stringify(contactInfo, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'site-settings.json'), JSON.stringify(siteSettings, null, 2));

  console.log(`Migrated ${Object.keys(pages).length} pages, ${Object.keys(news).length} news articles, ${slides.length} slides`);
  if (missingAssets.size) {
    console.log('Missing assets (add to public/html/wp-content/uploads):');
    [...missingAssets].slice(0, 30).forEach(a => console.log('  ', a));
    if (missingAssets.size > 30) console.log(`  ... and ${missingAssets.size - 30} more`);
  }
}

main();
