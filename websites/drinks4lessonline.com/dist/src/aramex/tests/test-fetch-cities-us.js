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
async function main() {
    const country = 'US';
    console.log(`=== Aramex FetchCities (${country}, state=empty) ===\n`);
    try {
        const res = await (0, aramexApiClient_1.fetchCities)(country);
        if (res.HasErrors) {
            console.error('HasErrors:', res.Notifications);
            process.exit(1);
        }
        const list = getCityList(res);
        const count = list.length;
        console.log('Cities count:', count);
        if (list.length > 0)
            console.log('Sample:', list.slice(0, 5));
        console.log('\n✓ FetchCities (US) OK');
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
//# sourceMappingURL=test-fetch-cities-us.js.map