import { createHash } from 'node:crypto';
import path from 'node:path';
import { SLUG_PATTERN } from '../../src/domain/models.js';
import { toPlainText } from '../../src/services/sanitizeService.js';

const DROPPED_STYLE_PROPERTIES = /^(?:font-family|font-size|line-height|mso-[\w-]+|tab-stops|text-indent|margin(?:-[\w-]+)?|unicode-bidi|direction|text-autospace|text-justify)$/i;
const EMPTY_PARAGRAPH = /<p\b[^>]*>(?:\s|&nbsp;|&#160;|\u200b|<br\s*\/?>|<span\b[^>]*>(?:\s|&nbsp;)*<\/span>|<strong>(?:\s|&nbsp;)*<\/strong>)*<\/p>/gi;

export function plainText(html: string): string {
  return toPlainText(html).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanStyle(style: string): string {
  return style
    .split(';')
    .map((rule) => rule.trim())
    .filter((rule) => {
      const property = rule.split(':')[0]?.trim() ?? '';
      return rule.includes(':') && !DROPPED_STYLE_PROPERTIES.test(property);
    })
    .join('; ');
}

const BLANK = String.raw`(?:\s|&nbsp;|&#160;|\u200b)*`;
const EMPTY_LINK = new RegExp(String.raw`<a\b[^>]*>${BLANK}<\/a>`, 'gi');
const EMPTY_DIV = new RegExp(String.raw`<div\b[^>]*>${BLANK}<\/div>`, 'gi');

/** Removes links, divs and paragraphs left empty once images were dropped (lead duplicates, missing files). */
export function removeEmptyWrappers(html: string): string {
  let value = html;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = value.replace(EMPTY_LINK, '').replace(EMPTY_DIV, '').replace(EMPTY_PARAGRAPH, '');
    if (next === value) {
      break;
    }
    value = next;
  }
  return value.replace(/\n{3,}/g, '\n\n').trim();
}

/** Removes Word and editor leftovers from a legacy body: font styles, empty paragraphs, bare spans, `&nbsp;` runs. */
export function cleanLegacyHtml(html: string): string {
  let value = html
    .replace(/\sdata-cke-saved-(?:href|src)\s*=\s*(["']).*?\1/gi, '')
    .replace(/<\/?o:p>/gi, '')
    .replace(/\sclass\s*=\s*(["'])Mso[\w\s-]*\1/gi, '')
    .replace(/\sdir\s*=\s*(["'])(rtl|ltr)\1/gi, (_whole, quote: string, dir: string) => ` dir=${quote}${dir.toLowerCase()}${quote}`)
    .replace(/\sstyle\s*=\s*(["'])(.*?)\1/gi, (_whole, quote: string, style: string) => {
      const kept = cleanStyle(style);
      return kept ? ` style=${quote}${kept}${quote}` : '';
    })
    .replace(/<img\b[^>]*\bsrc\s*=\s*(["'])file:[^"']*\1[^>]*>/gi, '');
  for (let pass = 0; pass < 3; pass += 1) {
    value = value
      .replace(/<span>([\s\S]*?)<\/span>/gi, '$1')
      .replace(/<font\b[^>]*>([\s\S]*?)<\/font>/gi, '$1')
      .replace(/<div\b[^>]*>(?:\s|&nbsp;)*<\/div>/gi, '');
  }
  value = value
    .replace(/\r\n?/g, '\n')
    .replace(/<\/(strong|em|b|i)>(\s*)<\1>/gi, '$2')
    .replace(EMPTY_PARAGRAPH, '')
    .replace(/(?:&nbsp;|\u00a0){2,}/g, ' ')
    .replace(/(<p\b[^>]*>)(?:\s|&nbsp;|<br\s*\/?>)+/gi, '$1')
    .replace(/(?:\s|&nbsp;|<br\s*\/?>)+(<\/p>)/gi, '$1')
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>')
    .replace(/\n{3,}/g, '\n\n');
  return removeEmptyWrappers(value);
}

/** Turns a legacy path segment into a slug the router accepts (letters, marks, digits, `_` and `-`). */
export function safeSlug(segment: string, maxLength = 120): string {
  const value = segment
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[^\p{L}\p{N}]+/u, '');
  const cut = value.slice(0, maxLength).replace(/[_-]+$/, '') || value.slice(0, maxLength);
  return SLUG_PATTERN.test(cut) ? cut : '';
}

function asciiStem(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Stable ASCII upload path for a legacy file, grouped by its legacy folder (`Page_123`, `Album45`, `Videos`).
 * Arabic file names are replaced by a short hash so paths stay identical on Windows and Linux.
 */
export function legacyUploadPath(prefix: string, legacyPath: string, extension: string): string {
  const decoded = decodeSafe(legacyPath).replace(/\\/g, '/');
  const parsed = path.posix.parse(decoded);
  const hash = createHash('sha1').update(decoded.normalize('NFC').toLowerCase()).digest('hex').slice(0, 10);
  const stem = asciiStem(parsed.name);
  const name = `${stem ? `${stem}-` : ''}${hash}${extension}`;
  const page = /Page_(\d+)/i.exec(decoded)?.[1];
  if (page) {
    return `${prefix}/pages/${page}/${name}`;
  }
  const album = /PhotoAlbums\/Album(\d+)/i.exec(decoded)?.[1];
  if (album) {
    return `${prefix}/albums/${album}/${name}`;
  }
  if (/\/Videos\//i.test(decoded)) {
    return `${prefix}/videos/${name}`;
  }
  return `${prefix}/files/${name}`;
}

/** Name of a legacy image without its size suffix (`-l`, `-m`, `-t`) and extension, for spotting duplicates. */
export function imageStem(source: string): string {
  const name = path.posix.basename(decodeSafe(source).replace(/\\/g, '/')).normalize('NFC').toLowerCase();
  return name.replace(/\.[a-z0-9]+$/, '').replace(/-[lmts]$/, '');
}
