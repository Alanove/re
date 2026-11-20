/**
 * Import I.D Branding & Advertising from the live Adobe Edge site.
 * Does not import the homepage splash or the injected zdjz.pages.dev script.
 */
import dns from 'node:dns';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_FILES, PATHS } from '../src/config/paths.js';
import { loadTransformConfig } from '../src/config/transform.js';
import { thumbUrl } from '../src/domain/media.js';
import type { Home, Menu, Office, Page, PageImage, Redirect, Settings } from '../src/domain/models.js';
import { imageProcessingService, type ImagePreset } from '../src/services/imageProcessingService.js';
import { AssetCollector, writeAssetManifest } from './lib/asset-manifest.js';

dns.setDefaultResultOrder('ipv4first');

const SITE = 'https://idbrandingandadvertising.com';
const USER_AGENT = 'Mozilla/5.0 (compatible; idbranding-import/1.0)';
const CONCURRENCY = 4;
const now = new Date().toISOString();

const ABOUT_US =
  "I.D Branding & Advertising offers creative ideas with innovative work methods. We provide successful communication solutions at the highest standards aiming always at ensuring our clients' satisfaction. We seek perfection and maintain professionalism with our clients in a highly efficient and value-added manner.";

const ABOUT_DESCRIPTION =
  'We are committed to delivering the best services across Lebanon & the Middle East region. Our core competencies are: Creative Concepts, Layout & Design, Branding Events, Below the Line Advertising, Booth Design & Production, Promotional Materials & Printing.';

const SERVICES = [
  { title: 'Creative Concepts', text: 'Ideas shaped for brands across Lebanon and the Middle East.', icon: 'lightbulb' },
  { title: 'Layout & Design', text: 'Layouts and design systems for print and campaigns.', icon: 'design_services' },
  { title: 'Branding Events', text: 'Event branding that carries the identity through the room.', icon: 'celebration' },
  { title: 'Below the Line Advertising', text: 'BTL work that stays close to the audience.', icon: 'campaign' },
  { title: 'Booth Design & Production', text: 'Booths designed and produced for exhibitions and events.', icon: 'storefront' },
  { title: 'Promotional Materials & Printing', text: 'Printed materials that finish the campaign.', icon: 'print' }
] as const;

interface WorkCategory {
  key: string;
  slug: string;
  title: string;
  legacyHtml: string;
  folder: string;
  files: string[];
}

const WORK: WorkCategory[] = [
  {
    key: 'concepts',
    slug: 'concepts',
    title: 'Concepts',
    legacyHtml: 'concepts.html',
    folder: 'concepts',
    files: Array.from({ length: 22 }, (_, i) => `concepts${String(i + 1).padStart(2, '0')}.jpg`)
  },
  {
    key: 'drop-cards',
    slug: 'drop-cards',
    title: 'Drop Cards',
    legacyHtml: 'dropcards.html',
    folder: 'dropcards',
    files: Array.from({ length: 20 }, (_, i) => `dropcards${String(i + 1).padStart(2, '0')}.jpg`)
  },
  {
    key: 'calendars',
    slug: 'calendars',
    title: 'Calendars',
    legacyHtml: 'calendars.html',
    folder: 'calendars',
    files: Array.from({ length: 7 }, (_, i) => `calendar${i + 1}.jpg`)
  },
  {
    key: 'booth-events',
    slug: 'booth-events',
    title: 'Booth & Events',
    legacyHtml: 'booth.html',
    folder: 'booth',
    files: [
      '1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '8.jpg', '9.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg',
      '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg', '25.jpg', '26.jpg', '27.jpg',
      '28.jpg', '29.jpg', '30.jpg', '31.jpg', '32.jpg', '33.jpg', '34.jpg', '36.jpg', '37.jpg', '38.jpg', '39.jpg',
      '40.jpg', '41.jpg', '42.jpg', '43.jpg', '44.jpg', '45.jpg', '46.jpg', '47.jpg', '48.jpg', '49.jpg', '50.jpg',
      '51.jpg', '52.jpg', '53.jpg', '54.jpg', '55.jpg', '56.jpg', '57.jpg', '58.jpg', '59.jpg'
    ]
  },
  {
    key: 'brochures-flyers',
    slug: 'brochures-flyers',
    title: 'Brochures & Flyers',
    legacyHtml: 'brochures.html',
    folder: 'brochures',
    files: [
      ...Array.from({ length: 7 }, (_, i) => `${String(i + 1).padStart(2, '0')}.png`),
      ...Array.from({ length: 10 }, (_, i) => `brochure${i + 1}.png`)
    ]
  },
  {
    key: 'posters-rollups',
    slug: 'posters-rollups',
    title: 'Posters & Roll Ups',
    legacyHtml: 'posters.html',
    folder: 'posters',
    files: [
      ...Array.from({ length: 5 }, (_, i) => `posters${String(i + 1).padStart(2, '0')}.jpg`),
      'posters5.1.jpg', 'posters5.2.jpg', 'posters5.3.jpg', 'posters5.4.jpg',
      'posters06.jpg', 'posters07.jpg', 'posters08.jpg', 'posters09.jpg',
      ...Array.from({ length: 6 }, (_, i) => `rollups${String(i + 1).padStart(2, '0')}.jpg`),
      'billboards1.jpg', 'billboards2.jpg', 'billboards3.jpg', 'billboards4.jpg'
    ]
  }
];

const CLIENT_FILES = Array.from({ length: 17 }, (_, i) => `clients${String(i + 1).padStart(2, '0')}.jpg`);

function page(input: Omit<Page, 'createdAt' | 'updatedAt' | 'icon' | 'heroVideo' | 'header'> & { header?: string; icon?: string; heroVideo?: string }): Page {
  return {
    icon: '',
    heroVideo: '',
    header: input.header ?? input.title,
    ...input,
    createdAt: now,
    updatedAt: now
  };
}

async function fetchBuffer(urlPath: string): Promise<Buffer | null> {
  const url = `${SITE}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(45_000)
    });
    if (!response.ok) {
      console.warn(`  missing ${urlPath} (${response.status})`);
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.warn(`  failed ${urlPath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function mapPool<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

function localUploadPath(...parts: string[]): string {
  return `/${['uploads', ...parts].join('/')}`.replace(/\\/g, '/');
}

function diskPath(localUrl: string): string {
  return path.join(PATHS.public, localUrl.replace(/^\/+/, '').split('/').join(path.sep));
}

async function saveProcessed(buffer: Buffer, localUrl: string, preset: ImagePreset | 'favicon'): Promise<{ width: number; height: number }> {
  const processed = await imageProcessingService.process(buffer, preset === 'favicon' ? 'favicon' : preset);
  const target = diskPath(localUrl);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, processed.main.buffer);
  if (processed.thumb && localUrl.toLowerCase().endsWith('.webp')) {
    await writeFile(diskPath(thumbUrl(localUrl)), processed.thumb.buffer);
  }
  return { width: processed.main.width, height: processed.main.height };
}

async function sampleLogoColors(logoPath: string): Promise<string[]> {
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(logoPath)
    .resize(80, 80, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 245 && g > 245 && b > 245) continue;
    if (r < 12 && g < 12 && b < 12) continue;
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    const prev = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    prev.n += 1;
    prev.r += r;
    prev.g += g;
    prev.b += b;
    buckets.set(key, prev);
  }
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((c) => {
      const r = Math.round(c.r / c.n);
      const g = Math.round(c.g / c.n);
      const b = Math.round(c.b / c.n);
      return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    });
}

function contrastRatio(hex: string, against: string): number {
  const lum = (value: string): number => {
    const n = Number.parseInt(value.slice(1), 16);
    const channels = [n >> 16, (n >> 8) & 255, n & 255].map((channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const a = lum(hex);
  const b = lum(against);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function deepenForAa(hex: string, against = '#ffffff', min = 4.5): string {
  if (contrastRatio(hex, against) >= min) {
    return hex;
  }
  const n = Number.parseInt(hex.slice(1), 16);
  let r = n >> 16;
  let g = (n >> 8) & 255;
  let b = n & 255;
  for (let i = 0; i < 40; i += 1) {
    r = Math.max(0, Math.round(r * 0.92));
    g = Math.max(0, Math.round(g * 0.92));
    b = Math.max(0, Math.round(b * 0.92));
    const next = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    if (contrastRatio(next, against) >= min) {
      return next;
    }
  }
  return '#5a1452';
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  const config = await loadTransformConfig();
  console.info(`Importing ${config.siteName} from ${SITE}`);

  const mirrorRoot = path.join(PATHS.root, 'content', 'legacy-mirror');
  await mkdir(mirrorRoot, { recursive: true });

  const assets = new AssetCollector();
  const logoLocal = '/uploads/site/logo.webp';
  const faviconLocal = '/uploads/site/favicon.png';
  assets.add(logoLocal, ['/assets/id.png'], 'logo');
  assets.add(faviconLocal, ['/assets/favicon.png'], 'favicon');

  console.info('Downloading logo and favicon…');
  const logoBuffer = await fetchBuffer('/assets/id.png');
  if (!logoBuffer) {
    throw new Error('Could not download assets/id.png');
  }
  const logoRaw = path.join(mirrorRoot, 'assets', 'id.png');
  await mkdir(path.dirname(logoRaw), { recursive: true });
  await writeFile(logoRaw, logoBuffer);
  const logoSize = await saveProcessed(logoBuffer, logoLocal, 'logo');
  assets.toManifest(); // ensure collector has entries

  const faviconBuffer = (await fetchBuffer('/assets/favicon.png')) ?? logoBuffer;
  await writeFile(path.join(mirrorRoot, 'assets', 'favicon.png'), faviconBuffer);
  await saveProcessed(faviconBuffer, faviconLocal, 'favicon');

  const colors = await sampleLogoColors(logoRaw);
  const brandSample = colors[0] ?? '#881e79';
  const primary = deepenForAa(brandSample);
  console.info(`Logo colours: ${colors.join(', ')} → primary ${primary}`);
  await writeJson(path.join(PATHS.root, 'content', 'logo-colors.json'), {
    sampledFrom: 'assets/id.png',
    colors,
    brandSample,
    primary
  });

  const downloads: { legacyPath: string; local: string; preset: ImagePreset }[] = [];

  for (const category of WORK) {
    for (const [index, file] of category.files.entries()) {
      const legacyPath = `/${category.folder}/${file}`;
      const local = localUploadPath('legacy', category.folder, file.replace(/\.[^.]+$/, '.webp'));
      assets.add(local, [legacyPath], 'gallery');
      downloads.push({ legacyPath, local, preset: 'gallery' });
      if (index === 0) {
        // cover also stored as card for home mosaic
        const coverLocal = localUploadPath('site', 'covers', `${category.slug}.webp`);
        assets.add(coverLocal, [legacyPath], 'card');
        downloads.push({ legacyPath, local: coverLocal, preset: 'card' });
      }
    }
  }

  for (const file of CLIENT_FILES) {
    const legacyPath = `/clients/${file}`;
    const local = localUploadPath('legacy', 'clients', file.replace(/\.[^.]+$/, '.webp'));
    assets.add(local, [legacyPath], 'card');
    downloads.push({ legacyPath, local, preset: 'card' });
  }

  console.info(`Downloading ${downloads.length} portfolio and client images…`);
  const sizes = new Map<string, { width: number; height: number }>();
  sizes.set(logoLocal, logoSize);

  let ok = 0;
  let missing = 0;
  await mapPool(downloads, CONCURRENCY, async (item) => {
    const buffer = await fetchBuffer(item.legacyPath);
    const mirrorFile = path.join(mirrorRoot, ...item.legacyPath.split('/').filter(Boolean));
    if (!buffer) {
      missing += 1;
      return;
    }
    await mkdir(path.dirname(mirrorFile), { recursive: true });
    if (!existsSync(mirrorFile)) {
      await writeFile(mirrorFile, buffer);
    }
    const size = await saveProcessed(buffer, item.local, item.preset);
    sizes.set(item.local, size);
    ok += 1;
    if (ok % 20 === 0) {
      console.info(`  saved ${ok}/${downloads.length}`);
    }
  });
  console.info(`Images saved: ${ok}, missing: ${missing}`);

  const pages: Page[] = [
    page({
      id: 1,
      key: 'home',
      parentId: null,
      slug: 'home',
      title: 'Home',
      summary: '',
      content: '',
      status: 'draft',
      kind: 'page',
      sort: 0,
      heroImage: '',
      seo: { title: '', description: '', keywords: '' }
    }),
    page({
      id: 2,
      key: 'about',
      parentId: null,
      slug: 'about',
      title: 'About',
      summary: 'Company profile and core competencies.',
      content: `<h2>About us</h2>\n<p>${ABOUT_US}</p>\n<h2>Description</h2>\n<p>${ABOUT_DESCRIPTION}</p>`,
      status: 'published',
      kind: 'page',
      sort: 10,
      heroImage: '',
      seo: {
        title: '',
        description: ABOUT_US.slice(0, 160),
        keywords: 'advertising agencies in lebanon, branding, design, advertising'
      }
    }),
    page({
      id: 3,
      key: 'work',
      parentId: null,
      slug: 'work',
      title: 'Work',
      summary: 'Concepts, drop cards, calendars, booths, brochures, posters and roll-ups.',
      content: '',
      status: 'published',
      kind: 'section',
      sort: 20,
      heroImage: localUploadPath('site', 'covers', 'concepts.webp'),
      seo: { title: '', description: 'Selected work from I.D Branding & Advertising.', keywords: 'portfolio, branding, advertising' }
    })
  ];

  let nextId = 4;
  const pageImages: PageImage[] = [];
  let imageId = 1;

  for (const [index, category] of WORK.entries()) {
    const pageId = nextId;
    nextId += 1;
    const cover = localUploadPath('site', 'covers', `${category.slug}.webp`);
    pages.push(
      page({
        id: pageId,
        key: category.key,
        parentId: 3,
        slug: category.slug,
        title: category.title,
        summary: `${category.title} from the I.D Branding portfolio.`,
        content: '',
        status: 'published',
        kind: 'page',
        sort: (index + 1) * 10,
        heroImage: sizes.has(cover) ? cover : '',
        seo: { title: '', description: `${category.title} gallery.`, keywords: category.title.toLowerCase() }
      })
    );
    let sort = 0;
    for (const file of category.files) {
      const local = localUploadPath('legacy', category.folder, file.replace(/\.[^.]+$/, '.webp'));
      const size = sizes.get(local);
      if (!size) {
        continue;
      }
      pageImages.push({
        id: imageId,
        pageId,
        sort,
        caption: '',
        src: local,
        width: size.width,
        height: size.height,
        createdAt: now
      });
      imageId += 1;
      sort += 1;
    }
  }

  const clientsId = nextId;
  nextId += 1;
  const firstClient = localUploadPath('legacy', 'clients', 'clients01.webp');
  pages.push(
    page({
      id: clientsId,
      key: 'clients',
      parentId: null,
      slug: 'clients',
      title: 'Clients',
      summary: 'Client boards from the I.D Branding portfolio.',
      content: '',
      status: 'published',
      kind: 'page',
      sort: 30,
      heroImage: sizes.has(firstClient) ? firstClient : '',
      seo: { title: '', description: 'Clients of I.D Branding & Advertising.', keywords: 'clients, branding' }
    })
  );
  let clientSort = 0;
  for (const file of CLIENT_FILES) {
    const local = localUploadPath('legacy', 'clients', file.replace(/\.[^.]+$/, '.webp'));
    const size = sizes.get(local);
    if (!size) {
      continue;
    }
    pageImages.push({
      id: imageId,
      pageId: clientsId,
      sort: clientSort,
      caption: '',
      src: local,
      width: size.width,
      height: size.height,
      createdAt: now
    });
    imageId += 1;
    clientSort += 1;
  }

  const contactId = nextId;
  pages.push(
    page({
      id: contactId,
      key: 'contact',
      parentId: null,
      slug: 'contact',
      title: 'Contact',
      summary: 'Zalka office, phones and email.',
      content: '',
      status: 'published',
      kind: 'contact',
      sort: 40,
      heroImage: '',
      seo: {
        title: '',
        description: 'Contact I.D Branding & Advertising in Zalka, Lebanon.',
        keywords: 'contact, Zalka, advertising agency'
      }
    })
  );

  const menus: Menu[] = [
    {
      id: 'main',
      name: 'Main',
      description: '',
      items: [
        { id: 'main-1', title: 'Home', url: '/', pageId: null, sort: 0, active: true, children: [] },
        { id: 'main-2', title: 'About', url: '/about', pageId: 2, sort: 1, active: true, children: [] },
        { id: 'main-3', title: 'Work', url: '/work', pageId: 3, sort: 2, active: true, children: [] },
        { id: 'main-4', title: 'Clients', url: '/clients', pageId: clientsId, sort: 3, active: true, children: [] },
        { id: 'main-5', title: 'Contact', url: '/contact', pageId: contactId, sort: 4, active: true, children: [] }
      ]
    },
    {
      id: 'footer',
      name: 'Footer',
      description: '',
      items: [
        { id: 'footer-1', title: 'About', url: '/about', pageId: 2, sort: 0, active: true, children: [] },
        { id: 'footer-2', title: 'Work', url: '/work', pageId: 3, sort: 1, active: true, children: [] },
        { id: 'footer-3', title: 'Clients', url: '/clients', pageId: clientsId, sort: 2, active: true, children: [] },
        { id: 'footer-4', title: 'Contact', url: '/contact', pageId: contactId, sort: 3, active: true, children: [] }
      ]
    }
  ];

  const offices: Office[] = [
    {
      id: 'zalka',
      country: 'Lebanon',
      role: 'Head office',
      address: 'Zalka, Cite Moussa, block C, 6th floor',
      poBox: '',
      phones: ['+961 1 902 842', '+961 3 455 102'],
      fax: '',
      emails: ['info@idbrandingandadvertising.com'],
      mapQuery: 'Zalka, Cite Moussa, block C, Lebanon',
      isPrimary: true,
      sort: 0
    }
  ];

  const settings: Settings = {
    siteName: 'I.D Branding & Advertising',
    tagline: 'Creative ideas with innovative work methods',
    description: ABOUT_US,
    logo: logoLocal,
    favicon: faviconLocal,
    contactEmail: 'info@idbrandingandadvertising.com',
    contactPhone: '+961 1 902 842',
    whatsappNumber: '',
    brochureUrl: '',
    footerText: ABOUT_DESCRIPTION,
    copyright: '© {year} I.D Branding & Advertising',
    inquiryTopics: ['Branding', 'Advertising', 'Events', 'Printing', 'General inquiry'],
    themeColor: primary,
    social: {
      facebook: 'https://www.facebook.com/Idbrandingandadvertising',
      instagram: '',
      linkedin: 'https://www.linkedin.com/profile/view?trk=nav_responsive_tab_profile&id=312720202',
      youtube: '',
      twitter: 'https://twitter.com/ID_branding'
    },
    ctaBand: {
      title: 'Have a project in mind?',
      text: 'Tell us about the brief. We work across Lebanon and the Middle East.',
      label: 'Contact us'
    },
    thankYouMessage: 'Thank you. Your message has been received and our team will contact you shortly.',
    seo: {
      defaultTitle: 'I.D Branding & Advertising',
      defaultDescription: ABOUT_US.slice(0, 160),
      defaultKeywords: 'advertising agencies in lebanon, branding, design, advertising, communication',
      defaultImage: logoLocal
    },
    updatedAt: now
  };

  const home: Home = {
    hero: {
      enabled: true,
      eyebrow: 'I.D Branding & Advertising',
      slogans: ['Creative ideas with innovative work methods'],
      image: '',
      primaryCta: { label: 'See our work', url: '/work' },
      secondaryCta: { label: 'Contact', url: '/contact' }
    },
    about: {
      enabled: true,
      title: 'About us',
      content: `<p>${ABOUT_US}</p><p>${ABOUT_DESCRIPTION}</p>`,
      highlight: 'Lebanon & the Middle East',
      statValue: '',
      statLabel: ''
    },
    studios: {
      enabled: false,
      title: '',
      content: '',
      quote: '',
      image: ''
    },
    services: {
      enabled: true,
      title: 'What we do',
      intro: 'Core competencies from the company profile.',
      items: SERVICES.map((item) => ({ ...item }))
    },
    team: {
      enabled: false,
      title: '',
      content: '',
      members: []
    },
    latestPosts: {
      enabled: false,
      title: '',
      intro: '',
      limit: 3
    },
    contact: {
      enabled: true,
      title: 'Contact',
      intro: 'Zalka, Cite Moussa, block C, 6th floor.',
      image: ''
    },
    updatedAt: now
  };

  const redirects: Redirect[] = [
    { from: '/index.html', to: '/' },
    { from: '/menu.html', to: '/' },
    { from: '/aboutus.html', to: '/about' },
    { from: '/contact.html', to: '/contact' },
    { from: '/clients.html', to: '/clients' },
    { from: '/work.html', to: '/work' },
    ...WORK.map((category) => ({ from: `/${category.legacyHtml}`, to: `/work/${category.slug}` }))
  ];

  const manifest = assets.toManifest();
  for (const entry of manifest.assets) {
    const size = sizes.get(entry.local);
    if (size) {
      entry.status = 'ok';
      entry.width = size.width;
      entry.height = size.height;
      entry.source = `${SITE}${entry.legacyPaths[0]}`;
      try {
        const buf = await readFile(diskPath(entry.local));
        entry.bytes = buf.byteLength;
      } catch {
        entry.status = 'missing';
      }
    } else {
      entry.status = 'missing';
    }
  }

  await writeJson(DATA_FILES.pages, pages);
  await writeJson(DATA_FILES.menus, menus);
  await writeJson(DATA_FILES.home, home);
  await writeJson(DATA_FILES.offices, offices);
  await writeJson(DATA_FILES.settings, settings);
  await writeJson(DATA_FILES.pageImages, pageImages);
  await writeJson(DATA_FILES.redirects, redirects);
  await writeAssetManifest(manifest);

  console.info(`Wrote ${pages.length} pages, ${pageImages.length} gallery images, primary ${primary}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
