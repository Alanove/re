/**
 * Shared URL scheme checks for links, images, and paste sanitization.
 */

export type UrlKind = 'href' | 'src';

/**
 * Rejects javascript:/vbscript:; rejects data: for hrefs.
 * Returns the trimmed URL, or null when unsafe/empty.
 */
export function sanitizeUrl(value: unknown, kind: UrlKind): string | null {
  if (value == null || typeof value !== 'string') {
    return null;
  }
  const t = value.trim();
  if (!t) {
    return null;
  }
  // Browsers ignore whitespace and control characters inside a scheme (`java\tscript:`).
  const lower = t.replace(/[\u0000-\u0020\u007f-\u009f]/g, '').slice(0, 11).toLowerCase();
  if (lower.indexOf('javascript:') === 0 || lower.indexOf('vbscript:') === 0) {
    return null;
  }
  if (kind === 'href' && lower.indexOf('data:') === 0) {
    return null;
  }
  return t;
}

/** Escape a value for use inside a double-quoted HTML attribute. */
export function escapeHtmlAttr(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface ImgHtmlAttrs {
  src: string;
  alt?: string;
  className?: string;
  width?: string | number;
  height?: string | number;
  style?: string;
}

/** Build an &lt;img&gt; tag with attribute-escaped values. */
export function buildImgHtml(attrs: ImgHtmlAttrs): string {
  const src = sanitizeUrl(attrs.src, 'src');
  if (!src) {
    return '';
  }
  let tag = `<img src="${escapeHtmlAttr(src)}"`;
  if (attrs.alt) {
    tag += ` alt="${escapeHtmlAttr(attrs.alt)}"`;
  }
  if (attrs.className) {
    tag += ` class="${escapeHtmlAttr(attrs.className)}"`;
  }
  if (attrs.width != null && attrs.width !== '') {
    tag += ` width="${escapeHtmlAttr(String(attrs.width))}"`;
  }
  if (attrs.height != null && attrs.height !== '') {
    tag += ` height="${escapeHtmlAttr(String(attrs.height))}"`;
  }
  if (attrs.style) {
    tag += ` style="${escapeHtmlAttr(attrs.style)}"`;
  }
  return tag + '>';
}
