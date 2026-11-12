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

export interface LegacySlide {
  title: string;
  description: string;
  image: string;
  link: string;
  order: number;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

/** Reads the hero slides from a legacy PRV/conf/Slider.config DataSet, sorted by OrderNbr. */
export function readSlides(xml: string): LegacySlide[] {
  const slides: LegacySlide[] = [];
  for (const match of xml.matchAll(/<Slides>([\s\S]*?)<\/Slides>/g)) {
    const block = match[1] ?? '';
    const field = (name: string): string => decodeXmlText(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block)?.[1] ?? '');
    const title = field('Title');
    if (!title) {
      continue;
    }
    slides.push({
      title,
      description: plainText(field('Description').replace(/<br\s*\/?>/gi, ' ')),
      image: field('ImageUrl'),
      link: field('Link'),
      order: Number.parseInt(field('OrderNbr'), 10) || 0
    });
  }
  return slides.sort((a, b) => a.order - b.order);
}
