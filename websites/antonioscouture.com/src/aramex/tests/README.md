# Aramex API test scripts

Standalone scripts to test each Aramex JSON API. Load `.env.development` (and `.env`) and use `ARAMEX_*` variables only.

## Required env vars

- `ARAMEX_USERNAME`
- `ARAMEX_PASSWORD`
- `ARAMEX_VERSION` (e.g. `v1.0`)
- `ARAMEX_ACCOUNT_NUMBER`
- `ARAMEX_ACCOUNT_PIN`
- `ARAMEX_ACCOUNT_ENTITY` (e.g. `BEY`)
- `ARAMEX_ACCOUNT_COUNTRY_CODE` (e.g. `LB`)

Optional: `ARAMEX_LOCATION_BASE_URL`, `ARAMEX_RATE_CALCULATOR_URL`, `ARAMEX_SHIPPING_BASE_URL`, `ARAMEX_TRACKING_URL` to override base URLs.

## Run

From project root, use either **npm scripts** or **ts-node**:

### npm scripts

| Test | Command |
|------|--------|
| Fetch Countries | `npm run aramex:test:countries` |
| Fetch States (US) | `npm run aramex:test:states` |
| Fetch Cities (default LB) | `npm run aramex:test:cities` |
| Fetch Cities (US) | `npm run aramex:test:cities-us` |
| Calculate Rate (domestic LB→LB) | `npm run aramex:test:rate` |
| Calculate Rate (international LB→UAE Dubai) | `npm run aramex:test:rate-international` |
| Create Shipment | `npm run aramex:test:create-shipment` |
| Track Shipment | `npm run aramex:test:track` |
| Create Pickup | `npm run aramex:test:create-pickup` |
| All read-only (countries → states → cities → rate) | `npm run aramex:test:all` |

### ts-node (from project root)

```bash
npx ts-node src/aramex/tests/test-fetch-countries.ts
npx ts-node src/aramex/tests/test-fetch-states.ts
npx ts-node src/aramex/tests/test-fetch-cities.ts
npx ts-node src/aramex/tests/test-fetch-cities-us.ts   # US (state always sent empty)
npx ts-node src/aramex/tests/test-calculate-rate.ts
npx ts-node src/aramex/tests/test-calculate-rate-international.ts   # LB -> UAE Dubai
npx ts-node src/aramex/tests/test-create-shipment.ts
npx ts-node src/aramex/tests/test-track-shipment.ts
npx ts-node src/aramex/tests/test-create-pickup.ts
```

**Track / Create-pickup:** Set `ARAMEX_TEST_TRACKING` to a tracking number (e.g. from a create-shipment run). Create-pickup accepts one or comma-separated numbers.

## Side effects

- **Read-only**: FetchCountries, FetchCities, FetchStates, CalculateRate — safe to run repeatedly.
- **Create real data**: CreateShipment and CreatePickup create entities in Aramex. Use a test account or sandbox if available; document in this README.
