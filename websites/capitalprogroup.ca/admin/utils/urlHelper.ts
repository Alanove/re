/**
 * Convert text to URL-friendly format
 * @param text - The text to convert
 * @returns URL-friendly string
 */
export function TOUrl(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
} 