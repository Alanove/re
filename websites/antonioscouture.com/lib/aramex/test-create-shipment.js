/**
 * Test: Create Shipment using SOAP API in Production Mode
 * This tests the SOAP implementation of createShipment with live production endpoint
 * 
 * Updated per Aramex corrected data:
 * - PaymentType changed from 'C' (COD) to 'P' (Prepaid)
 * - PaymentOptions changed from 'CASH' to '' (empty string)
 * - Removed codAmount and codCurrency (not needed for prepaid shipments)
 */

const AramexService = require('../../src/aramex/aramex-service');

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

    allowedDomesticMethods: {
        'ONP': 'Overnight (Parcel)',
        'OND': 'Overnight (Document)'
    },

    allowedInternationalMethods: {
        'PPX': 'Priority Parcel Express',
        'EPX': 'Economy Parcel Express',
        'DPX': 'Value Express Parcels'
    },

    sandbox: false,  // Using production mode (sandbox not working)
    preferredCurrency: 'USD',
    roundUpPrice: true,
    logging: true
};

// Test shipment data
const shipmentData = {
    // Shipper (sender) - will use config defaults
    shipper: {
        reference1: 'TEST-SENDER-001',
        reference2: 'JSON-API-TEST'
    },

    // Consignee (receiver)
    consignee: {
        reference1: 'TEST-RECEIVER-001',
        name: 'John Doe',
        company: 'Test Company',
        address: {
            line1: '123 Test Street',
            line2: 'Apartment 4B'
        },
        city: 'Beirut',
        state: 'Beirut',
        postalcode: '1100',
        country: 'LB',
        phone: '+9611234567',
        email: 'test@example.com'
    },

    // Shipment items
    items: [
        {
            name: 'Test Product 1',
            quantity: 1,
            weight: 1.5,
            weightUnit: 'Kg',
            packageType: 'Box',
            commodityCode: 'TEST001'
        },
        {
            name: 'Test Product 2',
            quantity: 2,
            weight: 0.5,
            weightUnit: 'Kg',
            packageType: 'Box',
            commodityCode: 'TEST002'
        }
    ],

    // Shipment details
    productGroup: 'DOM',  // Domestic shipment
    productType: 'OND',   // Overnight Document
    paymentType: 'P',     // Prepaid (changed from COD per Aramex corrected data)
    paymentOptions: '',   // Empty string for prepaid (changed from 'CASH' per Aramex corrected data)
    // Note: codAmount and codCurrency removed - not needed for prepaid shipments
    totalWeight: 2.5,
    numberOfPieces: 3,
    descriptionOfGoods: 'Test products for JSON API verification',
    goodsOriginCountry: 'LB',

    // References
    reference1: 'ORDER-TEST-JSON-001',
    reference2: 'JSON-API-TEST',
    reference3: new Date().toISOString(),

    // Foreign HAWB - required field
    foreignHAWB: 'ORDER-TEST-JSON-001',

    // Dimensions (optional)
    dimensions: {
        length: 30,
        width: 20,
        height: 15
    },

    // Dates
    shippingDateTime: new Date(),
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow

    // Additional options
    comments: 'Test shipment via JSON API',
    pickupLocation: 'Reception'
};

async function testCreateShipment() {
    console.log('=== Testing Aramex CreateShipment (SOAP - Production Mode) ===\n');
    console.log('Configuration:');
    console.log(`  Account: ${config.accountNumber}`);
    console.log(`  Sandbox Mode: ${config.sandbox}`);
    console.log(`  From: ${config.shipper.city}, ${config.shipper.country}`);
    console.log(`  To: ${shipmentData.consignee.city}, ${shipmentData.consignee.country}`);
    console.log(`  Product: ${shipmentData.productType} (${shipmentData.productGroup})`);
    console.log(`  Weight: ${shipmentData.totalWeight} kg`);
    console.log(`  Pieces: ${shipmentData.numberOfPieces}`);
    console.log('\n');

    try {
        const service = new AramexService(config);

        console.log('Calling createShipment (SOAP API)...\n');

        const result = await service.createShipment(shipmentData);

        console.log('\n=== Shipment Created Successfully! ===');
        console.log(`✓ Shipment ID: ${result.shipmentId}`);
        console.log(`✓ Label URL: ${result.labelUrl || 'N/A'}`);
        console.log(`✓ Reference 1: ${result.reference1 || 'N/A'}`);
        console.log(`✓ Reference 2: ${result.reference2 || 'N/A'}`);
        console.log(`✓ Reference 3: ${result.reference3 || 'N/A'}`);
        console.log('\n✓ Test PASSED - CreateShipment SOAP API is working correctly!');
        console.log('\nNote: This used PRODUCTION mode - an actual shipment was created.');

    } catch (error) {
        console.error('\n✗ Test FAILED:', error.message);
        if (error.stack) {
            console.error('\nStack trace:', error.stack);
        }
        process.exit(1);
    }
}

testCreateShipment();
