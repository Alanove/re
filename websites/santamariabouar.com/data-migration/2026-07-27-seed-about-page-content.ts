/**
 * Seed About page CMS content from the former hardcoded views/about.ejs copy.
 * Publishes the page so /about can render from admin/pages.
 *
 * Only fills content when the existing About row is empty (does not overwrite edits).
 *
 * Rollback:
 * UPDATE pages SET content = '', status = 'draft' WHERE slug = 'about';
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

const ABOUT_META_DESCRIPTION =
  'Learn about Santa Maria Bouar — a calm residential compound in Bouar with Lebanese-style architecture, green areas, swimming pool, and on-site services.';

const ABOUT_META_KEYWORDS =
  'Santa Maria Bouar, about, Bouar compound, residential compound, Lebanese architecture, swimming pool';

const ABOUT_CONTENT = `
<p class="lead">
  Santa Maria Bouar is a well-established residential compound in Bouar — a calm area known for its
  good neighborhood and welcoming, family-friendly atmosphere.
</p>

<p>
  Set away from the bustle of the city while remaining close to Bouar's shops, schools, and services,
  the compound offers a peaceful setting where residents enjoy a sense of community and everyday comfort.
  Bouar Hospital is practically next door — just about one minute away by car.
</p>

<h2>Lebanese Character</h2>
<p>
  The buildings feature traditional red roof tiles that fit naturally with Lebanese architectural style,
  giving the compound a warm and familiar character that feels rooted in the local landscape.
</p>

<h2>Green Surroundings</h2>
<p>
  Santa Maria includes a generous amount of landscaped green areas and gardens throughout the compound,
  providing pleasant open spaces for residents to enjoy throughout the year.
</p>

<h2>Life at the Compound</h2>
<p>
  Residents benefit from thoughtful on-site services and amenities that make daily life easier:
</p>
<ul>
  <li>A <a href="/facilities">swimming pool</a> for relaxation and family time</li>
  <li>On-site coordinator and regular cleaning of common areas</li>
  <li>Street lighting across the compound for safety and comfort</li>
  <li>A secure, gated environment in a quiet residential neighborhood</li>
</ul>

<p>
  Whether you are looking for a place to settle with your family or simply exploring what Bouar has to offer,
  we invite you to discover Santa Maria Bouar — a compound built for comfortable, secure living.
</p>

<p>
  <a href="/contact">Contact us</a> to learn more or schedule a visit.
</p>
`.trim();

export async function runMigration(ctx: MigrationContext): Promise<void> {
  const [rows] = await db.query(
    `SELECT id, content, status FROM pages WHERE slug = 'about' LIMIT 1`
  );
  const existing = (rows as any[])[0];

  if (!existing) {
    await db.query(
      `INSERT INTO pages (title, slug, content, meta_description, meta_keywords, status, order_index)
       VALUES (?, ?, ?, ?, ?, 'published', 0)`,
      ['About', 'about', ABOUT_CONTENT, ABOUT_META_DESCRIPTION, ABOUT_META_KEYWORDS]
    );
    ctx.log('Created and published About page with seeded content.');
    return;
  }

  const contentEmpty = !existing.content || !String(existing.content).trim();

  if (contentEmpty) {
    await db.query(
      `UPDATE pages
       SET content = ?, meta_description = ?, meta_keywords = ?, status = 'published'
       WHERE id = ?`,
      [ABOUT_CONTENT, ABOUT_META_DESCRIPTION, ABOUT_META_KEYWORDS, existing.id]
    );
    ctx.log('Seeded empty About page content and set status to published.');
  } else {
    await db.query(`UPDATE pages SET status = 'published' WHERE id = ? AND status <> 'published'`, [
      existing.id,
    ]);
    ctx.log('About page already has content; ensured published status.');
  }
}
