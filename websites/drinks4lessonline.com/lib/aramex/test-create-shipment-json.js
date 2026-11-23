/**
 * Test: Create Shipment using JSON API endpoint (UAT)
 * This tests the JSON API implementation of createShipment
 * 
 * Endpoint: https://ws.uat.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreateShipments
 * 
 * Updated per Aramex corrected data:
 * - PaymentType changed from 'C' (COD) to 'P' (Prepaid)
 * - PaymentOptions changed from 'CASH' to '' (empty string)
 * - Removed codAmount and codCurrency (not needed for prepaid shipments)
 * - Uses JSON API endpoint instead of SOAP
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

    sandbox: false,  // Not used for JSON API, but kept for consistency
    preferredCurrency: 'USD',
    roundUpPrice: true,
    logging: true
};

// Test shipment data - matching corrected Aramex format
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

    // Dates - will be converted to Microsoft Date format by the service
    shippingDateTime: new Date(),
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow

    // Additional options
    comments: 'Test shipment via JSON API',
    pickupLocation: 'Reception'
};

async function testCreateShipmentJson() {
    console.log('=== Testing Aramex CreateShipment (JSON API - UAT) ===\n');
    console.log('Configuration:');
    console.log(`  Account: ${config.accountNumber}`);
    console.log(`  Endpoint: https://ws.uat.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreateShipments`);
    console.log(`  From: ${config.shipper.city}, ${config.shipper.country}`);
    console.log(`  To: ${shipmentData.consignee.city}, ${shipmentData.consignee.country}`);
    console.log(`  Product: ${shipmentData.productType} (${shipmentData.productGroup})`);
    console.log(`  Weight: ${shipmentData.totalWeight} kg`);
    console.log(`  Pieces: ${shipmentData.numberOfPieces}`);
    console.log(`  Payment Type: ${shipmentData.paymentType} (Prepaid)`);
    console.log('\n');

    try {
        const service = new AramexService(config);

        console.log('Calling createShipmentJson (JSON API)...\n');

        const result = await service.createShipmentJson(shipmentData);

        console.log('\n=== Shipment Created Successfully! ===');
        console.log(`✓ Shipment ID: ${result.shipmentId}`);
        console.log(`✓ Label URL: ${result.labelUrl || 'N/A'}`);
        console.log(`✓ Reference 1: ${result.reference1 || 'N/A'}`);
        console.log(`✓ Reference 2: ${result.reference2 || 'N/A'}`);
        console.log(`✓ Reference 3: ${result.reference3 || 'N/A'}`);
        console.log('\n✓ Test PASSED - CreateShipment JSON API is working correctly!');
        console.log('\nNote: This used UAT JSON API endpoint - an actual shipment was created.');

    } catch (error) {
        console.error('\n✗ Test FAILED:', error.message);
        if (error.stack) {
            console.error('\nStack trace:', error.stack);
        }
        if (error.response) {
            console.error('\nResponse:', error.response);
        }
        process.exit(1);
    }
}

testCreateShipmentJson();
