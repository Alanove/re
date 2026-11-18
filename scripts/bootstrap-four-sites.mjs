/**
 * One-shot bootstrap: convert legacy images to WebP and write CMS data JSON
 * for drhelenarahme.com, khalafcanonlaw.com, mekbeirut.com, wadihco.com.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const now = new Date().toISOString();

function requireSharp(siteDir) {
  const req = createRequire(path.join(siteDir, 'package.json'));
  return req('sharp');
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

async function processImage(sharp, inputPath, outPath, { width, height, favicon = false } = {}) {
  ensureDir(path.dirname(outPath));
  let pipeline = sharp(inputPath, { failOn: 'none' }).rotate();
  if (favicon) {
    const buf = await pipeline
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    writeFileSync(outPath, buf.data);
    const thumbPath = outPath.replace(/\.png$/i, '-thumb.png');
    // favicons: also write webp sibling unused; skip thumb png
    return { width: buf.info.width, height: buf.info.height, path: outPath };
  }
  const resized = pipeline.resize(width, height, { fit: 'inside', withoutEnlargement: true });
  const main = await resized.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  writeFileSync(outPath, main.data);
  const thumbPath = outPath.replace(/\.webp$/i, '-thumb.webp');
  const thumb = await sharp(main.data)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer({ resolveWithObject: true });
  writeFileSync(thumbPath, thumb.data);
  return { width: main.info.width, height: main.info.height, path: outPath, thumbPath };
}

async function sampleColors(sharp, imagePath, count = 6) {
  const { data, info } = await sharp(imagePath)
    .resize(80, 80, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // ignore near-white and near-black
    if (r > 245 && g > 245 && b > 245) continue;
    if (r < 12 && g < 12 && b < 12) continue;
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    const prev = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    prev.n += 1;
    prev.r += r;
    prev.g += g;
    prev.b += b;
    buckets.set(key, prev);
  }
  const ranked = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((c) => {
      const r = Math.round(c.r / c.n);
      const g = Math.round(c.g / c.n);
      const b = Math.round(c.b / c.n);
      return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    });
  return ranked;
}

function writeJson(siteDir, name, data) {
  writeFileSync(path.join(siteDir, 'data', name), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function page({
  id,
  key,
  parentId = null,
  slug,
  title,
  header = '',
  summary = '',
  content = '',
  status = 'published',
  kind = 'page',
  sort = 0,
  heroImage = '',
  seo = {}
}) {
  return {
    id,
    key,
    parentId,
    slug,
    title,
    header: header || title,
    summary,
    content,
    status,
    kind,
    sort,
    icon: '',
    heroImage,
    heroVideo: '',
    seo: {
      title: seo.title || '',
      description: seo.description || summary || '',
      keywords: seo.keywords || ''
    },
    createdAt: now,
    updatedAt: now
  };
}

function menu(id, name, items) {
  return {
    id,
    name,
    description: '',
    items: items.map((item, index) => ({
      id: item.id || `${id}-${index + 1}`,
      title: item.title,
      url: item.url,
      pageId: item.pageId ?? null,
      sort: index,
      active: true,
      children: item.children || []
    }))
  };
}

async function bootstrapHelena(siteDir) {
  const sharp = requireSharp(siteDir);
  const www = path.join(siteDir, 'wwwroot');
  const uploads = path.join(siteDir, 'public', 'uploads');
  ensureDir(path.join(uploads, 'site'));
  ensureDir(path.join(uploads, 'legacy'));

  const bgIn = path.join(www, 'background.jpg');
  const splash = await processImage(sharp, bgIn, path.join(uploads, 'site', 'splash.webp'), {
    width: 2000,
    height: 2000
  });
  const fav = await processImage(sharp, bgIn, path.join(uploads, 'site', 'favicon.png'), { favicon: true });
  const colors = await sampleColors(sharp, bgIn);
  writeFileSync(path.join(siteDir, 'content', 'colors.json'), JSON.stringify({ source: 'background.jpg', colors }, null, 2));

  const pages = [
    page({
      id: 1,
      key: 'home',
      slug: 'home',
      title: 'Home',
      kind: 'page',
      status: 'draft',
      sort: 0,
      summary: 'Dr. Helena Rahme'
    }),
    page({
      id: 2,
      key: 'contact',
      slug: 'contact',
      title: 'Contact',
      kind: 'contact',
      sort: 10,
      summary: 'Get in touch with Dr. Helena Rahme.',
      content: '<p>Send a message and the clinic will get back to you.</p>'
    })
  ];

  const offices = [
    {
      id: 'badaro',
      country: 'Lebanon',
      role: 'Badaro clinic',
      address: 'Badaro, Beirut',
      poBox: '',
      phones: [],
      fax: '',
      emails: ['info@drhelenarahme.com'],
      mapQuery: "33°52'35.0\"N 35°31'02.4\"E",
      isPrimary: true,
      sort: 0
    },
    {
      id: 'jounieh',
      country: 'Lebanon',
      role: 'Jounieh clinic',
      address: 'Jounieh',
      poBox: '',
      phones: [],
      fax: '',
      emails: ['info@drhelenarahme.com'],
      mapQuery: 'Jounieh, Lebanon',
      isPrimary: false,
      sort: 1
    }
  ];

  const settings = {
    siteName: 'Dr. Helena Rahme',
    tagline: '',
    description: 'Dr. Helena Rahme clinic locations and contact.',
    logo: '',
    favicon: '/uploads/site/favicon.png',
    contactEmail: 'info@drhelenarahme.com',
    contactPhone: '',
    whatsappNumber: '',
    brochureUrl: '',
    footerText: '',
    copyright: '© Dr. Helena Rahme',
    inquiryTopics: ['Appointment', 'General inquiry'],
    themeColor: colors[0] || '#4a3f38',
    social: {
      facebook: '',
      instagram: 'https://instagram.com/drhelenarahme/',
      linkedin: '',
      youtube: ''
    },
    ctaBand: { title: '', text: '', label: '' },
    thankYouMessage: 'Thank you. Your message has been received.',
    seo: {
      defaultTitle: 'Dr. Helena Rahme',
      defaultDescription: 'Clinic locations in Badaro and Jounieh.',
      defaultKeywords: 'Helena Rahme, clinic, Badaro, Jounieh',
      defaultImage: '/uploads/site/splash.webp'
    },
    updatedAt: now,
    splashImage: '/uploads/site/splash.webp',
    splashWidth: splash.width,
    splashHeight: splash.height
  };

  // settings schema may reject splash fields — keep them in home instead
  const settingsClean = { ...settings };
  delete settingsClean.splashImage;
  delete settingsClean.splashWidth;
  delete settingsClean.splashHeight;

  const home = {
    hero: {
      enabled: true,
      eyebrow: '',
      slogans: ['Dr. Helena Rahme'],
      image: '/uploads/site/splash.webp',
      primaryCta: { label: '', url: '' },
      secondaryCta: { label: '', url: '' }
    },
    about: { enabled: false, title: '', content: '', highlight: '', statValue: '', statLabel: '' },
    studios: { enabled: false, title: '', content: '', quote: '', image: '' },
    services: { enabled: false, title: '', intro: '', items: [] },
    team: { enabled: false, title: '', content: '', members: [] },
    latestPosts: { enabled: false, title: '', intro: '', limit: 3 },
    contact: { enabled: false, title: '', intro: '', image: '' },
    updatedAt: now
  };

  writeJson(siteDir, 'pages.json', pages);
  writeJson(siteDir, 'page-images.json', []);
  writeJson(siteDir, 'menus.json', [
    menu('main', 'Main', [
      { title: 'Home', url: '/', pageId: null },
      { title: 'Contact', url: '/contact', pageId: 2 }
    ]),
    menu('footer', 'Footer', [{ title: 'Contact', url: '/contact', pageId: 2 }])
  ]);
  writeJson(siteDir, 'offices.json', offices);
  writeJson(siteDir, 'settings.json', settingsClean);
  writeJson(siteDir, 'home.json', home);
  writeJson(siteDir, 'redirects.json', []);
  writeJson(siteDir, 'asset-manifest.json', []);
  return { colors, splash };
}

async function bootstrapKhalaf(siteDir) {
  const sharp = requireSharp(siteDir);
  const www = path.join(siteDir, 'wwwroot');
  const uploads = path.join(siteDir, 'public', 'uploads');
  ensureDir(path.join(uploads, 'site'));

  const logoIn = path.join(www, 'logo.png');
  const portraitIn = path.join(www, 'dr-habib-khalaf.jpg');
  await processImage(sharp, logoIn, path.join(uploads, 'site', 'logo.webp'), { width: 600, height: 600 });
  await processImage(sharp, logoIn, path.join(uploads, 'site', 'favicon.png'), { favicon: true });
  await processImage(sharp, portraitIn, path.join(uploads, 'site', 'portrait.webp'), {
    width: 1200,
    height: 1200
  });
  const colors = await sampleColors(sharp, logoIn);
  writeFileSync(path.join(siteDir, 'content', 'colors.json'), JSON.stringify({ source: 'logo.png', colors }, null, 2));

  const services = [
    {
      title: 'Marriage Tribunals',
      text: 'Expert representation and guidance through the canonical marriage tribunal process, ensuring your case is presented clearly and effectively.',
      icon: 'gavel'
    },
    {
      title: 'Annulment Consultations',
      text: 'Compassionate and professional assistance in understanding and pursuing the annulment process within the Catholic Church.',
      icon: 'balance'
    },
    {
      title: 'Canon Law Advisory',
      text: 'Comprehensive consultation on all matters of canon law, providing clarity and direction for complex ecclesiastical questions.',
      icon: 'menu_book'
    },
    {
      title: 'Family Matters',
      text: 'Sensitive guidance for families facing difficult decisions regarding marriage, separation, and related canonical concerns.',
      icon: 'family_restroom'
    },
    {
      title: 'Case Preparation',
      text: 'Thorough preparation and documentation assistance for ecclesiastical tribunal cases, ensuring all requirements are met.',
      icon: 'description'
    },
    {
      title: 'Mediation Services',
      text: 'Professional mediation in canon law disputes, working toward just and pastoral solutions for all parties involved.',
      icon: 'handshake'
    }
  ];

  const aboutHtml = `
<p>Welcome to Khalaf Canon Law, where expertise meets compassion in matters of canon law. With years of dedicated service and specialized training, we provide professional guidance for individuals and families navigating complex ecclesiastical matters.</p>
<p>Our practice is built on a foundation of deep theological knowledge, extensive legal training, and a genuine commitment to helping clients through sensitive and important matters of faith and family.</p>
<ul>
<li>Doctor of Canon Law (J.C.D.)</li>
<li>Pontifical Lateran University, Rome – Italy</li>
<li>Licensed Canon Lawyer</li>
<li>Specialist in Marriage Cases</li>
<li>Expert in Divorce Consultations</li>
</ul>`.trim();

  const pages = [
    page({ id: 1, key: 'home', slug: 'home', title: 'Home', status: 'draft', sort: 0 }),
    page({
      id: 2,
      key: 'press',
      slug: 'press',
      title: 'Press',
      kind: 'blog',
      sort: 20,
      summary: 'Press releases and articles from Khalaf Canon Law.',
      content: ''
    }),
    page({
      id: 3,
      key: 'contact',
      slug: 'contact',
      title: 'Contact',
      kind: 'contact',
      sort: 30,
      summary: 'Schedule a confidential consultation.',
      content: '<p>Schedule a confidential consultation to discuss your case.</p>'
    })
  ];

  const home = {
    hero: {
      enabled: true,
      eyebrow: 'Canon Law',
      slogans: ['Expert marriage and divorce consultations'],
      image: '',
      primaryCta: { label: 'Get in touch', url: '/#ContactUs' },
      secondaryCta: { label: 'Areas of practice', url: '/#OurServices' }
    },
    about: {
      enabled: true,
      title: 'Dr. Habib Khalaf',
      content: aboutHtml,
      highlight: 'J.C.D., Pontifical Lateran University, Rome',
      statValue: '',
      statLabel: ''
    },
    studios: { enabled: false, title: '', content: '', quote: '', image: '' },
    services: {
      enabled: true,
      title: 'Areas of Practice',
      intro: '',
      items: services
    },
    team: {
      enabled: true,
      title: 'Counsel',
      content: '',
      members: [
        {
          name: 'Dr. Habib Khalaf',
          role: 'Canon Lawyer, J.C.D.',
          photo: '/uploads/site/portrait.webp',
          bio: 'Doctor of Canon Law from the Pontifical Lateran University in Rome. Specialist in marriage cases and divorce consultations.'
        }
      ]
    },
    latestPosts: {
      enabled: true,
      title: 'Press',
      intro: 'Articles and press releases.',
      limit: 3
    },
    contact: {
      enabled: true,
      title: 'Get in Touch',
      intro: 'Schedule a confidential consultation. We are here to help guide you through every step of the process.',
      image: ''
    },
    updatedAt: now
  };

  const settings = {
    siteName: 'Khalaf Canon Law',
    tagline: 'Expert marriage and divorce consultations',
    description:
      'Dr. Habib Khalaf - Canon Lawyer specializing in Marriage and Divorce Consultations. J.C.D. from Pontifical Lateran University, Rome.',
    logo: '/uploads/site/logo.webp',
    favicon: '/uploads/site/favicon.png',
    contactEmail: 'info@khalafcanonlaw.com',
    contactPhone: '+961 71 662 444',
    whatsappNumber: '96171662444',
    brochureUrl: '',
    footerText: 'Dr. Habib Khalaf, J.C.D. — Canon Lawyer',
    copyright: '© Khalaf Canon Law',
    inquiryTopics: ['Consultation', 'Marriage case', 'Annulment', 'General inquiry'],
    themeColor: colors[0] || '#1a2744',
    social: { facebook: '', instagram: '', linkedin: '', youtube: '' },
    ctaBand: { title: '', text: '', label: '' },
    thankYouMessage: 'Thank you. Your message has been received and we will contact you shortly.',
    seo: {
      defaultTitle: 'Khalaf Canon Law',
      defaultDescription:
        'Dr. Habib Khalaf - Canon Lawyer specializing in Marriage and Divorce Consultations.',
      defaultKeywords: 'canon law, marriage, divorce, annulment, Lebanon',
      defaultImage: '/uploads/site/logo.webp'
    },
    updatedAt: now
  };

  writeJson(siteDir, 'pages.json', pages);
  writeJson(siteDir, 'page-images.json', []);
  writeJson(siteDir, 'menus.json', [
    menu('main', 'Main', [
      { title: 'About', url: '/#AboutUs' },
      { title: 'Practice', url: '/#OurServices' },
      { title: 'Press', url: '/press', pageId: 2 },
      { title: 'Contact', url: '/#ContactUs' }
    ]),
    menu('footer', 'Footer', [
      { title: 'Press', url: '/press', pageId: 2 },
      { title: 'Contact', url: '/contact', pageId: 3 }
    ])
  ]);
  writeJson(siteDir, 'offices.json', [
    {
      id: 'lebanon',
      country: 'Lebanon',
      role: 'Practice',
      address: '',
      poBox: '',
      phones: ['+961 71 662 444'],
      fax: '',
      emails: ['info@khalafcanonlaw.com'],
      mapQuery: '',
      isPrimary: true,
      sort: 0
    }
  ]);
  writeJson(siteDir, 'settings.json', settings);
  writeJson(siteDir, 'home.json', home);
  writeJson(siteDir, 'redirects.json', []);
  writeJson(siteDir, 'asset-manifest.json', []);
  return { colors };
}

async function bootstrapMek(siteDir) {
  const sharp = requireSharp(siteDir);
  const www = path.join(siteDir, 'wwwroot');
  const uploads = path.join(siteDir, 'public', 'uploads');
  ensureDir(path.join(uploads, 'site'));
  ensureDir(path.join(uploads, 'gallery'));

  const logoIn = path.join(www, 'images', 'logo.jpg');
  await processImage(sharp, logoIn, path.join(uploads, 'site', 'logo.webp'), { width: 600, height: 600 });
  await processImage(sharp, logoIn, path.join(uploads, 'site', 'favicon.png'), { favicon: true });
  const colors = await sampleColors(sharp, logoIn);
  writeFileSync(path.join(siteDir, 'content', 'colors.json'), JSON.stringify({ source: 'images/logo.jpg', colors }, null, 2));

  const productDir = path.join(www, 'images', 'products');
  const productFiles = [
    'kitchen.png',
    '468953042_18294494074225284_3956976372228988232_n.jpg',
    '471278665_18297496825225284_3650746720404982809_n.jpg',
    '471550408_18297496927225284_588950985585661051_n.jpg',
    '471361732_18297495958225284_617073204959052914_n.jpg',
    '471478037_18297496363225284_467832883669961719_n.jpg',
    '471560714_18297494995225284_4495085771116377586_n.jpg'
  ];
  const pageImages = [];
  let imgId = 1;
  for (const file of productFiles) {
    const src = path.join(productDir, file);
    if (!existsSync(src)) continue;
    const outName = `work-${imgId}.webp`;
    await processImage(sharp, src, path.join(uploads, 'gallery', outName), { width: 1600, height: 1600 });
    pageImages.push({
      id: imgId,
      pageId: 2,
      sort: imgId,
      caption: '',
      src: `/uploads/gallery/${outName}`,
      width: null,
      height: null,
      createdAt: now
    });
    imgId += 1;
  }

  const aboutHtml = `<p>At Mek Beirut, we specialize in transforming visions into tangible masterpieces. Our dedication to high-end woodwork and furniture execution is unmatched in Lebanon. We blend traditional craftsmanship with modern innovation to create bespoke pieces that define luxury.</p>
<p>From intricate joinery to seamless finishes, every project is a testament to our commitment to excellence. We work closely with architects and designers to ensure that every detail is executed to perfection, bringing sophistication and elegance to your residential and commercial spaces.</p>`;

  const pages = [
    page({ id: 1, key: 'home', slug: 'home', title: 'Home', status: 'draft', sort: 0 }),
    page({
      id: 2,
      key: 'our-work',
      slug: 'our-work',
      title: 'Our Work',
      sort: 10,
      summary: 'High-end woodwork and furniture projects by Mek Beirut.',
      content: '<p>A selection of recent residential and commercial projects.</p>',
      status: 'published'
    }),
    page({
      id: 3,
      key: 'contact',
      slug: 'contact',
      title: 'Contact',
      kind: 'contact',
      sort: 20,
      summary: 'Contact Mek Beirut.',
      content: '<p>Tell us about your project.</p>'
    })
  ];

  const home = {
    hero: {
      enabled: true,
      eyebrow: 'Mek Beirut',
      slogans: ['High-end woodwork & furniture execution'],
      image: pageImages[0] ? pageImages[0].src : '',
      primaryCta: { label: 'Contact us', url: '/#ContactUs' },
      secondaryCta: { label: 'Our work', url: '/#OurWork' }
    },
    about: {
      enabled: true,
      title: 'About Us',
      content: aboutHtml,
      highlight: 'Bespoke woodwork for residential and commercial spaces',
      statValue: '',
      statLabel: ''
    },
    studios: {
      enabled: true,
      title: 'Our Work',
      content: '<p>A selection of recent projects. Open any photo for a closer look on the <a href="/our-work">Our Work</a> page.</p>',
      quote: '',
      image: pageImages[1] ? pageImages[1].src : pageImages[0]?.src || ''
    },
    services: { enabled: false, title: '', intro: '', items: [] },
    team: { enabled: false, title: '', content: '', members: [] },
    latestPosts: { enabled: false, title: '', intro: '', limit: 3 },
    contact: {
      enabled: true,
      title: 'Get In Touch',
      intro: 'Call, message on WhatsApp, or send an email.',
      image: ''
    },
    updatedAt: now
  };

  const settings = {
    siteName: 'Mek Beirut',
    tagline: 'High-end woodwork & furniture execution',
    description: 'Mek Beirut specializes in high-end woodwork and furniture execution in Lebanon.',
    logo: '/uploads/site/logo.webp',
    favicon: '/uploads/site/favicon.png',
    contactEmail: 'mkhoury@mekbeirut.com',
    contactPhone: '+961 81 33 11 44',
    whatsappNumber: '96181331144',
    brochureUrl: '',
    footerText: '',
    copyright: '© Mek Beirut',
    inquiryTopics: ['Project inquiry', 'General inquiry'],
    themeColor: colors[0] || '#3c2f26',
    social: {
      facebook: 'https://www.facebook.com/MEK.Beirut',
      instagram: 'https://www.instagram.com/mekbeirut/',
      linkedin: '',
      youtube: ''
    },
    ctaBand: { title: '', text: '', label: '' },
    thankYouMessage: 'Thank you. Your message has been received and our team will contact you shortly.',
    seo: {
      defaultTitle: 'Mek Beirut',
      defaultDescription: 'High-end woodwork and furniture execution in Beirut.',
      defaultKeywords: 'woodwork, furniture, Beirut, Mek',
      defaultImage: '/uploads/site/logo.webp'
    },
    updatedAt: now
  };

  writeJson(siteDir, 'pages.json', pages);
  writeJson(siteDir, 'page-images.json', pageImages);
  writeJson(siteDir, 'menus.json', [
    menu('main', 'Main', [
      { title: 'About', url: '/#AboutUs' },
      { title: 'Our Work', url: '/#OurWork' },
      { title: 'Contact', url: '/#ContactUs' }
    ]),
    menu('footer', 'Footer', [
      { title: 'Our Work', url: '/our-work', pageId: 2 },
      { title: 'Contact', url: '/contact', pageId: 3 }
    ])
  ]);
  writeJson(siteDir, 'offices.json', [
    {
      id: 'achrafieh',
      country: 'Lebanon',
      role: 'Workshop & showroom',
      address: 'Achrafieh, Beirut, Lebanon',
      poBox: '',
      phones: ['+961 81 33 11 44', '+961 1 444 335'],
      fax: '',
      emails: ['mkhoury@mekbeirut.com'],
      mapQuery: '33.893701,35.533688',
      isPrimary: true,
      sort: 0
    }
  ]);
  writeJson(siteDir, 'settings.json', settings);
  writeJson(siteDir, 'home.json', home);
  writeJson(siteDir, 'redirects.json', []);
  writeJson(siteDir, 'asset-manifest.json', []);
  return { colors, pageImages };
}

async function bootstrapWadih(siteDir) {
  const sharp = requireSharp(siteDir);
  const www = path.join(siteDir, 'wwwroot');
  const uploads = path.join(siteDir, 'public', 'uploads');
  ensureDir(path.join(uploads, 'site'));
  ensureDir(path.join(uploads, 'gallery'));
  ensureDir(path.join(uploads, 'brands'));
  ensureDir(path.join(uploads, 'partners'));
  ensureDir(path.join(uploads, 'press'));

  const logoIn = path.join(www, 'images', 'logo.png');
  await processImage(sharp, logoIn, path.join(uploads, 'site', 'logo.webp'), { width: 600, height: 600 });
  await processImage(sharp, logoIn, path.join(uploads, 'site', 'favicon.png'), { favicon: true });
  const founderIn = path.join(www, 'images', 'Pictureof-the-Founder.png');
  if (existsSync(founderIn)) {
    await processImage(sharp, founderIn, path.join(uploads, 'site', 'founder.webp'), { width: 1200, height: 1200 });
  }
  const colors = await sampleColors(sharp, logoIn);
  writeFileSync(path.join(siteDir, 'content', 'colors.json'), JSON.stringify({ source: 'images/logo.png', colors }, null, 2));

  const pageImages = [];
  let imgId = 1;

  // Cigar gallery: prefer big/, else thumb/
  for (let n = 1; n <= 12; n++) {
    const big = path.join(www, 'images', 'products', 'big', `${n}.jpg`);
    const thumb = path.join(www, 'images', 'products', 'thumb', `${n}.jpg`);
    const src = existsSync(big) ? big : existsSync(thumb) ? thumb : null;
    if (!src) continue;
    const out = `cigar-${n}.webp`;
    await processImage(sharp, src, path.join(uploads, 'gallery', out), { width: 1600, height: 1600 });
    pageImages.push({
      id: imgId++,
      pageId: 3,
      sort: n,
      caption: '',
      src: `/uploads/gallery/${out}`,
      width: null,
      height: null,
      createdAt: now
    });
  }

  // Brand logos
  const brandHtmlParts = [];
  for (let n = 1; n <= 15; n++) {
    const src = path.join(www, 'images', 'products', `logo${n}.png`);
    if (!existsSync(src)) continue;
    const out = `brand-${n}.webp`;
    await processImage(sharp, src, path.join(uploads, 'brands', out), { width: 600, height: 600 });
    brandHtmlParts.push(`<li class="logo-strip__item"><img src="/uploads/brands/${out}" alt="Brand ${n}" loading="lazy" width="200" height="85" /></li>`);
  }
  const bud = path.join(www, 'images', 'Budweiser_logo6.jpg');
  if (existsSync(bud)) {
    await processImage(sharp, bud, path.join(uploads, 'brands', 'budweiser.webp'), { width: 600, height: 600 });
    brandHtmlParts.unshift(
      `<li class="logo-strip__item"><img src="/uploads/brands/budweiser.webp" alt="Budweiser" loading="lazy" width="200" height="85" /></li>`
    );
  }

  // Partners
  const partnerParts = [];
  for (let n = 1; n <= 8; n++) {
    const src = path.join(www, 'images', 'partners', `${n}.jpg`);
    if (!existsSync(src)) continue;
    const out = `partner-${n}.webp`;
    await processImage(sharp, src, path.join(uploads, 'partners', out), { width: 800, height: 800 });
    partnerParts.push(`<li class="logo-strip__item"><img src="/uploads/partners/${out}" alt="Partner ${n}" loading="lazy" /></li>`);
  }

  // Press
  for (let n = 1; n <= 3; n++) {
    const src = path.join(www, 'images', 'Media', 'press', `Pic-${n}.jpg`);
    if (!existsSync(src)) continue;
    const out = `press-${n}.webp`;
    await processImage(sharp, src, path.join(uploads, 'press', out), { width: 1600, height: 1600 });
    pageImages.push({
      id: imgId++,
      pageId: 5,
      sort: n,
      caption: '',
      src: `/uploads/press/${out}`,
      width: null,
      height: null,
      createdAt: now
    });
  }

  const mission =
    'We are agents and distributors of brands. We add value by enhancing demand, ensuring availability of goods, guaranteeing quality, efficient logistics and devoted customer services. We aim the highest customer satisfaction, high job satisfaction for our companions and long term sustainable growth for our vendors. Together, we all win.';

  const aboutHtml = `
<p><strong>Founder: Antoun Wadih</strong></p>
<p>The business started out in 1977 and today is one of the most reputable in Lebanon in its field. The founder Antoun Wadih started the family business by importing cigarettes, cigars, alcoholic beverages and food products into the Lebanese market during the civil war (times when business was almost impossible in Lebanon!). In 1990, the business started to shift from being just an importer/trader to an agent &amp; distributor supplying the modern trade, supermarkets, wholesalers, distributors, Horeca, etc.</p>
<p>Our distribution adds value to your brands. Working on very tight margins and dealing in high volume, we are able to establish pricing that keeps you extremely competitive while at the same time never compromising the outstanding service you have come to expect.</p>
${existsSync(path.join(uploads, 'site', 'founder.webp')) ? '<p><img src="/uploads/site/founder.webp" alt="Antoun Wadih" width="400" height="400" /></p>' : ''}
`.trim();

  const productsHtml = `
<p>We distribute cigars &amp; cigarettes and beverages &amp; alcoholic drinks.</p>
<ul>
<li><a href="/products/storing-cuban-cigars">Storing Cuban cigars, humidors and boxes</a></li>
<li><a href="/products/how-to-smoke-a-cuban-cigar">How to smoke a Cuban cigar</a></li>
<li><a href="/products/x-plosiv">X-Plosiv Energy Drink</a></li>
<li><a href="/products/x-plosiv-vodka">X-Plosiv Vodka Mix</a></li>
</ul>
<h2>Our brands</h2>
<ul class="logo-strip">${brandHtmlParts.join('')}</ul>
`.trim();

  const partnersHtml = `
<p>We are agents and distributors of brands. We add value by enhancing demand, ensuring availability of goods, guaranteeing quality, efficient logistics and devoted customer services. We aim the highest customer satisfaction, high job satisfaction for our companions and long term sustainable growth for our vendors. Together, we all win.</p>
<p>We keenly supply the modern trade, wholesalers, distributors, groceries, gas stations, pubs, restaurants, hotels and resorts.</p>
<ul class="logo-strip">${partnerParts.join('')}</ul>
`.trim();

  const careersHtml = `<p>At Wadihco, the human factor is considered a critical factor for success. Therefore, we give our highest attention to the development of our resources. On-the-job training, and internal seminars and workshops are held for continuous improvement. Wadihco is always eager to find fresh capable and dynamic talents to join its leading staff and to grow within its family of professionals.</p>`;

  const storingHtml = readLegacyText(path.join(www, 'storingCuban-cigars.html'));
  const smokeHtml = readLegacyText(path.join(www, 'howSmoke-Cuban-cigar.html'));
  const xplosivHtml = readLegacyText(path.join(www, 'x-plosiv.html'));
  const xplosiv2Html = readLegacyText(path.join(www, 'x-plosiv2.html'));

  const pages = [
    page({ id: 1, key: 'home', slug: 'home', title: 'Home', status: 'draft', sort: 0 }),
    page({
      id: 2,
      key: 'about',
      slug: 'about',
      title: 'About Us',
      sort: 10,
      summary: 'The Wadihco story since 1977.',
      content: aboutHtml,
      heroImage: ''
    }),
    page({
      id: 3,
      key: 'products',
      slug: 'products',
      title: 'Products',
      kind: 'section',
      sort: 20,
      summary: 'Cigars, cigarettes, beverages and brands we distribute.',
      content: productsHtml
    }),
    page({
      id: 4,
      key: 'partners',
      slug: 'partners',
      title: 'Our Partners',
      sort: 30,
      summary: 'Distributors and wholesale partners.',
      content: partnersHtml
    }),
    page({
      id: 5,
      key: 'media',
      slug: 'media',
      title: 'Media',
      sort: 40,
      summary: 'Press and media.',
      content: '<p>Press coverage and media from Wadihco.</p>'
    }),
    page({
      id: 6,
      key: 'careers',
      slug: 'careers',
      title: 'Careers',
      sort: 50,
      summary: 'Join the Wadihco team.',
      content: careersHtml
    }),
    page({
      id: 7,
      key: 'contact',
      slug: 'contact',
      title: 'Contact Us',
      kind: 'contact',
      sort: 60,
      summary: 'Contact Wadihco.',
      content: '<p>Email us or visit one of our branches.</p>'
    }),
    page({
      id: 8,
      key: 'storing-cuban-cigars',
      parentId: 3,
      slug: 'storing-cuban-cigars',
      title: 'Storing Cuban cigars',
      sort: 1,
      summary: 'Humidors, boxes and storage.',
      content: storingHtml
    }),
    page({
      id: 9,
      key: 'how-to-smoke-a-cuban-cigar',
      parentId: 3,
      slug: 'how-to-smoke-a-cuban-cigar',
      title: 'How to smoke a Cuban cigar',
      sort: 2,
      summary: 'Tips for enjoying a Cuban cigar.',
      content: smokeHtml
    }),
    page({
      id: 10,
      key: 'x-plosiv',
      parentId: 3,
      slug: 'x-plosiv',
      title: 'X-Plosiv Energy Drink',
      sort: 3,
      summary: 'X-Plosiv energy drink.',
      content: xplosivHtml
    }),
    page({
      id: 11,
      key: 'x-plosiv-vodka',
      parentId: 3,
      slug: 'x-plosiv-vodka',
      title: 'X-Plosiv Vodka Mix',
      sort: 4,
      summary: 'X-Plosiv vodka mix.',
      content: xplosiv2Html
    })
  ];

  const home = {
    hero: {
      enabled: true,
      eyebrow: 'Wadihco S.A.R.L.',
      slogans: ['Agents and distributors of brands'],
      image: '',
      primaryCta: { label: 'Our products', url: '/products' },
      secondaryCta: { label: 'Shop now', url: 'https://www.drinks4lessonline.com' }
    },
    about: {
      enabled: true,
      title: 'Our mission',
      content: `<p>${mission}</p>`,
      highlight: 'Since 1977',
      statValue: '1977',
      statLabel: 'Founded'
    },
    studios: { enabled: false, title: '', content: '', quote: '', image: '' },
    services: {
      enabled: true,
      title: 'What we do',
      intro: '',
      items: [
        { title: 'Brand distribution', text: 'We enhance demand and ensure availability of goods.', icon: 'local_shipping' },
        { title: 'Quality & logistics', text: 'Guaranteed quality with efficient logistics.', icon: 'inventory_2' },
        { title: 'Customer service', text: 'Devoted service for modern trade, Horeca and wholesale.', icon: 'support_agent' }
      ]
    },
    team: { enabled: false, title: '', content: '', members: [] },
    latestPosts: { enabled: false, title: '', intro: '', limit: 3 },
    contact: {
      enabled: true,
      title: 'Contact Us',
      intro: 'Reach either of our branches in Jounieh.',
      image: ''
    },
    updatedAt: now
  };

  const settings = {
    siteName: 'Wadihco',
    tagline: 'Agents and distributors of brands',
    description: mission,
    logo: '/uploads/site/logo.webp',
    favicon: '/uploads/site/favicon.png',
    contactEmail: 'info@wadihco.com',
    contactPhone: '+961 9 218 592',
    whatsappNumber: '',
    brochureUrl: 'https://www.drinks4lessonline.com',
    footerText: 'Together, we all win.',
    copyright: '© Wadihco S.A.R.L.',
    inquiryTopics: ['Distribution', 'Products', 'Careers', 'General inquiry'],
    themeColor: colors[0] || '#2c2c2c',
    social: { facebook: '', instagram: '', linkedin: '', youtube: '' },
    ctaBand: {
      title: 'Shop online',
      text: 'Browse drinks and more at Drinks4Less.',
      label: 'Shop now'
    },
    thankYouMessage: 'Thank you. Your message has been received and our team will contact you shortly.',
    seo: {
      defaultTitle: 'Wadihco S.A.R.L.',
      defaultDescription: mission.slice(0, 160),
      defaultKeywords: 'Wadihco, distribution, cigars, beverages, Lebanon',
      defaultImage: '/uploads/site/logo.webp'
    },
    updatedAt: now
  };

  const redirects = [
    { from: '/index.php', to: '/' },
    { from: '/index.htm', to: '/' },
    { from: '/aboutus.php', to: '/about' },
    { from: '/aboutus.htm', to: '/about' },
    { from: '/products.php', to: '/products' },
    { from: '/products.htm', to: '/products' },
    { from: '/partners.php', to: '/partners' },
    { from: '/partners.htm', to: '/partners' },
    { from: '/press.php', to: '/media' },
    { from: '/careers.php', to: '/careers' },
    { from: '/careers.htm', to: '/careers' },
    { from: '/contactus.php', to: '/contact' },
    { from: '/contactus.htm', to: '/contact' },
    { from: '/storingCuban-cigars.html', to: '/products/storing-cuban-cigars' },
    { from: '/howSmoke-Cuban-cigar.html', to: '/products/how-to-smoke-a-cuban-cigar' },
    { from: '/x-plosiv.html', to: '/products/x-plosiv' },
    { from: '/x-plosiv2.html', to: '/products/x-plosiv-vodka' }
  ];

  writeJson(siteDir, 'pages.json', pages);
  writeJson(siteDir, 'page-images.json', pageImages);
  writeJson(siteDir, 'menus.json', [
    menu('main', 'Main', [
      { title: 'Mission', url: '/' },
      { title: 'About Us', url: '/about', pageId: 2 },
      { title: 'Products', url: '/products', pageId: 3 },
      { title: 'Our Partners', url: '/partners', pageId: 4 },
      { title: 'Media', url: '/media', pageId: 5 },
      { title: 'Careers', url: '/careers', pageId: 6 },
      { title: 'Contact Us', url: '/contact', pageId: 7 },
      { title: 'Shop now', url: 'https://www.drinks4lessonline.com' }
    ]),
    menu('footer', 'Footer', [
      { title: 'About', url: '/about', pageId: 2 },
      { title: 'Products', url: '/products', pageId: 3 },
      { title: 'Contact', url: '/contact', pageId: 7 }
    ])
  ]);
  writeJson(siteDir, 'offices.json', [
    {
      id: 'aws-zouk',
      country: 'Lebanon',
      role: 'AWS sal (Tobacco)',
      address: 'Zouk Mosbeh, King Jesus Main Road, Daccache Bldg, GF & B1',
      poBox: '1226 Jounieh Lebanon',
      phones: ['+961 9 218 592'],
      fax: '+961 9 225 494',
      emails: ['info@wadihco.com'],
      mapQuery: 'Zouk Mosbeh, Lebanon',
      isPrimary: true,
      sort: 0
    },
    {
      id: 'sahel-alma',
      country: 'Lebanon',
      role: 'Wadihco SARL',
      address: 'Sahel Alma, Damaa Bldg, GF & B1',
      poBox: '1226 Jounieh Lebanon',
      phones: ['+961 9 225 524'],
      fax: '',
      emails: ['info@wadihco.com'],
      mapQuery: 'Sahel Alma, Lebanon',
      isPrimary: false,
      sort: 1
    }
  ]);
  writeJson(siteDir, 'settings.json', settings);
  writeJson(siteDir, 'home.json', home);
  writeJson(siteDir, 'redirects.json', redirects);
  writeJson(siteDir, 'asset-manifest.json', []);
  return { colors };
}

function readLegacyText(filePath) {
  if (!existsSync(filePath)) return '<p>Content coming soon.</p>';
  const raw = readFileSync(filePath, 'utf8');
  // Prefer a main content region if present; else strip chrome.
  let body = raw;
  const match = raw.match(/<td[^>]*class=["']?content["']?[^>]*>([\s\S]*?)<\/td>/i);
  if (match) body = match[1];
  else {
    body = raw
      .replace(/<!DOCTYPE[\s\S]*?>/i, '')
      .replace(/<head[\s\S]*?<\/head>/i, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');
  }
  // Drop nav chrome tables/links common on the legacy site
  body = body
    .replace(/WADIHCO S\.A\.R\.L[\s\S]*?SHOP NOW/gi, '')
    .replace(/copyright\s*©[\s\S]*$/i, '')
    .replace(/<img[^>]*src=["']images\/logo\.png["'][^>]*>/gi, '');
  body = body.trim();
  if (!body) return '<p>Content coming soon.</p>';
  if (!/<[a-z][\s\S]*>/i.test(body)) {
    return `<p>${body}</p>`;
  }
  return body;
}

const sites = [
  { domain: 'drhelenarahme.com', run: bootstrapHelena },
  { domain: 'khalafcanonlaw.com', run: bootstrapKhalaf },
  { domain: 'mekbeirut.com', run: bootstrapMek },
  { domain: 'wadihco.com', run: bootstrapWadih }
];

for (const s of sites) {
  const dir = path.join(ROOT, 'websites', s.domain);
  ensureDir(path.join(dir, 'content'));
  ensureDir(path.join(dir, 'data'));
  console.log(`Bootstrapping ${s.domain}...`);
  const result = await s.run(dir);
  console.log(`  colors: ${(result.colors || []).join(', ')}`);
}
console.log('Done.');
