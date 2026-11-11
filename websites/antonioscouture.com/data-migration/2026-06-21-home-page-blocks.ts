/**
 * Homepage block builder: reorderable components between hero and service strip.
 */
import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

interface HomeContentRow {
  tagline_html: string | null;
  bridal_video_url: string | null;
  bridal_video_poster_url: string | null;
  bridal_intro_html: string | null;
  la_maison_title: string | null;
  la_maison_body_html: string | null;
  la_maison_link: string | null;
}

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  is_featured: number | boolean;
}

async function insertBlock(
  sortOrder: number,
  type: string,
  config: Record<string, unknown>
): Promise<void> {
  await db.execute(
    `INSERT INTO home_page_blocks (type, sort_order, is_enabled, config) VALUES (?, ?, 1, ?)`,
    [type, sortOrder, JSON.stringify(config)]
  );
}

async function categoryHasProducts(categoryId: number): Promise<boolean> {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM products p
     INNER JOIN product_categories_map pcm ON pcm.product_id = p.id
     WHERE pcm.category_id = ? AND p.is_active = 1 AND p.status = 'published'
     LIMIT 1`,
    [categoryId]
  );
  return Number((rows as { cnt: number }[])?.[0]?.cnt ?? 0) > 0;
}

async function seedBlocksFromExistingContent(): Promise<void> {
  const [existing] = await db.query(`SELECT COUNT(*) AS cnt FROM home_page_blocks`);
  if (Number((existing as { cnt: number }[])?.[0]?.cnt ?? 0) > 0) {
    console.log('  home_page_blocks already seeded, skipping');
    return;
  }

  console.log('  Seeding home_page_blocks from current homepage content...');

  let sortOrder = 0;

  const [contentRows] = await db.query(
    `SELECT tagline_html, bridal_video_url, bridal_video_poster_url, bridal_intro_html,
            la_maison_title, la_maison_body_html, la_maison_link
     FROM home_page_content WHERE id = 1 LIMIT 1`
  );
  const content = (contentRows as HomeContentRow[])?.[0];

  if (content?.tagline_html?.trim()) {
    await insertBlock(sortOrder++, 'text', { html: content.tagline_html.trim() });
  }

  const [newArrivalRows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM products WHERE is_active = 1 AND status = 'published' AND is_new_arrival = 1`
  );
  if (Number((newArrivalRows as { cnt: number }[])?.[0]?.cnt ?? 0) > 0) {
    await insertBlock(sortOrder++, 'products_list', {
      title: 'New Arrivals',
      discoverLink: '/shop?new_arrival=true',
      source: 'new_arrivals',
      limit: 4
    });
  }

  const [categoryRows] = await db.query(
    `SELECT id, name, slug, is_featured FROM product_categories
     WHERE is_active = 1 AND is_featured = 1
     ORDER BY order_index ASC, name ASC
     LIMIT 12`
  );

  for (const cat of (categoryRows as CategoryRow[]) || []) {
    if (!(await categoryHasProducts(cat.id))) continue;
    await insertBlock(sortOrder++, 'category_display', {
      categoryId: cat.id,
      displayMode: 'shop_the_look'
    });
  }

  const bridalVideo = content?.bridal_video_url?.trim() || '';
  const bridalIntro = content?.bridal_intro_html?.trim() || '';
  if (bridalVideo || bridalIntro) {
    const [bridalCats] = await db.query(
      `SELECT id FROM product_categories WHERE slug = 'bridal' AND is_active = 1 LIMIT 1`
    );
    const bridalCategoryId = (bridalCats as { id: number }[])?.[0]?.id ?? null;
    await insertBlock(sortOrder++, 'category_display', {
      categoryId: bridalCategoryId,
      displayMode: 'video',
      introHtml: bridalIntro,
      videoUrl: bridalVideo,
      videoPosterUrl: content?.bridal_video_poster_url?.trim() || ''
    });
  }

  const laMaisonTitle = content?.la_maison_title?.trim() || '';
  const laMaisonBody = content?.la_maison_body_html?.trim() || '';
  const laMaisonLink = content?.la_maison_link?.trim() || '';
  if (laMaisonTitle || laMaisonBody) {
    let html = '';
    if (laMaisonTitle) {
      html += `<h2 class="home-la-maison-title">${laMaisonTitle}</h2>`;
    }
    if (laMaisonBody) {
      html += `<div class="home-la-maison-body">${laMaisonBody}</div>`;
    }
    if (laMaisonLink) {
      html += `<div class="home-la-maison-link-wrap"><a href="${laMaisonLink}" class="home-la-maison-link">Discover</a></div>`;
    }
    await insertBlock(sortOrder++, 'text', { html, style: 'la_maison' });
  }

  console.log(`  ✓ Seeded ${sortOrder} homepage block(s)`);
}

async function run(): Promise<void> {
  console.log('Creating home_page_blocks table...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS home_page_blocks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(32) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      config JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_home_page_blocks_sort (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await seedBlocksFromExistingContent();
  console.log('  ✓ home_page_blocks ready');
}

export default run;

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
