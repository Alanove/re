export type SortType = 'number' | 'date' | 'text';
export type SortDirection = 'ascending' | 'descending';

/** Placeholder cell values that mean "no value"; they always sort after real values. */
const EMPTY_VALUES = new Set(['', '-', '–', '—', 'n/a', 'never', 'none']);

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

const NUMBER_PATTERN = /^(?:[$€£]\s?)?([-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s?(?:%|[A-Z]{3})?$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const NUMERIC_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const NAMED_MONTH_PATTERN = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})(?:,?\s+(?:at\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function normalize(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function isEmptyValue(raw: string): boolean {
  return EMPTY_VALUES.has(normalize(raw).toLowerCase());
}

export function parseNumber(raw: string): number | null {
  const match = NUMBER_PATTERN.exec(normalize(raw));
  if (!match) {
    return null;
  }
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

function utc(year: number, month: number, day: number, hour?: string, minute?: string, second?: string): number | null {
  const time = Date.UTC(year, month, day, Number(hour ?? 0), Number(minute ?? 0), Number(second ?? 0));
  const check = new Date(time);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month || check.getUTCDate() !== day) {
    return null;
  }
  return time;
}

/** ISO dates, en-GB "dd/mm/yyyy[, hh:mm[:ss]]" and "5 Mar 2026[, 14:30]". Returns a timestamp or null. */
export function parseDate(raw: string): number | null {
  const value = normalize(raw);
  if (ISO_DATE_PATTERN.test(value)) {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value.replace(' ', 'T');
    const time = Date.parse(iso);
    return Number.isNaN(time) ? null : time;
  }
  const numeric = NUMERIC_DATE_PATTERN.exec(value);
  if (numeric) {
    return utc(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]), numeric[4], numeric[5], numeric[6]);
  }
  const named = NAMED_MONTH_PATTERN.exec(value);
  if (named) {
    const month = MONTHS[named[2].toLowerCase().slice(0, 3)];
    if (month === undefined) {
      return null;
    }
    return utc(Number(named[3]), month, Number(named[1]), named[4], named[5], named[6]);
  }
  return null;
}

/** A column is numeric or a date only when every non-empty value parses that way. */
export function detectType(values: readonly string[]): SortType {
  const present = values.filter((value) => !isEmptyValue(value));
  if (present.length === 0) {
    return 'text';
  }
  if (present.every((value) => parseNumber(value) !== null)) {
    return 'number';
  }
  if (present.every((value) => parseDate(value) !== null)) {
    return 'date';
  }
  return 'text';
}

function keyFor(value: string, type: SortType): number | string | null {
  if (isEmptyValue(value)) {
    return null;
  }
  if (type === 'number') {
    return parseNumber(value);
  }
  if (type === 'date') {
    return parseDate(value);
  }
  return normalize(value);
}

/**
 * Returns the indexes of `values` in sorted order. The sort is stable, and empty values
 * stay at the end in both directions.
 */
export function sortIndexes(values: readonly string[], direction: SortDirection, type: SortType = detectType(values)): number[] {
  const factor = direction === 'ascending' ? 1 : -1;
  const keys = values.map((value) => keyFor(value, type));
  return keys
    .map((key, index) => ({ key, index }))
    .sort((a, b) => {
      if (a.key === null || b.key === null) {
        if (a.key === b.key) {
          return a.index - b.index;
        }
        return a.key === null ? 1 : -1;
      }
      const result =
        typeof a.key === 'number' && typeof b.key === 'number' ? a.key - b.key : collator.compare(String(a.key), String(b.key));
      return result === 0 ? a.index - b.index : result * factor;
    })
    .map((entry) => entry.index);
}

export function nextDirection(current: SortDirection | null): SortDirection | null {
  if (current === null) {
    return 'ascending';
  }
  return current === 'ascending' ? 'descending' : null;
}
