"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./env");
const aramexApiClient_1 = require("../aramexApiClient");
function getCityList(res) {
    const cities = res.Cities;
    if (Array.isArray(cities))
        return cities.filter((c) => typeof c === 'string');
    if (cities && typeof cities === 'object' && Array.isArray(cities.string))
        return cities.string;
    return [];
}
async function runFetchCities(country, state) {
    const res = await (0, aramexApiClient_1.fetchCities)(country, state || undefined);
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
        if (sample.length)
            console.log('Sample:', sample);
        console.log('\n✓ FetchCities OK');
        if (count === 0) {
            console.error('not ok because cities count is 0');
            process.exit(1);
        }
    }
    catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=test-fetch-cities.js.map