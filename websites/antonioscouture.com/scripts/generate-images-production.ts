/**
 * Production WebP thumbnail generation (listing images).
 *
 * Forces NODE_ENV=production so `.env.production` is loaded by `regenerate-image-thumbs.ts`.
 * Processes: product_images, product_categories, variant_type_values, page_photos.
 *
 * Ensure DB migrations for `thumb_url` columns have been applied, then run:
 *   npm run generate:images:production
 *   npm run generate:images:production:dry
 *
 * On the server (example):
 *   cd /path/to/guerrasports && sudo -u www npm run generate:images:production
 */

process.env.NODE_ENV = 'production';

require('./regenerate-image-thumbs');
