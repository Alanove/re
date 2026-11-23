/**
 * Test: Calculate shipping to Bouar, Lebanon
 * Domestic shipment within Lebanon (Tabarja → Bouar)
 */

const AramexService = require('./aramex-service');

const config = {
    accountCountryCode: 'LB',
    accountEntity: 'BEY',
    accountNumber: '72478367',
    accountPin: '316198',
    userName: 'info@guerrasports.com',
    password: 'Aramexguerra25#',

    shipper: {
        name: 'Guerra Sports',
        company: 'Skyline Group LLC',
        address: 'Okaibe Highway',
        city: 'Tabarja',
        state: 'Keserwan',
        postalcode: '0000',
        country: 'LB',
        phone: '+961 3446411',
        email: 'info@guerrasports.com'
    },

    // Domestic methods for Lebanon
    allowedDomesticMethods: {
        'ONP': 'Overnight (Parcel)',
        'OND': 'Overnight (Document)',
        'PEX': 'Road Express',
        'PEC': 'Economy Delivery',
        'P24': 'Road Freight 24 hours service',
        'P48': 'Road Freight 48 hours service',
        'SMP': 'Same Day (Parcel)',
        'SDD': 'Same Day Delivery'
    },

    allowedInternationalMethods: {
        'PPX': 'Priority Parcel Express',
        'EPX': 'Economy Parcel Express',
        'DPX': 'Value Express Parcels'
    },

    sandbox: false,
    preferredCurrency: 'USD',
    roundUpPrice: true,
    logging: true
};

// Destination: Bouar, Lebanon
const packageToBouar = {
    items: [
        {
            name: 'Test Product - Bouar',
            quantity: 1,
            weight: 2.0,   // kg
            length: 40,    // cm
            width: 25,
            height: 15,
            regularPrice: 75.00,
            currency: 'USD'
        }
    ],
    destination: {
        country: 'LB',
        state: 'Mount Lebanon',
        city: 'Bouar',
        postcode: '0000'
    }
};

async function testShipToBouarLebanon() {
    console.log('=== Aramex: Shipping to Bouar, Lebanon ===\n');
    console.log('Route: Tabarja (Keserwan) → Bouar, Lebanon (Domestic)');
    console.log(`Package: ${packageToBouar.items[0].weight} kg, ${packageToBouar.items[0].length}x${packageToBouar.items[0].width}x${packageToBouar.items[0].height} cm`);
    console.log('\n');

    try {
        const service = new AramexService(config);

        const rates = await service.calculateShipping(
            packageToBouar,
            'kg',
            'cm'
        );

        console.log('\n=== Results for Bouar, Lebanon ===');
        if (rates && rates.length > 0) {
            console.log(`✓ Found ${rates.length} rate(s):\n`);
            rates.forEach((rate, i) => {
                console.log(`  ${i + 1}. ${rate.label}`);
                console.log(`     Cost: ${rate.cost} ${rate.currency} (${rate.method})`);
            });
            console.log('\n✓ Test PASSED - Rates to Bouar, Lebanon are available.');
        } else {
            console.log('⚠ No rates returned for Bouar. Check that domestic methods are enabled for this route.');
        }
    } catch (error) {
        console.error('\n✗ Test FAILED:', error.message);
        process.exit(1);
    }
}

testShipToBouarLebanon();
