/**
 * Fetch countries from Aramex Location API and write to data/countries.json.
 * Requires .env (e.g. .env.development) with ARAMEX_USERNAME, ARAMEX_PASSWORD, etc.
 * Run: npm run aramex:fetch-countries  or  npx ts-node scripts/aramex-fetch-countries.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import dotenv from 'dotenv';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { XMLParser } from 'fast-xml-parser';
import { fetchCountries } from '../src/aramex/aramexApiClient';

/** Normalized country: always has name and code; all other API fields preserved for future use. */
export type CountryRecord = { name: string; code: string; [key: string]: unknown };

function toFullItem(c: Record<string, unknown> | null | undefined): CountryRecord | null {
  if (!c || typeof c !== 'object') return null;
  const code = (c.Code ?? c.code ?? '').toString().trim();
  const name = (c.Name ?? c.name ?? '').toString().trim();
  if (!code || !name) return null;
  // Build object: normalized name/code first (backward compat), then all other API fields
  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(c)) {
    const k = key as string;
    if (k === 'Code' || k === 'code' || k === 'Name' || k === 'name') continue;
    rest[k] = c[k];
  }
  return { name, code, ...rest };
}

function getCountryArray(r: Record<string, unknown>): Record<string, unknown>[] {
  const countries = r.Countries as Record<string, unknown> | undefined;
  if (countries) {
    const country = countries.Country;
    if (Array.isArray(country)) return country as Record<string, unknown>[];
    if (country && typeof country === 'object') return [country as Record<string, unknown>];
  }
  const lower = r.countries as Record<string, unknown> | undefined;
  if (lower) {
    const country = lower.country;
    if (Array.isArray(country)) return country as Record<string, unknown>[];
    if (country && typeof country === 'object') return [country as Record<string, unknown>];
  }
  for (const key of Object.keys(r)) {
    if (key === 'HasErrors' || key === 'Notifications') continue;
    const val = r[key];
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0] as Record<string, unknown>;
      if (first && (first.Code != null || first.code != null || first.Name != null || first.name != null)) {
        return val as Record<string, unknown>[];
      }
    }
  }
  return [];
}

function normalizeCountries(response: unknown): CountryRecord[] {
  const r = (response && typeof response === 'object' ? response : {}) as Record<string, unknown>;
  const rawList = getCountryArray(r);
  const list: CountryRecord[] = [];
  for (const c of rawList) {
    const item = toFullItem(c);
    if (item) list.push(item);
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

/** If the API returned XML (string), parse it into a JSON-like structure we can normalize. */
function ensureObject(response: unknown): Record<string, unknown> {
  if (typeof response === 'string' && response.trim().startsWith('<')) {
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(response) as Record<string, unknown>;
    // Unwrap common roots e.g. FetchCountriesResponse or Body
    const root = parsed.FetchCountriesResponse ?? parsed.Body ?? parsed;
    return (root && typeof root === 'object' ? root : parsed) as Record<string, unknown>;
  }
  return (response && typeof response === 'object' ? response : {}) as Record<string, unknown>;
}

async function main() {
  console.log('Fetching countries from Aramex...');
  const raw: unknown = await fetchCountries();
  const response = ensureObject(raw);
  if (response.HasErrors === true) {
    const notifs = (response as { Notifications?: { Notification?: Array<{ Code?: string; Message?: string }> } }).Notifications?.Notification;
    const msg = Array.isArray(notifs) ? notifs.map((n) => `${n?.Code}: ${n?.Message}`).join('; ') : 'Unknown error';
    throw new Error(`Aramex FetchCountries error: ${msg}`);
  }
  const countries = normalizeCountries(response);
  console.log(`Got ${countries.length} countries.`);

  if (countries.length === 0) {
    console.warn('Countries list is empty. Response top-level keys:', Object.keys(response));
    if (response.Countries) console.warn('Countries:', Array.isArray(response.Countries) ? 'array' : typeof response.Countries, Object.keys(response.Countries as object));
    throw new Error('No countries parsed from Aramex response. Check response shape or API changes.');
  }

  const dataPath = path.resolve(process.cwd(), 'data', 'countries.json');
  fs.writeFileSync(dataPath, JSON.stringify({ countries }, null, 2), 'utf-8');
  console.log(`Wrote ${dataPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
