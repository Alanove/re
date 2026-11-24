const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'etc.']);
const COUNTRY_FIXES: Record<string, string> = {
  polland: 'Poland',
  netherland: 'Netherlands',
  usa: 'USA',
  uk: 'UK',
  uae: 'UAE'
};
const DOMAIN_TEXT = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<]*)?$/i;
const GRID_MIN_CARDS = 3;

function textOf(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function titleCaseWord(word: string, index: number): string {
  const lower = word.toLowerCase();
  if (index > 0 && SMALL_WORDS.has(lower)) {
    return lower;
  }
  const letters = word.replace(/[^a-z]/gi, '');
  if (letters.length > 0 && letters.length <= 4 && !/[aeiouy]/i.test(letters)) {
    return word.toUpperCase();
  }
  return lower.replace(/(^|[-/(])([a-z])/g, (_match, lead: string, char: string) => `${lead}${char.toUpperCase()}`);
}

export function toTitleCase(value: string): string {
  const letters = value.replace(/[^a-z]/gi, '');
  const upper = letters.replace(/[^A-Z]/g, '').length;
  if (letters.length === 0 || upper / letters.length < 0.7) {
    return value;
  }
  return value
    .split(' ')
    .map((word, index) => titleCaseWord(word, index))
    .join(' ');
}

function normalizeWhitespace(html: string): string {
  return html.replace(/&nbsp;|\u00a0/g, ' ').replace(/[ \t]{2,}/g, ' ');
}

function convertNumberedHeadings(html: string): string {
  return html.replace(/<p>((?:(?!<\/p>)[\s\S])*?)<\/p>/g, (whole, inner: string) => {
    if (!/<(strong|b)>/i.test(inner) || /<(?!\/?(?:strong|b)>)[^>]+>/i.test(inner)) {
      return whole;
    }
    const outside = inner.replace(/<(strong|b)>[\s\S]*?<\/\1>/gi, '');
    if (!/^[\s\d.]*$/.test(outside)) {
      return whole;
    }
    const match = /^(\d{1,3})\s*\.\s*(\S.*)$/.exec(textOf(inner));
    if (!match?.[2]) {
      return whole;
    }
    return `<h3>${escapeText(toTitleCase(match[2]))}</h3>`;
  });
}

function convertDashLists(html: string): string {
  return html.replace(/(?:<p>\s*[-–•]\s+(?:(?!<\/p>)[\s\S])*?<\/p>\s*)+/g, (group) => {
    const items = [...group.matchAll(/<p>\s*[-–•]\s+((?:(?!<\/p>)[\s\S])*?)<\/p>/g)]
      .map((match) => (match[1] ?? '').replace(/\s+/g, ' ').trim().replace(/\s*(?<!\betc)\.$/i, '').trim())
      .filter((item) => item !== '');
    if (items.length === 0) {
      return group;
    }
    return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>\n`;
  });
}

function convertNumberedLists(html: string): string {
  const itemPattern = /<p>\s*(\d{1,3})[.)]?\s+((?:(?!<\/p>)[\s\S])*?)<\/p>/g;
  return html.replace(/(?:<p>\s*\d{1,3}[.)]?\s+(?:(?!<\/p>)[\s\S])*?<\/p>\s*){3,}/g, (group) => {
    const matches = [...group.matchAll(itemPattern)];
    const sequential = matches.every((match, index) => Number(match[1]) === index + 1);
    if (!sequential) {
      return group;
    }
    const items = matches.map((match) => (match[2] ?? '').replace(/\s+/g, ' ').trim().replace(/\s*(?<!\betc)\.$/i, '').trim());
    return `<ol>${items.map((item) => `<li>${item}</li>`).join('')}</ol>\n`;
  });
}

function convertCapsHeadings(html: string): string {
  return html.replace(/<p>\s*<(strong|b)>((?:(?!<\/?(?:strong|b|p)>)[\s\S])*?)<\/\1>\s*<\/p>(?=\s*<(?:ul|ol)>)/g, (whole, _tag: string, inner: string) => {
    const text = textOf(inner);
    if (text === '' || text.length > 80 || /<[^>]+>/.test(inner.replace(/<br\s*\/?>/g, ''))) {
      return whole;
    }
    const titled = toTitleCase(text);
    return titled === text ? whole : `<h3>${escapeText(titled)}</h3>`;
  });
}

function removeEmptyBlocks(html: string): string {
  return html.replace(/<(h[2-6]|p)>\s*<\/\1>\s*/g, '');
}

function fixDomainLinks(html: string): string {
  return html.replace(/<a href="([^"]*)"([^>]*)>([^<]+)<\/a>/g, (whole, href: string, rest: string, text: string) => {
    const label = text.trim();
    if (!DOMAIN_TEXT.test(label) || href.startsWith('mailto:')) {
      return whole;
    }
    const target = /^https?:\/\//i.test(label) ? label : `http://${label.toLowerCase()}`;
    return `<a href="${target}"${rest}>${label}</a>`;
  });
}

function normalizeCountry(value: string): string {
  const key = value.toLowerCase();
  return COUNTRY_FIXES[key] ?? key.replace(/(^|\s)([a-z])/g, (_match, lead: string, char: string) => `${lead}${char.toUpperCase()}`);
}

function cellsOf(row: string): string[] {
  return [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((match) => match[1] ?? '');
}

function rowsOf(section: string): string[] {
  return [...section.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)].map((match) => match[0]);
}

interface ParsedTable {
  header: string[] | null;
  rows: string[][];
}

function parseTable(table: string): ParsedTable {
  const rows = rowsOf(table).map(cellsOf);
  const first = rows[0];
  if (first && first.length > 1 && textOf(first[0] ?? '') === '' && textOf(first[1] ?? '') !== '' && rows.length > 1) {
    return { header: ['#', ...first.slice(1).map((cell) => textOf(cell))], rows: rows.slice(1) };
  }
  const thead = /<thead>([\s\S]*?)<\/thead>/.exec(table);
  if (thead?.[1]) {
    const headerRow = rowsOf(thead[1])[0];
    const body = table.replace(thead[0], '');
    return { header: headerRow ? cellsOf(headerRow).map((cell) => textOf(cell)) : null, rows: rowsOf(body).map(cellsOf) };
  }
  return { header: null, rows };
}

function renderTable(table: ParsedTable): string {
  const originIndex = table.header ? table.header.findIndex((cell) => /^origin|country$/i.test(cell)) : -1;
  const head = table.header
    ? `<thead><tr>${table.header.map((cell) => `<th scope="col">${escapeText(cell)}</th>`).join('')}</tr></thead>`
    : '';
  const body = table.rows
    .map((cells) => {
      const rendered = cells.map((cell, index) => {
        const trimmed = cell.replace(/\s+/g, ' ').trim();
        return `<td>${index === originIndex ? escapeText(normalizeCountry(textOf(trimmed))) : trimmed}</td>`;
      });
      return `<tr>${rendered.join('')}</tr>`;
    })
    .join('');
  return `<div class="table-wrap"><table class="rte-table rte-table--directory">${head}<tbody>${body}</tbody></table></div>`;
}

function normalizeTables(html: string): string {
  const parts = html.split(/(<table[^>]*>[\s\S]*?<\/table>)/g);
  const output: string[] = [];
  let previous: ParsedTable | null = null;
  for (const part of parts) {
    if (/^<table/.test(part)) {
      const table = parseTable(part);
      const columns = table.rows[0]?.length ?? 0;
      if (previous?.header && !table.header && columns === previous.header.length) {
        previous.rows.push(...table.rows);
        continue;
      }
      if (previous) {
        output.push(renderTable(previous));
      }
      previous = table;
      continue;
    }
    if (previous && part.trim() !== '') {
      output.push(renderTable(previous));
      previous = null;
    }
    output.push(part);
  }
  if (previous) {
    output.push(renderTable(previous));
  }
  return output.join('');
}

function rebuildAnchorIndex(html: string): string {
  const anchors = [...html.matchAll(/<h[2-4][^>]*>\s*<a id="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h[2-4]>/g)]
    .map((match) => ({ id: match[1] ?? '', label: textOf(match[2] ?? '') }))
    .filter((anchor) => anchor.id !== '' && anchor.label !== '');
  if (anchors.length < 2) {
    return html;
  }
  return html.replace(/<ul>((?:\s*<li>\s*<a href="#[^"]+">[\s\S]*?<\/a>\s*<\/li>)+)\s*<\/ul>/, () => {
    const items = anchors.map((anchor) => `<li><a href="#${anchor.id}">${escapeText(anchor.label)}</a></li>`).join('');
    return `<ul>${items}</ul>`;
  });
}

function groupHeadingLists(html: string): string {
  const pattern = /(?:<h3>(?:(?!<\/h3>)[\s\S])*<\/h3>\s*<ul>(?:(?!<\/ul>)[\s\S])*<\/ul>\s*)+/g;
  return html.replace(pattern, (group) => {
    const cards = [...group.matchAll(/<h3>(?:(?!<\/h3>)[\s\S])*<\/h3>\s*<ul>(?:(?!<\/ul>)[\s\S])*<\/ul>/g)].map((match) => match[0]);
    if (cards.length < GRID_MIN_CARDS) {
      return group;
    }
    return `<div class="prose-grid">${cards.map((card) => `<div class="prose-card">${card}</div>`).join('')}</div>\n`;
  });
}

export function normalizeLegacyHtml(html: string): string {
  if (/class="(?:prose-grid|table-wrap)"/.test(html)) {
    return html;
  }
  let next = normalizeWhitespace(html);
  next = convertNumberedHeadings(next);
  next = convertDashLists(next);
  next = convertNumberedLists(next);
  next = convertCapsHeadings(next);
  next = removeEmptyBlocks(next);
  next = fixDomainLinks(next);
  next = normalizeTables(next);
  next = rebuildAnchorIndex(next);
  next = groupHeadingLists(next);
  return next;
}
