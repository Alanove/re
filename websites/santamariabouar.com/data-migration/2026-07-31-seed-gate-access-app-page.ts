/**
 * Seed Main Gate Access App CMS page for the member portal gate-access screen.
 * Editable in Admin → Pages (slug: account-gate-access). Also available at /account-gate-access.
 *
 * Rollback:
 * DELETE FROM pages WHERE slug = 'account-gate-access';
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

const META_DESCRIPTION =
  'Install the Safemate app to open the main gate. New access is granted immediately.';

const META_KEYWORDS =
  'Santa Maria Bouar, gate access, Safemate, main gate, Android, iPhone';

const CONTENT = `
<p>
  To access the main gate, submit a request using the button below.
  Access is granted immediately. Install the Safemate app, then log in with your
  <strong>phone number without the country code</strong> and the password
  <strong>12345678</strong>.
  The same instructions are emailed as soon as the request is submitted.
</p>
<p>
  <a href="https://play.google.com/store/apps/details?id=com.yaoertai.safemate&amp;hl=en_NZ"
     target="_blank" rel="noopener noreferrer">
    <i class="bi bi-android2" aria-hidden="true"></i> Download for Android (Safemate)
  </a>
</p>
<p>
  <a href="https://apps.apple.com/lb/app/safemate2/id1317683104"
     target="_blank" rel="noopener noreferrer">
    <i class="bi bi-apple" aria-hidden="true"></i> Download for iPhone (Safemate2)
  </a>
</p>
`.trim();

export async function runMigration(ctx: MigrationContext): Promise<void> {
  const [rows] = await db.query(
    `SELECT id, content, status FROM pages WHERE slug = 'account-gate-access' LIMIT 1`
  );
  const existing = (rows as any[])[0];

  if (!existing) {
    await db.query(
      `INSERT INTO pages (title, slug, content, meta_description, meta_keywords, status, order_index)
       VALUES (?, ?, ?, ?, ?, 'published', 0)`,
      ['Main Gate Access App', 'account-gate-access', CONTENT, META_DESCRIPTION, META_KEYWORDS]
    );
    ctx.log('Created and published Main Gate Access App page with seeded content.');
    return;
  }

  const contentEmpty = !existing.content || !String(existing.content).trim();

  if (contentEmpty) {
    await db.query(
      `UPDATE pages
       SET content = ?, meta_description = ?, meta_keywords = ?, status = 'published', title = ?
       WHERE id = ?`,
      [CONTENT, META_DESCRIPTION, META_KEYWORDS, 'Main Gate Access App', existing.id]
    );
    ctx.log('Seeded empty Main Gate Access App page content and set status to published.');
  } else {
    await db.query(`UPDATE pages SET status = 'published' WHERE id = ? AND status <> 'published'`, [
      existing.id,
    ]);
    ctx.log('Main Gate Access App page already has content; ensured published status.');
  }
}
