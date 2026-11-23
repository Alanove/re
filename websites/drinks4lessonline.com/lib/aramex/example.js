/**
 * Example usage of Aramex Shipping Service
 * Run with: node example.js
 */

const AramexService = require('./aramex-service');

// Configuration
const config = {
    // Credentials
    accountCountryCode: 'LB',
    accountEntity: 'BEY',
    accountNumber: '72478367',
    accountPin: '316198',
    userName: 'info@guerrasports.com',
    password: 'Aramexguerra25#',
    
    // Shipper details
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
    
    // Allowed methods (simplified for example)
    allowedDomesticMethods: {
        'ONP': 'Overnight (Parcel)',
        'PEX': 'Road Express'
    },
    
    allowedInternationalMethods: {
        'PPX': 'Priority Parcel Express',
        'EPX': 'Economy Parcel Express'
    },
    
    sandbox: false,
    preferredCurrency: 'USD',
    roundUpPrice: true,
    logging: true
};

// Initialize service
const service = new AramexService(config);

async function runExamples() {
    console.log('=== Aramex Shipping Service Examples ===\n');

    // Example 1: Calculate Shipping Rates
    console.log('1. Calculating shipping rates...');
    try {
        const packageData = {
            items: [
                {
                    name: 'Test Product',
                    quantity: 2,
                    weight: 1.5,
                    length: 35,
                    width: 15,
                    height: 10,
                    regularPrice: 50.00,
                    salePrice: 45.00,
                    currency: 'USD'
                }
            ],
            destination: {
                country: 'IN',
                state: 'JH',
                city: 'Ranchi',
                postcode: '834002'
            }
        };

        const rates = await service.calculateShipping(packageData, 'kg', 'cm');
        console.log('Rates:', JSON.stringify(rates, null, 2));
    } catch (error) {
        console.error('Error calculating rates:', error.message);
    }

    console.log('\n---\n');

    // Example 2: Create Shipment
    console.log('2. Creating shipment...');
    try {
        const shipmentData = {
            shipper: {
                reference1: 'REF001',
                name: 'Guerra Sports',
                company: 'Skyline Group LLC',
                address: { line1: 'Okaibe Highway' },
                city: 'Tabarja',
                state: 'Keserwan',
                postalcode: '0000',
                country: 'LB',
                phone: '+961 3446411',
                email: 'info@guerrasports.com'
            },
            consignee: {
                reference1: 'REF002',
                name: 'John Doe',
                company: 'Receiver Company',
                address: { line1: '123 Main Street' },
                city: 'Mumbai',
                state: 'Maharashtra',
                postalcode: '400001',
                country: 'IN',
                phone: '+911234567890',
                email: 'receiver@example.com'
            },
            items: [
                {
                    name: 'Test Product',
                    quantity: 1,
                    weight: 1.5,
                    length: 30,
                    width: 20,
                    height: 10,
                    price: 100.00,
                    currency: 'USD',
                    weightUnit: 'kg',
                    dimensionUnit: 'cm'
                }
            ],
            productGroup: 'EXP',
            productType: 'PPX',
            paymentType: 'P',
            totalWeight: 1.5,
            weightUnit: 'kg',
            numberOfPieces: 1,
            descriptionOfGoods: 'Test shipment',
            goodsOriginCountry: 'LB',
            reference1: 'ORDER-001'
        };

        const result = await service.createShipment(shipmentData);
        console.log('Shipment created:', JSON.stringify(result, null, 2));
        
        // Example 3: Track the shipment
        if (result.shipmentId) {
            console.log('\n3. Tracking shipment...');
            const trackingResult = await service.trackShipments(result.shipmentId);
            console.log('Tracking result:', JSON.stringify(trackingResult, null, 2));
        }
    } catch (error) {
        console.error('Error creating shipment:', error.message);
    }

    console.log('\n---\n');

    // Example 4: Track Existing Shipment
    console.log('4. Tracking existing shipment...');
    try {
        // Replace with an actual shipment number
        const shipmentNumber = '1234567890';
        const trackingResult = await service.trackShipments(shipmentNumber);
        console.log('Tracking result:', JSON.stringify(trackingResult, null, 2));
    } catch (error) {
        console.error('Error tracking shipment:', error.message);
    }

    console.log('\n---\n');

    // Example 5: Print Label
    console.log('5. Printing label...');
    try {
        // Replace with an actual shipment number
        const shipmentNumber = '1234567890';
        const labelResult = await service.printLabel(shipmentNumber, 'ORDER-001');
        console.log('Label URL:', labelResult.labelUrl);
    } catch (error) {
        console.error('Error printing label:', error.message);
    }
}

// Run examples
runExamples().catch(console.error);
