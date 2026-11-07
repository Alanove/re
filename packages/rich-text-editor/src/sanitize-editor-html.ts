/**
 * Sanitizer for editor load / source mode / templates / getHTML.
 * Blocklist only: everything an author writes in HTML mode survives the switch back to the
 * rich view except elements and attributes that can run script or load foreign documents.
 */
import { sanitizeUrl } from './url-sanitize';
import { buildVideoEmbed } from './video-providers';
import { stripEditorChrome, stripTrailingEmptyBlocks } from './template-blocks';

/** Elements removed together with their content. */
const REMOVE_SUBTREE = new Set([
  'SCRIPT',
  'NOSCRIPT',
  'STYLE',
  'TEMPLATE',
  'OBJECT',
  'EMBED',
  'APPLET',
  'FRAME',
  'FRAMESET',
  'BASE',
  'META',
  'LINK',
  'FORM',
  'INPUT',
  'BUTTON',
  'SELECT',
  'OPTION',
  'TEXTAREA',
  'SVG',
  'MATH',
]);

/** Attributes holding a URL; unsafe schemes (javascript:, vbscript:, data: links) are dropped. */
const URL_ATTRS: Record<string, 'href' | 'src'> = {
  href: 'href',
  'xlink:href': 'href',
  action: 'href',
  formaction: 'href',
  cite: 'href',
  src: 'src',
  poster: 'src',
  background: 'src',
  data: 'src',
};

const DROP_ATTRS = new Set(['srcdoc']);

const EVENT_ATTR = /^on/i;
const UNSAFE_STYLE = /expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:/i;
const UNSAFE_SRCSET = /(?:javascript|vbscript)\s*:/i;

/** Video embeds are the only iframes kept: YouTube and Vimeo players. */
function isAllowedIframeSrc(src: string): boolean {
  let url: URL;
  try {
    url = new URL(src, 'https://placeholder.local');
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (
    host === 'www.youtube.com' ||
    host === 'www.youtube-nocookie.com' ||
    host === 'player.vimeo.com'
  ) {
    return true;
  }
  return !!buildVideoEmbed(src);
}

function copySafeAttributes(source: Element, target: Element): void {
  for (const attr of Array.from(source.attributes)) {
    const name = attr.name.toLowerCase();
    if (EVENT_ATTR.test(name) || DROP_ATTRS.has(name)) {
      continue;
    }
    const urlKind = URL_ATTRS[name];
    if (urlKind) {
      const safe = sanitizeUrl(attr.value, urlKind);
      if (safe) {
        target.setAttribute(attr.name, safe);
      }
      continue;
    }
    if (name === 'style' && UNSAFE_STYLE.test(attr.value)) {
      continue;
    }
    if (name === 'srcset' && UNSAFE_SRCSET.test(attr.value)) {
      continue;
    }
    try {
      target.setAttribute(attr.name, attr.value);
    } catch {
      /* attribute names the DOM rejects are dropped */
    }
  }
}

function appendIframe(parent: ParentNode, el: Element): void {
  const rawSrc = sanitizeUrl(el.getAttribute('src'), 'src');
  if (!rawSrc || !isAllowedIframeSrc(rawSrc)) {
    return;
  }
  const iframe = document.createElement('iframe');
  copySafeAttributes(el, iframe);
  const rewritten = buildVideoEmbed(rawSrc);
  iframe.setAttribute('src', rewritten ? rewritten.embedSrc : rawSrc);
  parent.appendChild(iframe);
}

function appendSanitized(parent: ParentNode, node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    parent.appendChild(document.createTextNode(node.textContent || ''));
    return;
  }
  if (node.nodeType === Node.COMMENT_NODE) {
    parent.appendChild(document.createComment(node.textContent || ''));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const el = node as Element;
  const tag = el.tagName.toUpperCase();

  if (REMOVE_SUBTREE.has(tag)) {
    return;
  }
  if (tag === 'IFRAME') {
    appendIframe(parent, el);
    return;
  }

  let clone: Element;
  try {
    clone = document.createElement(el.tagName.toLowerCase());
  } catch {
    Array.from(el.childNodes).forEach((ch) => appendSanitized(parent, ch));
    return;
  }

  copySafeAttributes(el, clone);
  if (tag === 'A' && (clone.getAttribute('target') || '').toLowerCase() === '_blank') {
    clone.setAttribute('rel', 'noopener noreferrer');
  }

  Array.from(el.childNodes).forEach((ch) => appendSanitized(clone, ch));
  parent.appendChild(clone);
}

/**
 * Sanitize HTML intended for the contenteditable surface or form sync.
 * Requires a browser DOM (document).
 * Strips editor-only chrome (remove buttons, wrapper classes) and trailing empty blocks.
 */
export function sanitizeEditorHtml(html: string | null | undefined): string {
  if (!html) {
    return '';
  }
  if (typeof document === 'undefined') {
    return html;
  }

  const template = document.createElement('template');
  template.innerHTML = html;
  const out = document.createElement('div');
  Array.from(template.content.childNodes).forEach((ch) => appendSanitized(out, ch));
  stripEditorChrome(out);
  stripTrailingEmptyBlocks(out);
  return out.innerHTML;
}
