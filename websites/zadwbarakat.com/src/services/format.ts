import { toPlainText } from './sanitizeService.js';

const WORDS_PER_MINUTE = 180;

const arabicDate = new Intl.DateTimeFormat('ar-LB-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const latinDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function formatDate(iso: string, direction: 'rtl' | 'ltr' = 'rtl'): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : (direction === 'ltr' ? latinDate : arabicDate).format(date);
}

const arabicPlural = new Intl.PluralRules('ar');

/** Arabic noun forms for a count: `one` and `two` stand alone, the others follow the number. */
export interface ArabicCountForms {
  one: string;
  two: string;
  few: string;
  many: string;
  other: string;
}

/** Writes a count with the noun form Arabic grammar requires ("كتاب واحد", "كتابان", "3 كتب", "11 كتاباً", "100 كتاب"). */
export function arabicCount(count: number, forms: ArabicCountForms): string {
  const category = arabicPlural.select(count);
  if (category === 'one') {
    return forms.one;
  }
  if (category === 'two') {
    return forms.two;
  }
  const noun = category === 'few' ? forms.few : category === 'many' ? forms.many : forms.other;
  return `${count} ${noun}`;
}

export function readingMinutes(html: string): number {
  const words = toPlainText(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export interface Pagination {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

export function paginate<T>(items: readonly T[], requestedPage: number, pageSize: number): { slice: T[]; pagination: Pagination } | null {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  if (requestedPage < 1 || requestedPage > totalPages) {
    return null;
  }
  const start = (requestedPage - 1) * pageSize;
  return { slice: items.slice(start, start + pageSize), pagination: { page: requestedPage, totalPages, total: items.length, pageSize } };
}
