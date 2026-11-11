/**
 * Test FetchCities. Run: npx ts-node src/aramex/tests/test-fetch-cities.ts
 * Default: LB (no state). Set ARAMEX_TEST_COUNTRY / ARAMEX_TEST_STATE to override.
 * For US+state run: npm run aramex:test:cities-us
 */
import './env';
import { fetchCities } from '../aramexApiClient';

function getCityList(res: { Cities?: { string?: string[] } | string[] }): string[] {
  const cities = res.Cities;
  if (Array.isArray(cities)) return cities.filter((c): c is string => typeof c === 'string');
  if (cities && typeof cities === 'object' && Array.isArray(cities.string)) return cities.string;
  return [];
}

async function runFetchCities(country: string, state?: string) {
  const res = await fetchCities(country, state || undefined);
  if (res.HasErrors) {
    console.error('HasErrors:', res.Notifications);
    throw new Error('FetchCities HasErrors');
  }
  const list = getCityList(res);
  return { count: list.length, sample: list.slice(0, 5) };
}

async function main() {
  const country = process.env.ARAMEX_TEST_COUNTRY || 'LB';
  const state = process.env.ARAMEX_TEST_STATE || '';
  console.log(`=== Aramex FetchCities (${country}${state ? `, state=${state}` : ''}) ===\n`);
  try {
    const { count, sample } = await runFetchCities(country, state || undefined);
    console.log('Cities count:', count);
    if (sample.length) console.log('Sample:', sample);
    console.log('\n✓ FetchCities OK');
    if (count === 0) {
      console.error('not ok because cities count is 0');
      process.exit(1);
    }
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}
main();
