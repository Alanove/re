/**
 * Display-only HTML pretty-print / collapse for the editor source textarea.
 * Pure string helpers (no DOM) so Node unit tests can load them.
 */

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'details',
  'dialog',
  'div',
  'dl',
  'dt',
  'dd',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'iframe',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const TOKEN_RE = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g;

function tagName(token: string): string | null {
  const m = token.match(/^<\/?([a-zA-Z][a-zA-Z0-9:-]*)/);
  return m ? m[1].toLowerCase() : null;
}

function isClosingTag(token: string): boolean {
  return /^<\//.test(token);
}

function isSelfClosing(token: string, name: string): boolean {
  return VOID_TAGS.has(name) || /\/\s*>$/.test(token);
}

function isBlockTag(name: string | null): boolean {
  return !!name && BLOCK_TAGS.has(name);
}

/**
 * Indent block-level markup for readable source view.
 * Inline tags stay on the same line; contents of <pre> are left unchanged.
 */
export function formatEditorHtml(html: string | null | undefined): string {
  if (!html) {
    return '';
  }

  const tokens = html.match(TOKEN_RE);
  if (!tokens) {
    return html;
  }

  const lines: string[] = [];
  let depth = 0;
  let pendingInline = '';
  let inPre = 0;

  const flushInline = () => {
    if (!pendingInline) {
      return;
    }
    const indent = '  '.repeat(Math.max(0, depth));
    const trimmed = pendingInline.replace(/^[ \t]+|[ \t]+$/g, '');
    if (trimmed) {
      lines.push(indent + trimmed);
    }
    pendingInline = '';
  };

  for (const token of tokens) {
    if (inPre > 0) {
      const name = tagName(token);
      pendingInline += token;
      if (name === 'pre' && isClosingTag(token)) {
        // Keep <pre>…</pre> as one contiguous block (no re-indent of inner lines)
        lines.push(pendingInline);
        pendingInline = '';
        inPre -= 1;
      } else if (name === 'pre' && !isClosingTag(token) && !isSelfClosing(token, name)) {
        inPre += 1;
      }
      continue;
    }

    if (token.startsWith('<!--')) {
      flushInline();
      lines.push('  '.repeat(Math.max(0, depth)) + token);
      continue;
    }

    const name = tagName(token);
    if (!name) {
      if (/^\s+$/.test(token)) {
        if (pendingInline && !/ $/.test(pendingInline)) {
          pendingInline += ' ';
        }
        continue;
      }
      pendingInline += token.replace(/\s+/g, ' ');
      continue;
    }

    const closing = isClosingTag(token);
    const selfClosing = isSelfClosing(token, name);
    const block = isBlockTag(name);

    if (block) {
      if (name === 'pre' && !closing && !selfClosing) {
        flushInline();
        // Start pre block with outer indent on the opening tag only
        pendingInline = '  '.repeat(depth) + token;
        inPre = 1;
        continue;
      }
      if (closing) {
        flushInline();
        depth = Math.max(0, depth - 1);
        lines.push('  '.repeat(depth) + token);
      } else if (selfClosing) {
        flushInline();
        lines.push('  '.repeat(depth) + token);
      } else {
        flushInline();
        lines.push('  '.repeat(depth) + token);
        depth += 1;
      }
      continue;
    }

    pendingInline += token;
  }

  flushInline();
  return lines.join('\n');
}

/**
 * Collapse pretty-printed source back to compact HTML for save / rich mode.
 * Preserves a single space between inline tags; leaves <pre> contents intact.
 */
export function collapseEditorHtml(html: string | null | undefined): string {
  if (!html) {
    return '';
  }

  const tokens = html.match(TOKEN_RE);
  if (!tokens) {
    return html.replace(/\s+/g, ' ').trim();
  }

  let out = '';
  let inPre = 0;
  let lastTagName: string | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (inPre > 0) {
      const name = tagName(token);
      out += token;
      if (name === 'pre' && isClosingTag(token)) {
        inPre -= 1;
        lastTagName = name;
      } else if (name === 'pre' && !isClosingTag(token) && !isSelfClosing(token, name)) {
        inPre += 1;
        lastTagName = name;
      } else if (name) {
        lastTagName = name;
      }
      continue;
    }

    if (token.startsWith('<!--')) {
      out += token;
      lastTagName = null;
      continue;
    }

    const name = tagName(token);
    if (!name) {
      const hasLead = /^\s/.test(token);
      const hasTrail = /\s$/.test(token);
      const trimmed = token.replace(/\s+/g, ' ').trim();

      if (!trimmed) {
        // Whitespace-only between tags: keep one space only for inline↔inline
        const nextTag = peekNextTagName(tokens, i);
        if (
          hasLead &&
          lastTagName &&
          nextTag &&
          !isBlockTag(lastTagName) &&
          !isBlockTag(nextTag)
        ) {
          if (!out.endsWith(' ')) {
            out += ' ';
          }
        }
        continue;
      }

      if (hasLead && out.endsWith('>') && !isBlockTag(lastTagName)) {
        out += ' ';
      }
      out += trimmed;
      if (hasTrail) {
        out += ' ';
      }
      continue;
    }

    if (name === 'pre' && !isClosingTag(token) && !isSelfClosing(token, name)) {
      inPre = 1;
    }

    // Drop trailing space before a block tag opening/closing
    if (out.endsWith(' ') && isBlockTag(name)) {
      out = out.slice(0, -1);
    }

    out += token;
    lastTagName = name;
  }

  return out.trim();
}

function peekNextTagName(tokens: string[], fromIndex: number): string | null {
  for (let i = fromIndex + 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('<!--')) {
      continue;
    }
    const name = tagName(t);
    if (name) {
      return name;
    }
    if (!/^\s*$/.test(t)) {
      return null; // text content follows
    }
  }
  return null;
}
