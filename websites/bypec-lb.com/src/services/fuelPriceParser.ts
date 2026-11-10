import { parse } from 'node-html-parser';
import { z } from 'zod';
import type { FuelProductKey } from '../domain/models.js';

/** Sane bounds for a 20 L price in Lebanese pounds; anything outside means the markup or the unit changed. */
const MIN_PRICE = 50_000;
const MAX_PRICE = 100_000_000;

const priceSchema = z.number().int().min(MIN_PRICE).max(MAX_PRICE);

const ministryPricesSchema = z.object({
  officialDate: z.iso.date().nullable(),
  prices: z.object({
    unleaded95: priceSchema,
    unleaded98: priceSchema,
    dieselVehicle: priceSchema.optional(),
    mazout: priceSchema.optional(),
    kerosene: priceSchema.optional()
  })
});
export type MinistryPrices = z.infer<typeof ministryPricesSchema>;

export class FuelPriceParseError extends Error {}

const ARABIC_INDIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

function toLatinDigits(value: string): string {
  return value.replace(ARABIC_INDIC_DIGITS, (digit) => String((digit.codePointAt(0) ?? 0) & 0xf));
}

function normalizeArabic(value: string): string {
  return toLatinDigits(value)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[\s\u00A0]+/g, ' ')
    .trim();
}

function productFor(label: string): FuelProductKey | null {
  const text = normalizeArabic(label);
  if (/98/.test(text)) {
    return 'unleaded98';
  }
  if (/95/.test(text)) {
    return 'unleaded95';
  }
  if (text.includes('ديزل')) {
    return 'dieselVehicle';
  }
  if (text.includes('مازوت')) {
    return 'mazout';
  }
  if (text === 'كاز' || text.startsWith('كاز ')) {
    return 'kerosene';
  }
  return null;
}

/** Month names after normalization, with the "ال" article removed from each word. */
const MONTHS = new Map<string, number>([
  ['كانون ثاني', 1],
  ['شباط', 2],
  ['اذار', 3],
  ['نيسان', 4],
  ['ايار', 5],
  ['حزيران', 6],
  ['تموز', 7],
  ['اب', 8],
  ['ايلول', 9],
  ['تشرين اول', 10],
  ['تشرين ثاني', 11],
  ['كانون اول', 12],
  ['يناير', 1],
  ['فبراير', 2],
  ['مارس', 3],
  ['ابريل', 4],
  ['مايو', 5],
  ['يونيو', 6],
  ['يوليو', 7],
  ['اغسطس', 8],
  ['سبتمبر', 9],
  ['اكتوبر', 10],
  ['نوفمبر', 11],
  ['ديسمبر', 12]
]);

/** Parses "الجمعة, 02 تشرين أول 2026" (weekday optional) into "2026-10-02". */
export function parseArabicDate(value: string): string | null {
  const text = normalizeArabic(value).replace(/[،,]/g, ' ');
  const match = /(\d{1,2})\s+([^\d]+?)\s+(\d{4})/.exec(text);
  if (!match) {
    return null;
  }
  const [, dayText = '', monthText = '', yearText = ''] = match;
  const monthKey = monthText
    .split(' ')
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.startsWith('ال') ? word.slice(2) : word))
    .join(' ');
  const month = MONTHS.get(monthKey);
  const day = Number(dayText);
  const year = Number(yearText);
  if (!month || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function parsePrice(value: string): number | null {
  const digits = toLatinDigits(value).replace(/[^\d]/g, '');
  if (!digits) {
    return null;
  }
  const price = Number(digits);
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

/**
 * Reads the fuel widget (`#tabFuelsPrice`) of the ministry home page. A price of 0 means the ministry
 * did not publish that product, so it is left out rather than treated as free.
 */
export function parseMinistryFuelPrices(html: string): MinistryPrices {
  const root = parse(html);
  const widget = root.querySelector('#tabFuelsPrice');
  if (!widget) {
    throw new FuelPriceParseError('The fuel price table was not found on the ministry page. Its layout may have changed.');
  }
  const prices: Partial<Record<FuelProductKey, number>> = {};
  for (const row of widget.querySelectorAll('li')) {
    const key = productFor(row.querySelector('.item')?.text ?? '');
    const price = parsePrice(row.querySelector('.price')?.text ?? '');
    if (key && price !== null && prices[key] === undefined) {
      prices[key] = price;
    }
  }
  const dateText = widget.querySelector('.date strong')?.text ?? widget.querySelector('.date')?.text ?? '';
  const result = ministryPricesSchema.safeParse({ officialDate: parseArabicDate(dateText), prices });
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.at(-1)).filter((field) => field !== undefined))].join(', ');
    throw new FuelPriceParseError(`The ministry prices did not pass validation (${fields || 'unknown field'}). Missing or out-of-range values were not saved.`);
  }
  return result.data;
}
