import sanitizeHtml from 'sanitize-html';

const CMS_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img',
    'h1',
    'h2',
    'span',
    'div',
    'figure',
    'figcaption',
    'section',
    'article',
    'header',
    'footer',
    'nav',
    'iframe',
    'video',
    'source',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'colgroup',
    'col'
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['class', 'id', 'style'],
    a: ['href', 'name', 'target', 'rel', 'title'],
    img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
    iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'title'],
    video: ['src', 'controls', 'width', 'height', 'poster'],
    source: ['src', 'type'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan']
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
    iframe: ['http', 'https']
  },
  allowProtocolRelative: false
};

/**
 * Sanitize CMS HTML before save/render to reduce stored XSS risk.
 */
export function sanitizeCmsHtml(html: string): string {
  if (!html) {
    return '';
  }
  return sanitizeHtml(html, CMS_SANITIZE_OPTIONS);
}
