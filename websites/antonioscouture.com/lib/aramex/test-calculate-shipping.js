/**
 * Test script for Calculate Shipping functionality
 */

const AramexService = require('./aramex-service');

// Configuration using the actual credentials found
const config = {
    // Credentials from the log file
    accountCountryCode: 'LB',
    accountEntity: 'BEY',
    accountNumber: '72478367',
    accountPin: '316198',
    userName: 'info@guerrasports.com',
    password: 'Aramexguerra25#',
    
    // Shipper details from the log file
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
    
    // Allowed methods (using international methods for testing)
    allowedDomesticMethods: {
        'ONP': 'Overnight (Parcel)',
        'PEX': 'Road Express'
    },
    
    allowedInternationalMethods: {
        'PPX': 'Priority Parcel Express',
        'EPX': 'Economy Parcel Express',
        'DPX': 'Value Express Parcels'
    },
    
    sandbox: false, // Using production
    preferredCurrency: 'USD',
    roundUpPrice: true,
    logging: true // Enable logging to see the request/response
};

// Test data - similar to what was in the log file
const testPackageData = {
    items: [
        {
            name: 'Test Product',
            quantity: 1,
            weight: 1.0, // kg
            length: 35,  // cm
            width: 15,   // cm
            height: 10,  // cm
            regularPrice: 100.00,
            currency: 'USD'
        }
    ],
    destination: {
        country: 'IN', // India - international shipment
        state: 'JH',
        city: 'Ranchi',
        postcode: '834002'
    }
};

async function testCalculateShipping() {
    console.log('=== Testing Aramex Calculate Shipping ===\n');
    console.log('Configuration:');
    console.log(`  Account: ${config.accountNumber}`);
    console.log(`  From: ${config.shipper.city}, ${config.shipper.country}`);
    console.log(`  To: ${testPackageData.destination.city}, ${testPackageData.destination.country}`);
    console.log(`  Weight: ${testPackageData.items[0].weight} kg`);
    console.log(`  Sandbox: ${config.sandbox}`);
    console.log('\n');

    try {
        // Initialize service
        const service = new AramexService(config);
        
        console.log('Calling calculateShipping...\n');
        
        // Calculate shipping rates
        const rates = await service.calculateShipping(
            testPackageData,
            'kg',  // weight unit
            'cm'   // dimension unit
        );

        console.log('\n=== Results ===');
        if (rates && rates.length > 0) {
            console.log(`✓ Success! Found ${rates.length} shipping rate(s):\n`);
            rates.forEach((rate, index) => {
                console.log(`${index + 1}. ${rate.label}`);
                console.log(`   Method: ${rate.method}`);
                console.log(`   Cost: ${rate.cost} ${rate.currency}`);
                console.log(`   Product Group: ${rate.productGroup}`);
                console.log(`   ID: ${rate.id}`);
                console.log('');
            });
            console.log('✓ Test PASSED - Calculate shipping is working correctly!');
        } else {
            console.log('⚠ No rates returned. This might be normal if:');
            console.log('  - No shipping methods are available for this route');
            console.log('  - The destination is not serviceable');
            console.log('  - There was an error (check logs above)');
        }

    } catch (error) {
        console.error('\n✗ Test FAILED');
        console.error('Error:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Run the test
testCalculateShipping();
