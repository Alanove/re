import { NodeType, parse } from 'node-html-parser';
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

/**
 * Legacy press pages open with a paragraph that is only the source link (the URL as its own text).
 * Returns that link and the body without it, so the link can become the entry's "read the original" button.
 */
export function extractLeadingLink(html: string): { html: string; url: string } {
  const root = parse(html);
  const first = root.childNodes.find((node) => node.nodeType === NodeType.ELEMENT_NODE && plainText(node.toString()) !== '');
  if (!first || !('querySelectorAll' in first)) {
    return { html, url: '' };
  }
  const element = first as ReturnType<typeof parse>;
  const links = element.querySelectorAll('a');
  const text = plainText(element.toString());
  const href = links[0]?.getAttribute('href')?.trim().replace(/&amp;/g, '&') ?? '';
  if (links.length !== 1 || !/^https?:\/\//i.test(href) || !/^https?:\/\/\S+$/i.test(text)) {
    return { html, url: '' };
  }
  element.remove();
  return { html: root.toString().trim(), url: href };
}

const ARABIC_LETTER = /[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]/g;
const LATIN_LETTER = /[A-Za-z\u00c0-\u024f]/g;

/** Share of letters in Arabic script, from 0 to 1. */
export function arabicShare(text: string): number {
  const arabic = text.match(ARABIC_LETTER)?.length ?? 0;
  const latin = text.match(LATIN_LETTER)?.length ?? 0;
  return arabic + latin === 0 ? 0 : arabic / (arabic + latin);
}

export interface LegacyQuote {
  quote: string;
  author: string;
  role: string;
}

/**
 * Reads a "they said" page: each quote is a paragraph in quotation marks followed by a paragraph naming who said it,
 * optionally with their role in parentheses.
 */
export function parseQuotes(html: string): LegacyQuote[] {
  const paragraphs = parse(html)
    .querySelectorAll('p')
    .map((node) => plainText(node.toString()))
    .filter(Boolean);
  const quotes: LegacyQuote[] = [];
  for (let index = 0; index < paragraphs.length - 1; index += 1) {
    const text = paragraphs[index] ?? '';
    const next = paragraphs[index + 1] ?? '';
    if (!/^["«“]/.test(text) || /^["«“]/.test(next)) {
      continue;
    }
    const match = /^(.*?)\s*\((.+)\)\s*$/.exec(next);
    const opened = text.replace(/^["«“]\s*/, '');
    const unbalanced = (opened.match(/["«»“”]/g)?.length ?? 0) % 2 === 1;
    quotes.push({
      quote: (unbalanced ? opened.replace(/\s*["»”](\.?)\s*$/, '$1') : opened).trim(),
      author: (match?.[1] ?? next).trim(),
      role: (match?.[2] ?? '').trim()
    });
    index += 1;
  }
  return quotes;
}
