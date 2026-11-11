/**
 * Seeds CMS pages for footer legal/help links and creates storefront menu roots
 * "Quick Links" (page items) and "My Account" (internal customer URLs).
 *
 * Idempotent: skips pages and menu rows that already exist (by slug / parent + title).
 */
import dotenv from 'dotenv';
import * as path from 'path';
import type { RowDataPacket } from 'mysql2/promise';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql, { type ResultSetHeader } from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';
import {
  STOREFRONT_ACCOUNT_MENU,
  STOREFRONT_FOOTER_QUICK_LINKS_MENU,
} from '../src/constants/storefront-nav-menus';

const CONTACT_LINK = `<p>If you have questions, please <a href="/contact-us">contact us</a> and we will be happy to help.</p>`;

const CMS_PAGES: { title: string; slug: string; bodyParagraphs: string[] }[] = [
  {
    title: 'Terms & Conditions',
    slug: 'terms-and-conditions',
    bodyParagraphs: [
      'This page describes the general terms that apply when you use our website and purchase products from us. By placing an order or browsing our site, you agree to review and follow these terms.',
      'The information here is provided for general guidance only and does not replace professional legal advice where needed. We may update this page from time to time; continued use of the site after changes constitutes acceptance of the revised terms.',
    ],
  },
  {
    title: 'Refund and Returns Policy',
    slug: 'refund-and-returns-policy',
    bodyParagraphs: [
      'We want you to be satisfied with your purchase. This policy outlines how returns, exchanges, and refunds are handled in typical situations.',
      'Eligibility, time limits, and condition of items may apply. Please retain proof of purchase and follow any return instructions provided with your order or by our support team.',
      'Specific cases (made-to-measure items, final sale, or promotional goods) may be treated differently; details will be confirmed at checkout or by customer service.',
    ],
  },
  {
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    bodyParagraphs: [
      'We respect your privacy. This policy explains what personal information we may collect when you use our website or shop with us, how we use it, and the choices available to you.',
      'We process data only as needed to operate our store, fulfil orders, communicate with you, and comply with applicable law. We do not sell your personal information.',
      'You may contact us to exercise applicable rights (such as access or correction) depending on your jurisdiction.',
    ],
  },
  {
    title: 'When Will My Order Arrive?',
    slug: 'when-will-my-order-arrive',
    bodyParagraphs: [
      'Delivery times depend on product availability, processing, and the shipping method you select at checkout.',
      'Once your order ships, you should receive confirmation with tracking details where available. Carriers may update estimated delivery dates while your package is in transit.',
      'If your order seems delayed beyond the estimated window, please reach out with your order number so we can investigate.',
    ],
  },
  {
    title: 'FAQs',
    slug: 'faqs',
    bodyParagraphs: [
      'Below are answers to common questions about ordering, sizing, shipping, and account access.',
      'Ordering: add items to your cart, proceed to checkout, and complete payment using the options shown. You will receive an email confirmation after a successful order.',
      'Account: you can register or sign in to track orders, manage addresses, and use your wishlist. Use the links under “My Account” in the footer for quick access.',
    ],
  },
];

function pageHtml(title: string, bodyParagraphs: string[]): string {
  const paras = bodyParagraphs.map((p) => `<p>${p}</p>`).join('\n');
  return `<h1>${title}</h1>\n${paras}\n${CONTACT_LINK}`;
}

async function ensurePage(
  conn: mysql.PoolConnection,
  row: (typeof CMS_PAGES)[number]
): Promise<void> {
  const [existing] = await conn.query<RowDataPacket[]>('SELECT id FROM pages WHERE slug = ? LIMIT 1', [
    row.slug,
  ]);
  if (existing.length > 0) {
    console.log(`  ⚠️  Page "${row.slug}" already exists — skip`);
    return;
  }
  const content = pageHtml(row.title, row.bodyParagraphs);
  const metaDescription = `${row.title} — general information.`;
  await conn.query(
    `INSERT INTO pages (title, slug, content, meta_description, meta_keywords, status, template, parent_id, order_index)
     VALUES (?, ?, ?, ?, ?, 'published', '', NULL, 500)`,
    [row.title, row.slug, content, metaDescription, row.slug.replace(/-/g, ', ')]
  );
  console.log(`  ✓ Created page: ${row.slug}`);
}

async function getMenuRootId(conn: mysql.PoolConnection, title: string): Promise<number | null> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id FROM menu WHERE parent_id IS NULL AND title = ? LIMIT 1',
    [title]
  );
  return rows.length ? Number(rows[0].id) : null;
}

async function ensureMenuRoot(conn: mysql.PoolConnection, title: string, orderIndex: number): Promise<number> {
  const existing = await getMenuRootId(conn, title);
  if (existing !== null) return existing;
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO menu (title, url, parent_id, order_index, is_visible, css_class) VALUES (?, '', NULL, ?, 1, '')`,
    [title, orderIndex]
  );
  console.log(`  ✓ Created menu root: "${title}" (id ${result.insertId})`);
  return result.insertId;
}

async function menuItemExists(
  conn: mysql.PoolConnection,
  parentId: number,
  title: string
): Promise<boolean> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id FROM menu WHERE parent_id = ? AND title = ? LIMIT 1',
    [parentId, title]
  );
  return rows.length > 0;
}

async function ensureMenuItem(
  conn: mysql.PoolConnection,
  parentId: number,
  title: string,
  url: string,
  cssClass: string,
  orderIndex: number
): Promise<void> {
  if (await menuItemExists(conn, parentId, title)) {
    console.log(`  ⚠️  Menu item "${title}" under parent ${parentId} exists — skip`);
    return;
  }
  await conn.query(
    `INSERT INTO menu (title, parent_id, order_index, url, is_visible, css_class) VALUES (?, ?, ?, ?, 1, ?)`,
    [title, parentId, orderIndex, url, cssClass]
  );
  console.log(`  ✓ Menu item: ${title}`);
}

async function run(): Promise<void> {
  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
  });
  const conn = await pool.getConnection();
  try {
    console.log('\n🔄 Migration: Quick Links + My Account menus and CMS pages\n');

    for (const p of CMS_PAGES) {
      await ensurePage(conn, p);
    }

    const quickRoot = await ensureMenuRoot(conn, STOREFRONT_FOOTER_QUICK_LINKS_MENU, 210);
    let ord = 10;
    const quickItems: { title: string; slug: string }[] = [
      { title: 'Terms & Conditions', slug: 'terms-and-conditions' },
      { title: 'Refund and Returns Policy', slug: 'refund-and-returns-policy' },
      { title: 'Privacy Policy', slug: 'privacy-policy' },
      { title: 'When Will My Order Arrive?', slug: 'when-will-my-order-arrive' },
      { title: 'FAQs', slug: 'faqs' },
    ];
    for (const item of quickItems) {
      await ensureMenuItem(conn, quickRoot, item.title, item.slug, 'page', ord);
      ord += 10;
    }

    const accountRoot = await ensureMenuRoot(conn, STOREFRONT_ACCOUNT_MENU, 211);
    const accountItems: { title: string; path: string }[] = [
      { title: 'My Account', path: '/customer/account' },
      { title: 'My Orders', path: '/customer/orders' },
      { title: 'My Addresses', path: '/customer/addresses' },
      { title: 'Wishlist', path: '/customer/wishlist' },
    ];
    ord = 10;
    for (const item of accountItems) {
      await ensureMenuItem(conn, accountRoot, item.title, item.path, 'external', ord);
      ord += 10;
    }

    console.log('\n✅ Done.\n');
  } finally {
    conn.release();
    await pool.end();
  }
}

export default run;

if (require.main === module) {
  run().then(
    () => process.exit(0),
    (e) => {
      console.error(e);
      process.exit(1);
    }
  );
}
