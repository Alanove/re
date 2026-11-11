/**
 * Test TrackShipments. Requires a tracking number (e.g. from test-create-shipment or ARAMEX_TEST_TRACKING).
 * Run: npx ts-node src/aramex/tests/test-track-shipment.ts
 */
import './env';
import { trackShipments } from '../aramexApiClient';

async function main() {
  const tracking = process.env.ARAMEX_TEST_TRACKING || '50788640766';
  if (!tracking.trim()) {
    console.error('Set ARAMEX_TEST_TRACKING or run test-create-shipment first and use its tracking ID.');
    process.exit(1);
  }
  console.log('=== Aramex TrackShipments ===\n');
  try {
    const res = await trackShipments([tracking.trim()], false);
    if (res.HasErrors) {
      console.error('HasErrors:', res.Notifications);
      process.exit(1);
    }
    console.log('TrackingResults:', JSON.stringify(res.TrackingResults, null, 2));
    console.log('\n✓ TrackShipments OK');
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}
main();
