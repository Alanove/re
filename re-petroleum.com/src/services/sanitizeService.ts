import sanitizeHtml from 'sanitize-html';

// Rich text is a blocklist: authors may use any markup, attribute, class or inline style
// except what can run script, submit data, or load a foreign document.
const UNSAFE_STYLE = /expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:/i;
const UNSAFE_SRCSET = /(?:javascript|vbscript)\s*:/i;
const DROPPED_ATTRIBUTES = new Set(['srcdoc', 'formaction', 'action']);

function stripUnsafeAttributes(attribs: sanitizeHtml.Attributes): sanitizeHtml.Attributes {
  const next: sanitizeHtml.Attributes = {};
  for (const [name, value] of Object.entries(attribs)) {
    const lower = name.toLowerCase();
    if (lower.startsWith('on') || DROPPED_ATTRIBUTES.has(lower)) {
      continue;
    }
    if (lower === 'style' && UNSAFE_STYLE.test(value)) {
      continue;
    }
    if (lower === 'srcset' && UNSAFE_SRCSET.test(value)) {
      continue;
    }
    next[name] = value;
  }
  return next;
}

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    'img', 'picture', 'source', 'video', 'audio', 'track', 'iframe', 'font', 'center', 'big', 'strike', 'tt',
    'del', 'ins', 'details', 'summary'
  ],
  allowedAttributes: false,
  nonTextTags: [
    'script', 'style', 'textarea', 'option', 'xmp', 'noscript', 'template', 'svg', 'math', 'object', 'embed', 'button', 'select'
  ],
  exclusiveFilter: (frame) => frame.tag === 'iframe' && !frame.attribs.src,
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'], source: ['http', 'https'], iframe: ['https'] },
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite', 'poster', 'background', 'xlink:href', 'data'],
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
  allowProtocolRelative: false,
  transformTags: {
    '*': (tagName, attribs) => ({ tagName, attribs: stripUnsafeAttributes(attribs) }),
    a: (tagName, attribs) => {
      const next: sanitizeHtml.Attributes = { ...attribs };
      if (next.target === '_blank') {
        next.rel = 'noopener noreferrer';
      }
      return { tagName, attribs: next };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { loading: 'lazy', ...attribs } })
  }
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, RICH_TEXT_OPTIONS).trim();
}

export function toPlainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function excerpt(html: string, maxLength: number): string {
  const text = toPlainText(html);
  if (text.length <= maxLength) {
    return text;
  }
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : maxLength).trim()}…`;
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
