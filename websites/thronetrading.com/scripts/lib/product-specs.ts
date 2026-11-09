import { toPlainText } from '../../src/services/sanitizeService.js';

export interface ExtractedProduct {
  model: string;
  tagline: string;
  specs: { label: string; value: string }[];
  description: string;
}

interface Segment {
  html: string;
  text: string;
  consumed: boolean;
}

interface Block {
  start: number;
  end: number;
  tag: string;
  inList: boolean;
  segments: Segment[];
}

const BLOCK_PATTERN = /<(p|h[1-6]|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
const MAX_LABEL_LENGTH = 45;
const MAX_LABEL_WORDS = 7;
const MAX_VALUE_LENGTH = 140;
const MAX_PENDING_VALUE_LENGTH = 80;
const SKIPPED_LABELS = new Set(['name']);

function cleanText(html: string): string {
  return toPlainText(html)
    .replace(/[\u00a0\s]+/g, ' ')
    .trim();
}

function stripBullet(text: string): string {
  return text
    .replace(/^[-–•►]\s*/, '')
    .replace(/^\d{1,2}\.\s*(?=\D)/, '')
    .trim();
}

function tidyLabel(label: string): string {
  return label
    .replace(/\s*\*\s*/g, '×')
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s*\)\s*/g, ') ')
    .trim();
}

function tidyModel(value: string): string {
  return value
    .replace(/\s+series$/i, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .trim();
}

function parseLabel(text: string): { label: string; value: string } | null {
  const match = /^([^:]{2,60}?)\s*:\s*(.*)$/.exec(text);
  if (!match?.[1]) {
    return null;
  }
  const label = match[1].trim();
  const value = (match[2] ?? '').trim();
  if (label.length > MAX_LABEL_LENGTH || label.split(/\s+/).length > MAX_LABEL_WORDS || /[.;!?]/.test(label) || value.length > MAX_VALUE_LENGTH) {
    return null;
  }
  return { label, value };
}

function isInsideListItem(html: string, index: number): boolean {
  const before = html.slice(0, index);
  const opened = (before.match(/<li\b/gi) ?? []).length;
  const closed = (before.match(/<\/li>/gi) ?? []).length;
  return opened > closed;
}

function splitBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  for (const match of html.matchAll(BLOCK_PATTERN)) {
    const inner = match[2] ?? '';
    if (/<(p|h[1-6]|li|ul|ol|table)\b/i.test(inner)) {
      continue;
    }
    const segments = inner
      .split(/<br\s*\/?>/i)
      .map((part) => ({ html: part.trim(), text: cleanText(part), consumed: false }))
      .filter((segment) => segment.html !== '');
    const tag = (match[1] ?? 'p').toLowerCase();
    blocks.push({ start: match.index, end: match.index + match[0].length, tag, inList: tag === 'li' || isInsideListItem(html, match.index), segments });
  }
  return blocks;
}

function flattenListHeadings(html: string): string {
  return html
    .replace(/\s+style=(["'])[^"']*\1/gi, '')
    .replace(/<li>\s*<(h[1-6])>([\s\S]*?)<\/\1>\s*<\/li>/gi, '<li>$2</li>');
}

export function splitDashedListItems(html: string): string {
  return html.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (whole, inner: string) => {
    if (!/<br\s*\/?>(?:\s|&nbsp;)*[-–•]/i.test(inner)) {
      return whole;
    }
    return inner
      .split(/<br\s*\/?>(?:\s|&nbsp;)*(?:[-–•](?:\s|&nbsp;)*)?/i)
      .map((part) => part.trim().replace(/[;,]\s*$/, ''))
      .filter((part) => cleanText(part) !== '')
      .map((part) => `<li>${part}</li>`)
      .join('');
  });
}

function rebuildBlock(block: Block, original: string): string {
  const kept = block.segments.filter((segment) => !segment.consumed);
  if (kept.length === block.segments.length) {
    return original;
  }
  if (kept.length === 0) {
    return '';
  }
  if (block.tag === 'p' && kept.every((segment) => /^[-–•]\s/.test(segment.text))) {
    return `<ul>${kept.map((segment) => `<li>${segment.html.replace(/^\s*[-–•]\s*/, '')}</li>`).join('')}</ul>`;
  }
  return `<${block.tag}>${kept.map((segment) => segment.html).join('<br />')}</${block.tag}>`;
}

function tidyDescription(html: string): string {
  return splitDashedListItems(html)
    .replace(/<(h[1-6])>\s*<strong>([\s\S]*?)<\/strong>\s*<\/\1>/gi, '<$1>$2</$1>')
    .replace(/<(h[1-6])>([\s\S]*?)<\/\1>/gi, (_whole, _tag: string, inner: string) => {
      const text = cleanText(inner);
      if (text === '') {
        return '';
      }
      return text.length > 80 ? `<p>${inner.trim()}</p>` : `<h3>${inner.trim().replace(/\s*:\s*$/, '')}</h3>`;
    })
    .replace(/<p>\s*(?:<strong>)?\s*(?:<\/strong>)?\s*<\/p>/gi, '')
    .replace(/<(ul|ol)\b[^>]*>\s*<\/\1>/gi, '')
    .replace(/<a name="[^"]*"><\/a>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractProductDetails(html: string, title: string): ExtractedProduct {
  const source = flattenListHeadings(html);
  const blocks = splitBlocks(source);
  const specs: { label: string; value: string }[] = [];
  const seenLabels = new Set<string>();
  let model = '';
  let tagline = '';
  let pending: { label: string; segment: Segment } | null = null;
  const addSpec = (label: string, value: string): void => {
    const tidy = tidyLabel(label);
    const key = tidy.toLowerCase();
    if (seenLabels.has(key) || value === '') {
      return;
    }
    seenLabels.add(key);
    specs.push({ label: tidy, value: value.replace(/\s+/g, ' ').trim() });
  };

  for (const block of blocks) {
    for (const segment of block.segments) {
      const text = stripBullet(segment.text);
      if (text === '') {
        continue;
      }
      if (pending) {
        const candidate = pending;
        pending = null;
        if (!block.inList && text.length <= MAX_PENDING_VALUE_LENGTH && !text.endsWith(':')) {
          addSpec(candidate.label, text);
          candidate.segment.consumed = true;
          segment.consumed = true;
          continue;
        }
      }
      const reference = /^(.*?)\s*\bref\s*[:.]\s*([A-Za-z0-9][\w./-]*(?:\s+series)?)\s*$/i.exec(text);
      if (reference?.[2] && !model) {
        model = tidyModel(reference[2]);
        const prefix = (reference[1] ?? '').trim();
        if (prefix.length >= 8 && !tagline && specs.length === 0) {
          tagline = prefix;
        }
        segment.consumed = true;
        continue;
      }
      const parsed = parseLabel(text);
      if (parsed) {
        const key = parsed.label.toLowerCase();
        if (key === 'model' || key === 'ref' || key === 'reference') {
          if (!model && parsed.value) {
            model = tidyModel(parsed.value);
          }
          segment.consumed = true;
          continue;
        }
        if (SKIPPED_LABELS.has(key)) {
          segment.consumed = true;
          continue;
        }
        if (parsed.value === '') {
          pending = { label: parsed.label, segment };
          continue;
        }
        addSpec(parsed.label, parsed.value);
        segment.consumed = true;
        continue;
      }
      const isHeading = /^h[1-3]$/.test(block.tag) || /^<strong>[\s\S]*<\/strong>$/i.test(segment.html);
      if (!tagline && specs.length === 0 && isHeading && text.length >= 8 && text.length <= 200 && text.toLowerCase() !== title.toLowerCase() && text !== model) {
        tagline = text.replace(/\s*[.:]\s*$/, '');
        segment.consumed = true;
        continue;
      }
      if (!tagline && specs.length === 0 && (text === model || text.toLowerCase() === title.toLowerCase())) {
        segment.consumed = true;
      }
    }
  }

  let description = '';
  let cursor = 0;
  for (const block of blocks) {
    description += source.slice(cursor, block.start) + rebuildBlock(block, source.slice(block.start, block.end));
    cursor = block.end;
  }
  description += source.slice(cursor);

  const normalizedTagline = tagline.toLowerCase();
  const redundantTagline = normalizedTagline === model.toLowerCase() || normalizedTagline === title.toLowerCase();
  return { model, tagline: redundantTagline ? '' : tagline, specs, description: tidyDescription(description) };
}
