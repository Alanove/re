/**
 * Update the member gate-access page so it no longer says access waits for approval.
 * Only replaces the original seeded sentence. Custom page copy is left unchanged.
 *
 * Rollback:
 * UPDATE pages
 * SET content = REPLACE(content, 'Access is granted immediately. Install', 'After your request is approved, install'),
 *     meta_description = 'Install the Safemate app to open the main gate after your access request is approved.'
 * WHERE slug = 'account-gate-access'
 *   AND content LIKE '%Access is granted immediately. Install%';
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

const OLD_PHRASE = 'After your request is approved, install';
const NEW_PHRASE = 'Access is granted immediately. Install';
const EXTRA_SENTENCE =
  ' The same instructions are emailed as soon as the request is submitted.';
const META_DESCRIPTION =
  'Install the Safemate app to open the main gate. New access is granted immediately.';

export async function runMigration(ctx: MigrationContext): Promise<void> {
  const [rows] = await db.query(
    `SELECT id, content FROM pages WHERE slug = 'account-gate-access' LIMIT 1`
  );
  const existing = (rows as Array<{ id: number; content: string | null }>)[0];
  if (!existing) {
    ctx.log('Main Gate Access App page was not found; nothing to update.');
    return;
  }

  const content = String(existing.content || '');
  if (!content.includes(OLD_PHRASE)) {
    ctx.log('Gate access page copy was already changed; left it as-is.');
    return;
  }

  let next = content.replace(OLD_PHRASE, NEW_PHRASE);
  if (!next.includes('emailed as soon as the request is submitted') && next.includes('12345678')) {
    next = next.replace(
      /(<strong>12345678<\/strong>\.)/,
      `$1${EXTRA_SENTENCE}`
    );
  }

  await db.query(
    `UPDATE pages SET content = ?, meta_description = ? WHERE id = ?`,
    [next, META_DESCRIPTION, existing.id]
  );
  ctx.log('Updated Main Gate Access App page to say access is granted immediately.');
}
