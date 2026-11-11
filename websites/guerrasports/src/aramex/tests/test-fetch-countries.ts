/**
 * Test FetchCountries. Run: npx ts-node src/aramex/tests/test-fetch-countries.ts
 */
import './env';
import { fetchCountries } from '../aramexApiClient';

async function main() {
  console.log('=== Aramex FetchCountries ===\n');
  try {
    const res = await fetchCountries();
    if (res.HasErrors) {
      console.error('HasErrors:', res.Notifications);
      process.exit(1);
    }
    const list = res.Countries?.Country;
    const count = Array.isArray(list) ? list.length : 0;
    console.log('Countries count:', count);
    if (Array.isArray(list) && list.length > 0) {
      console.log('Sample:', list.slice(0, 5).map((c) => `${c?.Code}: ${c?.Name}`));
    }
    console.log('\n✓ FetchCountries OK');
    if (count === 0) {
      console.error('not ok because countries count is 0');
      process.exit(1);
    }
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}
main();
