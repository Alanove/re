/**
 * Seed Welcome Note CMS page for the homepage section under the slider.
 * Editable in Admin → Pages (slug: welcome-note). Also available at /welcome-note.
 *
 * Rollback:
 * DELETE FROM pages WHERE slug = 'welcome-note';
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

const META_DESCRIPTION =
  'Welcome to Santa Maria Bouar — a calm residential compound in Bouar with a welcoming, family-friendly atmosphere.';

const META_KEYWORDS =
  'Santa Maria Bouar, welcome, Bouar compound, residential compound, gated community';

const CONTENT = `
<p class="lead">
  Welcome to Santa Maria Bouar — a well-established residential compound in Bouar,
  known for its calm neighborhood and welcoming, family-friendly atmosphere.
</p>

<p>
  Set away from the bustle of the city while remaining close to Bouar's shops, schools, and services,
  the compound offers a peaceful setting where residents enjoy a sense of community and everyday comfort.
  Bouar Hospital is practically next door — just about one minute away by car.
</p>

<p>
  With traditional Lebanese-style architecture, landscaped green areas, a swimming pool,
  and thoughtful on-site services, Santa Maria is built for comfortable, secure living.
</p>

<p>
  <a href="/about">Learn more about the compound</a>
  or <a href="/contact">contact us</a> to schedule a visit.
</p>
`.trim();

export async function runMigration(ctx: MigrationContext): Promise<void> {
  const [rows] = await db.query(
    `SELECT id, content, status FROM pages WHERE slug = 'welcome-note' LIMIT 1`
  );
  const existing = (rows as any[])[0];

  if (!existing) {
    await db.query(
      `INSERT INTO pages (title, slug, content, meta_description, meta_keywords, status, order_index)
       VALUES (?, ?, ?, ?, ?, 'published', 0)`,
      ['Welcome Note', 'welcome-note', CONTENT, META_DESCRIPTION, META_KEYWORDS]
    );
    ctx.log('Created and published Welcome Note page with seeded content.');
    return;
  }

  const contentEmpty = !existing.content || !String(existing.content).trim();

  if (contentEmpty) {
    await db.query(
      `UPDATE pages
       SET content = ?, meta_description = ?, meta_keywords = ?, status = 'published', title = ?
       WHERE id = ?`,
      [CONTENT, META_DESCRIPTION, META_KEYWORDS, 'Welcome Note', existing.id]
    );
    ctx.log('Seeded empty Welcome Note page content and set status to published.');
  } else {
    await db.query(`UPDATE pages SET status = 'published' WHERE id = ? AND status <> 'published'`, [
      existing.id,
    ]);
    ctx.log('Welcome Note page already has content; ensured published status.');
  }
}
