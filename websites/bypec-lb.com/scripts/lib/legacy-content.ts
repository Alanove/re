import { toPlainText } from '../../src/services/sanitizeService.js';

export function plainText(html: string): string {
  return toPlainText(html).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Removes every <img> from a legacy body and returns the image sources in reading order, without duplicates. */
export function extractContentImages(html: string): { html: string; sources: string[] } {
  const sources: string[] = [];
  const stripped = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(tag)?.[2]?.trim();
    if (src && !sources.includes(src)) {
      sources.push(src);
    }
    return '';
  });
  const cleaned = stripped
    .replace(/<p>(?:\s|&nbsp;|<br\s*\/?>|\u200b)*<\/p>/gi, '')
    .replace(/<p>\s*(?=<p>)/gi, '')
    .replace(/(<p>)(?:\s|<br\s*\/?>|\u200b)+/gi, '$1')
    .replace(/(?:\s|<br\s*\/?>|\u200b)+(<\/p>)/gi, '$1')
    .trim();
  return { html: cleaned, sources };
}

/** Reads key/value pairs from a legacy ASP.NET DataSet config such as PRV/conf/Parameters.Config. */
export function readParameters(xml: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of xml.matchAll(/<Parameters>\s*<key>([^<]+)<\/key>\s*(?:<value>([^<]*)<\/value>)?\s*<\/Parameters>/g)) {
    const key = match[1]?.trim();
    if (key) {
      values.set(key, (match[2] ?? '').trim());
    }
  }
  return values;
}

/** "28,600 L.L" becomes 28600; anything without digits becomes null. */
export function parseLbp(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) {
    return null;
  }
  const amount = Number.parseInt(digits, 10);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
