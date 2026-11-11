const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadDump } = require('./lib/wp-dump');
const { renderElementor, rewriteUrls, stripDanger } = require('./lib/elementor-html');

const ROOT = path.resolve(__dirname, '..');
const DUMP = path.resolve(ROOT, '..', 'solutech', 'zazoo_solutec', 'zazoo_solutec.sql');
const REPORT = path.join(ROOT, 'data', 'import-report.json');
const DATA = path.join(ROOT, 'data');

const PAGE_URLS = {
  1470: '/',
  346: '/about-us',
  350: '/contact-us',
  352: '/services',
  1731: '/products',
  2: '/support'
};

function documentTitle(title, home) {
  const name = decodeBasic(title);
  if (home) return 'Solutec – POS SOLUTION PROVIDER';
  if (/–\s*Solutec/.test(name)) return name;
  return `${name} – Solutec`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function decodeBasic(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"');
}

function slugify(value) {
  return decodeBasic(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function keptSet(report) {
  const ids = new Set();
  report.rows.forEach((row) => {
    if (row.verdict === 'keep') ids.add(`${row.type}:${Number(row.id)}`);
  });
  return ids;
}

function attachmentUrl(id, metaByPost) {
  const meta = metaByPost.get(Number(id));
  if (!meta || !meta._wp_attached_file) return '';
  return `/uploads/${String(meta._wp_attached_file).replace(/^\/+/, '')}`;
}

function firstImage(html) {
  const match = String(html || '').match(/src="([^"]+)"/i);
  return match ? match[1] : '';
}

function plain(html) {
  return stripDanger(html).replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function main() {
  if (!fs.existsSync(REPORT)) {
    throw new Error('Scan report missing. Run scripts/scan-solutec.js first.');
  }
  const report = readJson(REPORT);
  const keep = keptSet(report);
  console.log('Loading dump for import...');
  const dump = loadDump(DUMP);
  const postsById = new Map(dump.posts.map((post) => [Number(post.ID), post]));
  const termById = new Map(dump.terms.map((term) => [Number(term.term_id), term]));
  const taxById = new Map(dump.taxonomies.map((tax) => [Number(tax.term_taxonomy_id), tax]));

  const termsFor = (postId, taxonomy) => {
    const found = [];
    dump.relationships.forEach((rel) => {
      if (Number(rel.object_id) !== Number(postId)) return;
      const tax = taxById.get(Number(rel.term_taxonomy_id));
      if (!tax || tax.taxonomy !== taxonomy) return;
      const term = termById.get(Number(tax.term_id));
      if (term) found.push(term);
    });
    return found;
  };

  const unknown = new Set();
  const pages = {};
  const pageOrder = [1470, 346, 350, 352, 1731, 2];
  pageOrder.forEach((id) => {
    if (!keep.has(`page:${id}`)) return;
    const post = postsById.get(id);
    const meta = dump.metaByPost.get(id) || {};
    const rendered = renderElementor(meta._elementor_data || '', id);
    rendered.unknown.forEach((type) => unknown.add(`${id}:${type}`));
    let content = rendered.html;
    if (!content) content = stripDanger(rewriteUrls(post.post_content || ''));
    let seoTitle = documentTitle(post.post_title, id === 1470);
    if (id !== 1470 && meta._yoast_wpseo_title && !/wordpress theme|manufacturer theme/i.test(meta._yoast_wpseo_title)) {
      seoTitle = decodeBasic(meta._yoast_wpseo_title).replace(/\s+[-|]\s+Solutec.*$/i, '') ;
      seoTitle = documentTitle(seoTitle, false);
    }
    const key = slugify(post.post_name || post.post_title) || `page-${id}`;
    const image = attachmentUrl(meta._thumbnail_id, dump.metaByPost) || firstImage(content);
    pages[key] = {
      key,
      title: decodeBasic(post.post_title),
      url: PAGE_URLS[id] || `/${post.post_name}`,
      content,
      status: 'published',
      kind: id === 350 ? 'contact' : id === 1731 ? 'products' : 'page',
      parentKey: id === 1482 ? 'about-us' : '',
      pageImage: image,
      elementorCss: fs.existsSync(path.join(ROOT, 'public', 'theme', 'elementor', 'css', `post-${id}.css`))
        ? `/theme/elementor/css/post-${id}.css`
        : '',
      seo: {
        pageTitle: seoTitle,
        pageDescription: meta._yoast_wpseo_metadesc || meta.rank_math_description || plain(post.post_excerpt || content).slice(0, 180),
        pageKeywords: 'Solutec, POS',
        pageImage: image,
        pageType: 'website'
      }
    };
  });

  const categories = [];
  dump.taxonomies
    .filter((tax) => tax.taxonomy === 'product_cat' && keep.has(`product_cat:${Number(tax.term_id)}`))
    .forEach((tax, index) => {
      const term = termById.get(Number(tax.term_id));
      if (!term) return;
      categories.push({
        key: slugify(term.slug || term.name),
        name: decodeBasic(term.name),
        slug: slugify(term.slug || term.name),
        description: stripDanger(tax.description || ''),
        image: '',
        sort: index + 1
      });
    });

  const products = {};
  dump.posts.forEach((post) => {
    const id = Number(post.ID);
    if (post.post_type !== 'product' || !keep.has(`product:${id}`)) return;
    const meta = dump.metaByPost.get(id) || {};
    const rendered = renderElementor(meta._elementor_data || '', id);
    rendered.unknown.forEach((type) => unknown.add(`product:${type}`));
    const content = rendered.html || stripDanger(rewriteUrls(post.post_content || ''));
    const excerpt = stripDanger(rewriteUrls(post.post_excerpt || ''));
    const key = slugify(post.post_name || post.post_title);
    const image = attachmentUrl(meta._thumbnail_id, dump.metaByPost);
    const gallery = String(meta._product_image_gallery || '')
      .split(',')
      .map((item) => attachmentUrl(item, dump.metaByPost))
      .filter(Boolean);
    const cats = termsFor(id, 'product_cat')
      .map((term) => slugify(term.slug || term.name))
      .filter((slug) => categories.some((cat) => cat.slug === slug));
    products[key] = {
      key,
      title: decodeBasic(post.post_title),
      url: `/product/${key}`,
      sku: meta._sku || '',
      price: meta._price || meta._regular_price || '',
      excerpt,
      content,
      image,
      gallery,
      categories: cats,
      status: 'published',
      seo: {
        pageTitle: documentTitle(post.post_title, false),
        pageDescription: plain(excerpt || content).slice(0, 180),
        pageKeywords: cats.join(', '),
        pageImage: image,
        pageType: 'product'
      }
    };
  });

  const news = {};
  dump.posts.forEach((post) => {
    const id = Number(post.ID);
    if (post.post_type !== 'post' || !keep.has(`post:${id}`)) return;
    const meta = dump.metaByPost.get(id) || {};
    const key = slugify(post.post_name || post.post_title);
    const content = stripDanger(rewriteUrls(post.post_content || ''));
    const image = attachmentUrl(meta._thumbnail_id, dump.metaByPost);
    const category = termsFor(id, 'category').map((term) => slugify(term.slug || term.name))[0] || '';
    news[key] = {
      key,
      title: decodeBasic(post.post_title),
      url: `/${key}`,
      content,
      pageImage: image,
      status: 'published',
      category,
      includeInMenu: false,
      menuSort: 1000,
      lastUpdated: post.post_date,
      seo: {
        pageTitle: documentTitle(post.post_title, false),
        pageDescription: plain(post.post_excerpt || content).slice(0, 180),
        pageKeywords: category,
        pageImage: image,
        pageType: 'article'
      }
    };
  });

  const header = postsById.get(78);
  const footer = postsById.get(103);
  const headerMeta = dump.metaByPost.get(78) || {};
  const footerMeta = dump.metaByPost.get(103) || {};
  const headerRendered = keep.has('elementor-hf:78') ? renderElementor(headerMeta._elementor_data || '', 78) : { html: '', unknown: [] };
  const footerRendered = keep.has('elementor-hf:103') ? renderElementor(footerMeta._elementor_data || '', 103) : { html: '', unknown: [] };
  headerRendered.unknown.forEach((type) => unknown.add(`header:${type}`));
  footerRendered.unknown.forEach((type) => unknown.add(`footer:${type}`));

  const logo = firstImage(headerRendered.html) || '';
  const phones = (headerRendered.html + footerRendered.html + (pages['contact-us'] ? pages['contact-us'].content : '')).match(/\+?\d[\d\s().-]{7,}\d/g) || [];
  const emails = (headerRendered.html + footerRendered.html + (pages['contact-us'] ? pages['contact-us'].content : '')).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const contactEmail = emails.find((email) => /solutec/i.test(email)) || emails[0] || dump.options.admin_email || '';

  const site = {
    name: dump.options.blogname || 'Solutec',
    domain: 'http://localhost:3030',
    description: dump.options.blogdescription || 'POS SOLUTION PROVIDER',
    logo,
    favicon: logo,
    social: {}
  };

  const salt = crypto.randomBytes(16).toString('hex');
  const password = 'SolutecAdmin1';
  const users = {
    users: [
      {
        id: 1,
        name: 'Solutec Admin',
        email: 'admin@solutec.local',
        password: crypto.createHash('sha256').update(password + salt).digest('hex'),
        salt,
        status: 'Active',
        createdAt: new Date().toISOString(),
        notes: 'Local CMS administrator'
      }
    ]
  };

  const menuItems = [
    { id: 'home', title: 'Home', type: 'page', link: 'home' },
    { id: 'about-us', title: 'About Us', type: 'page', link: 'about-us' },
    { id: 'products', title: 'Products', type: 'page', link: 'products' },
    { id: 'services', title: 'Services', type: 'page', link: 'services' },
    { id: 'news', title: 'News', type: 'external', link: '/category/news' },
    { id: 'support', title: 'Support', type: 'page', link: 'support' },
    { id: 'contact-us', title: 'Contact Us', type: 'page', link: 'contact-us' }
  ].filter((item) => item.type === 'external' || pages[item.link]);

  const menus = {
    menus: [
      {
        id: 'main-menu',
        name: 'Main Menu',
        description: 'Primary navigation',
        items: menuItems.map((item, index) => ({
          ...item,
          sort: index + 1,
          active: true,
          children: []
        }))
      },
      {
        id: 'footer-menu',
        name: 'Footer Menu',
        description: 'Footer navigation',
        items: menuItems
          .filter((item) => item.id !== 'products')
          .map((item, index) => ({
            id: `footer-${item.id}`,
            title: item.id === 'about-us' ? 'About us' : item.title,
            type: item.type,
            link: item.link,
            sort: index + 1,
            active: true,
            children: []
          }))
      }
    ]
  };

  const settings = {
    siteTitle: site.name,
    siteDescription: site.description,
    logo: site.logo,
    footerLogo: site.logo,
    favicon: site.favicon,
    siteImage: site.logo,
    siteUrl: site.domain,
    contactEmail,
    contactPhone: phones[0] || '',
    fax: '',
    address: '',
    parkingNote: '',
    locationLabel: 'Lebanon',
    privacyPolicyUrl: '',
    portalCtaCaption: '',
    investiaDisclaimer: '',
    concernEmails: {},
    socialMedia: { facebook: '', twitter: '', instagram: '', linkedin: '' },
    seo: {
      defaultTitle: site.name,
      defaultDescription: site.description,
      defaultKeywords: 'Solutec, POS, barcode, Lebanon'
    },
    downloadLinks: { portfolio: '', brochure: '', catalog: '' },
    successIndicators: {},
    careersEmail: contactEmail
  };

  writeJson(path.join(DATA, 'pages.json'), { site, pages });
  writeJson(path.join(DATA, 'products.json'), { products });
  writeJson(path.join(DATA, 'product-categories.json'), { categories });
  writeJson(path.join(DATA, 'news.json'), { site, news });
  writeJson(path.join(DATA, 'menu.json'), menus);
  writeJson(path.join(DATA, 'site-settings.json'), settings);
  writeJson(path.join(DATA, 'users.json'), users);
  writeJson(path.join(DATA, 'contact-info.json'), []);
  writeJson(path.join(DATA, 'chrome.json'), {
    headerHtml: headerRendered.html,
    footerHtml: footerRendered.html,
    headerCss: '/theme/elementor/css/post-78.css',
    footerCss: '/theme/elementor/css/post-103.css'
  });
  writeJson(path.join(DATA, 'slider.json'), {
    slides: [
      {
        id: 'slide-1',
        image: '/uploads/2023/07/slide-1.jpg',
        alt: 'Solutec',
        order: 1,
        active: true,
        title: '',
        headlineLine1: 'Expert Point of Sale Solution Provider with High-Performance Products',
        subtitle: 'Custom Solutions to Suit Your Need',
        link: '/services',
        buttonText: 'In Details',
        link2: '/contact-us',
        buttonText2: 'Get a Quote'
      }
    ]
  });
  writeJson(path.join(DATA, 'testimonials.json'), { testimonials: {} });
  writeJson(path.join(DATA, 'team.json'), { members: {} });

  console.log(`Pages ${Object.keys(pages).length}, products ${Object.keys(products).length}, categories ${categories.length}, news ${Object.keys(news).length}`);
  console.log('Unknown widgets:', [...unknown].join(', ') || 'none');
  console.log('Admin login: admin@solutec.local / SolutecAdmin1');
  if (header) console.log('Header title', header.post_title);
  if (footer) console.log('Footer title', footer.post_title);
}

main();
