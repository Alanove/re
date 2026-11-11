export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\//g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractYear(name: string): string | null {
  const match = String(name || '').match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function hasSeasonQualifier(name: string): boolean {
  return /spring|summer|fall|winter|autumn|bridal|cruise|pre-fall|prefall/i.test(String(name || ''));
}

const FASHION_LINE_SLUGS = new Set(['haute-couture', 'ready-to-wear', 'bridal', 'cruise']);

function lineSlugForCategory(categorySlug: string, parentSlug: string | null): string | null {
  if (FASHION_LINE_SLUGS.has(categorySlug)) return categorySlug;
  return parentSlug;
}

export function buildCategorySlugPrefix(
  categoryName: string,
  categorySlug: string,
  parentSlug: string | null,
  existingProductSlug = ''
): string {
  const nameSlug = slugify(categoryName);
  const lineSlug = lineSlugForCategory(categorySlug, parentSlug);

  if (categorySlug.startsWith('col-')) {
    const year = extractYear(categoryName);
    if (lineSlug && year && !hasSeasonQualifier(categoryName)) {
      const shortPrefix = `${lineSlug}-${year}`;
      if (lineSlug && nameSlug.startsWith(`${lineSlug}-`)) return nameSlug;
      return shortPrefix;
    }
    if (lineSlug) {
      if (nameSlug === lineSlug || nameSlug.startsWith(`${lineSlug}-`)) return nameSlug;
      return `${lineSlug}-${nameSlug}`;
    }
    return nameSlug;
  }

  const baseMatch =
    existingProductSlug.match(/^(.+)-look-\d+$/i) ?? existingProductSlug.match(/^(.+)-img-\d+$/i);
  if (baseMatch) {
    const base = baseMatch[1]!;
    if (lineSlug && !base.startsWith(`${lineSlug}-`)) {
      return `${lineSlug}-${base}`;
    }
    return base;
  }

  if (lineSlug) return `${lineSlug}-${nameSlug}`;
  return nameSlug;
}

export function buildProductSlug(categoryPrefix: string, lookNumber: number): string {
  return `${categoryPrefix}-look-${lookNumber}`;
}

export function buildSoloProductSlug(categoryPrefix: string, attachmentId: number): string {
  return `${categoryPrefix}-img-${attachmentId}`;
}
