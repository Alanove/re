/**
 * Test FetchStates (e.g. US). Run: npx ts-node src/aramex/tests/test-fetch-states.ts
 */
import './env';
import { fetchStates } from '../aramexApiClient';

async function main() {
  const countryCode = 'US'; // FetchStates returns states only for certain countries (e.g. US)
  console.log(`=== Aramex FetchStates (${countryCode}) ===\n`);
  try {
    const res = await fetchStates(countryCode);
    if (res.HasErrors) {
      console.error('HasErrors:', res.Notifications);
      process.exit(1);
    }
    const states = res.States;
    const isObj = states && typeof states === 'object' && !Array.isArray(states) && 'string' in states;
    const list = isObj ? (states as { string?: string[] }).string : null;
    const count = Array.isArray(states)
      ? states.length
      : Array.isArray(list)
        ? list.length
        : 0;
    console.log('States count:', count);
    if (Array.isArray(states) && states.length > 0) {
      const sample = states.slice(0, 5).map((s: any) => `${s?.Code}: ${s?.Name ?? s?.name ?? s}`);
      console.log('Sample:', sample);
    } else if (Array.isArray(list) && list.length > 0) {
      console.log('Sample:', list.slice(0, 5));
    }
    console.log('\n✓ FetchStates OK');
    if (count === 0) {
      console.error('not ok because states count is 0 (ensure CountryCode is US and account has states data)');
      process.exit(1);
    }
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}
main();
