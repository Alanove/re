export function parseVariantAttributes(
  attributes: string | Record<string, string> | null | undefined
): Record<string, string> | null {
  if (!attributes) return null;
  if (typeof attributes === 'object') return attributes;
  try {
    const parsed = JSON.parse(attributes);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function formatVariantAttributesLabel(
  attributes: string | Record<string, string> | null | undefined
): string | null {
  const attrs = parseVariantAttributes(attributes);
  if (!attrs || Object.keys(attrs).length === 0) return null;
  return Object.entries(attrs)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' | ');
}

export function buildOrderVariantName(
  variant: { name?: string | null; attributes?: string | Record<string, string> | null },
  productName: string
): string | null {
  const fromAttributes = formatVariantAttributesLabel(variant.attributes);
  if (fromAttributes) return fromAttributes;

  const variantName = variant.name?.trim();
  const product = productName.trim();
  if (variantName && variantName !== product) return variantName;

  return null;
}
