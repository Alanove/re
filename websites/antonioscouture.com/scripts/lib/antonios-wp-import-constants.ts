/**
 * Antonios Couture WordPress WXR import — frozen mapping rules (see import plan).
 *
 * - portfolio_category terms → product_categories (parents + accessories children)
 * - Each published portfolio post → child category slug col-{wpPostId}
 * - Gallery images grouped by WP caption (leading digits): one product, multiple product_images; name “{Collection} {n}”
 * - SKU AC-WP-{portfolioId}-look-{n} or AC-WP-{portfolioId}-{attachmentId} if caption has no digits
 * - Pages: import the-designer, contact, news-events, journal (keep both slugs for news vs journal)
 */

/** SKU prefix; full SKU = AC-WP-{portfolioId}-look-{n} or AC-WP-{portfolioId}-{attachmentId} */
export const IMPORT_PRODUCT_SKU_PREFIX = 'AC-WP-';

export const IMPORT_COLLECTION_SLUG_PREFIX = 'col-';

/** portfolio_category slugs from legacy site; everything else in WXR is ignored */
export const ALLOWED_PORTFOLIO_CATEGORY_SLUGS = new Set([
  'accessories',
  'bridal',
  'cruise',
  'fashion-jewelry',
  'fine-jewelry',
  'hand-bags',
  'haute-couture',
  'ready-to-wear',
  'shoes',
  'wedding-dress-rental',
]);

/** Display order for top-level categories (sub-slugs follow parent block) */
export const TOP_LEVEL_CATEGORY_ORDER: string[] = [
  'haute-couture',
  'ready-to-wear',
  'bridal',
  'cruise',
  'accessories',
  'wedding-dress-rental',
];

export const SITE_URL_DEFAULT = 'https://antonioscouture.com';

/** Page slugs to import as CMS pages (published) */
export const PAGE_SLUGS_TO_IMPORT = new Set([
  'the-designer',
  'contact',
  'news-events',
  'journal',
]);
