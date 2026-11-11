import { TOP_LEVEL_CATEGORY_ORDER } from '../../scripts/lib/antonios-wp-import-constants';

/** Fashion lines that use collection-first shop UX (not generic ecommerce filters). */
export const FASHION_LINE_SLUGS: readonly string[] = [
  'haute-couture',
  'ready-to-wear',
  'bridal',
  'cruise'
];

export function isFashionLineSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return FASHION_LINE_SLUGS.includes(slug);
}

export function parseSeasonYear(name: string): number {
  const matches = String(name || '').match(/\b(19|20)\d{2}\b/g);
  if (!matches?.length) return 0;
  return Math.max(...matches.map((m) => parseInt(m, 10)));
}

/** Higher = later in calendar year (Pre-Fall < FW < SS). */
export function parseSeasonOrder(name: string): number {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('spring') || lower.includes('summer')) return 3;
  if (lower.includes('fall') || lower.includes('winter') || lower.includes('autumn')) return 2;
  if (lower.includes('pre-fall') || lower.includes('prefall')) return 1;
  return 0;
}

export function sortCollectionsBySeason<T extends { name: string; order_index?: number | null }>(
  collections: T[]
): T[] {
  return [...collections].sort((a, b) => {
    const yearA = parseSeasonYear(a.name);
    const yearB = parseSeasonYear(b.name);
    if (yearB !== yearA) return yearB - yearA;
    const seasonA = parseSeasonOrder(a.name);
    const seasonB = parseSeasonOrder(b.name);
    if (seasonB !== seasonA) return seasonB - seasonA;
    const orderA = a.order_index ?? 0;
    const orderB = b.order_index ?? 0;
    if (orderB !== orderA) return orderB - orderA;
    return String(a.name).localeCompare(String(b.name));
  });
}

export interface CollectionYearGroup<T> {
  /** 0 when the collection name has no year. */
  year: number;
  items: Array<{ label: string; item: T }>;
  /** Set when the year has a single collection with no season in its name (e.g. "Bridal 2009"): link the year itself. */
  yearLink?: T;
}

/** Strips the year from a season name, e.g. "Fall / Winter 2025" -> "Fall / Winter". */
export function seasonLabelWithoutYear(name: string): string {
  const stripped = String(name || '')
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-–—,/]+$/, '')
    .replace(/^[\s\-–—,/]+/, '')
    .trim();
  return stripped || String(name || '').trim();
}

/** Groups season-named collections by year (newest first); items with no year go last. */
export function groupCollectionsByYear<T>(
  items: T[],
  getName: (item: T) => string
): CollectionYearGroup<T>[] {
  const groups = new Map<number, CollectionYearGroup<T>>();
  for (const item of items) {
    const name = getName(item);
    const year = parseSeasonYear(name);
    if (!groups.has(year)) groups.set(year, { year, items: [] });
    groups.get(year)!.items.push({ label: year ? seasonLabelWithoutYear(name) : name, item });
  }
  for (const group of groups.values()) {
    if (group.year > 0 && group.items.length === 1 && parseSeasonOrder(getName(group.items[0].item)) === 0) {
      group.yearLink = group.items[0].item;
    }
  }
  return [...groups.values()].sort((a, b) => {
    if (a.year === 0) return 1;
    if (b.year === 0) return -1;
    return b.year - a.year;
  });
}

export function findCategoryInTree(cats: any[], id: number): any | null {
  for (const cat of cats) {
    if (cat.id === id) return cat;
    if (cat.children?.length) {
      const found = findCategoryInTree(cat.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function getFashionLineRootSlug(
  categoryTree: any[],
  category: { id: number; slug: string; parent_id?: number | null }
): string | null {
  if (isFashionLineSlug(category.slug)) return category.slug;
  let parentId = category.parent_id;
  while (parentId) {
    const parent = findCategoryInTree(categoryTree, parentId);
    if (!parent) break;
    if (isFashionLineSlug(parent.slug)) return parent.slug;
    parentId = parent.parent_id;
  }
  return null;
}

export function getProductFashionLineRootSlug(categorySlugs: string[]): string | null {
  for (const lineSlug of TOP_LEVEL_CATEGORY_ORDER) {
    if (isFashionLineSlug(lineSlug) && categorySlugs.includes(lineSlug)) {
      return lineSlug;
    }
  }
  return null;
}

export function formatLookLabel(product: { name?: string; slug?: string }): string {
  const lookNumber = parseLookNumber(product);
  if (lookNumber != null) return `Look ${lookNumber}`;
  return product.name || 'Look';
}

export function parseLookNumber(product: { name?: string; slug?: string }): number | null {
  const slug = product.slug || '';
  const lookMatch = slug.match(/-look-(\d+)$/i);
  if (lookMatch) return parseInt(lookMatch[1], 10);
  const name = product.name || '';
  const nameMatch = name.match(/(\d+)\s*$/);
  if (nameMatch) return parseInt(nameMatch[1], 10);
  return null;
}

export function compareProductsByLook(
  a: { name?: string; slug?: string },
  b: { name?: string; slug?: string }
): number {
  const lookA = parseLookNumber(a);
  const lookB = parseLookNumber(b);
  if (lookA != null && lookB != null && lookA !== lookB) return lookA - lookB;
  if (lookA != null && lookB == null) return -1;
  if (lookA == null && lookB != null) return 1;
  return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true });
}

export function sortProductsByLook<T extends { name?: string; slug?: string }>(products: T[]): T[] {
  return [...products].sort(compareProductsByLook);
}

export function isInquiryOnlyProduct(fashionLineRoot: string | null): boolean {
  return fashionLineRoot === 'haute-couture';
}

export function shouldHideAddToCartOnListing(fashionLineRoot: string | null): boolean {
  return fashionLineRoot === 'haute-couture';
}

export function getFashionLineRootCategory(
  categoryTree: any[],
  category: { id: number; slug: string; parent_id?: number | null }
): any | null {
  if (isFashionLineSlug(category.slug)) {
    return findCategoryInTree(categoryTree, category.id);
  }
  if (category.parent_id) {
    const parent = findCategoryInTree(categoryTree, category.parent_id);
    if (parent && isFashionLineSlug(parent.slug)) return parent;
  }
  return null;
}

export function getCollectionChildren(rootCategory: any): any[] {
  const children = (rootCategory?.children || []).filter((c: any) => c && c.is_active !== false);
  return sortCollectionsBySeason(children);
}
