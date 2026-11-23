/**
 * Express.js API Server for Aramex Shipping Service
 * RESTful API for Rate Calculation, Shipment Creation, Tracking, and Label Printing
 */

const express = require('express');
const AramexService = require('./aramex-service');

const app = express();
app.use(express.json({ limit: '10mb' })); // Support file uploads for attachments

// Load configuration from environment variables
const config = {
    accountCountryCode: process.env.ARAMEX_ACCOUNT_COUNTRY_CODE || 'LB',
    accountEntity: process.env.ARAMEX_ACCOUNT_ENTITY || 'BEY',
    accountNumber: process.env.ARAMEX_ACCOUNT_NUMBER || '72478367',
    accountPin: process.env.ARAMEX_ACCOUNT_PIN || '316198',
    userName: process.env.ARAMEX_USER_NAME || 'info@guerrasports.com',
    password: process.env.ARAMEX_PASSWORD || 'Aramexguerra25#',
    
    shipper: {
        name: process.env.ARAMEX_SHIPPER_NAME || 'Guerra Sports',
        company: process.env.ARAMEX_SHIPPER_COMPANY || 'Skyline Group LLC',
        address: process.env.ARAMEX_SHIPPER_ADDRESS || 'Okaibe Highway',
        city: process.env.ARAMEX_SHIPPER_CITY || 'Tabarja',
        state: process.env.ARAMEX_SHIPPER_STATE || 'Keserwan',
        postalcode: process.env.ARAMEX_SHIPPER_POSTALCODE || '0000',
        country: process.env.ARAMEX_SHIPPER_COUNTRY || 'LB',
        phone: process.env.ARAMEX_SHIPPER_PHONE || '+961 3446411',
        email: process.env.ARAMEX_SHIPPER_EMAIL || 'info@guerrasports.com'
    },
    
    allowedDomesticMethods: {
        'BLK': 'Special: Bulk Mail Delivery',
        'BLT': 'Domestic - Bullet Delivery',
        'CDA': 'Special Delivery',
        'CDS': 'E-commerce/Special Credit Card Delivery',
        'CGO': 'Air Cargo (India)',
        'COM': 'Special: Cheque Collection',
        'DEC': 'Special: Invoice Delivery',
        'EMD': 'Early Morning delivery',
        'FIX': 'Special: Bank Branches Run',
        'LGS': 'Logistic Shipment',
        'OND': 'Overnight (Document)',
        'ONP': 'Overnight (Parcel)',
        'P24': 'Road Freight 24 hours service',
        'P48': 'Road Freight 48 hours service',
        'PEC': 'Economy Delivery',
        'PEX': 'Road Express',
        'SFC': 'Surface  Cargo (India)',
        'SMD': 'Same Day (Document)',
        'SMP': 'Same Day (Parcel)',
        'SDD': 'Same Day Delivery',
        'HVY': 'Heavy (20kgs and more)',
        'SPD': 'Special: Legal Branches Mail Service',
        'SPL': 'Special : Legal Notifications Delivery',
        'LEX': 'LEX product type'
    },
    
    allowedInternationalMethods: {
        'DPX': 'Value Express Parcels',
        'EDX': 'Economy Document Express',
        'EPX': 'Economy Parcel Express',
        'GDX': 'Ground Document Express',
        'GPX': 'Ground Parcel Express',
        'IBD': 'International defered',
        'PDX': 'Priority Document Express',
        'PLX': 'Priority Letter Express (<.5 kg Docs)',
        'PPX': 'Priority Parcel Express',
        'ABX': 'ABX',
        'PXP': 'Premium Express',
        'DGX': 'Dangerous Goods Express',
        'DGG': 'Dangerous Goods Ground'
    },
    
    sandbox: process.env.ARAMEX_SANDBOX === 'true',
    preferredCurrency: process.env.ARAMEX_CURRENCY || 'USD',
    roundUpPrice: process.env.ARAMEX_ROUND_UP !== 'false',
    reportId: parseInt(process.env.ARAMEX_REPORT_ID || '9729'),
    logging: process.env.ARAMEX_LOGGING === 'true'
};

// Initialize service
const aramexService = new AramexService(config);

/**
 * POST /api/calculate-shipping
 * Calculate shipping rates for a package
 */
app.post('/api/calculate-shipping', async (req, res) => {
    try {
        const { items, destination, weightUnit = 'kg', dimensionUnit = 'cm' } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Items array is required and must not be empty'
            });
        }

        if (!destination || !destination.country) {
            return res.status(400).json({
                success: false,
                error: 'Destination with country code is required'
            });
        }

        const rates = await aramexService.calculateShipping(
            { items, destination },
            weightUnit,
            dimensionUnit
        );

        res.json({
            success: true,
            rates: rates,
            count: rates.length
        });

    } catch (error) {
        console.error('Error calculating shipping:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * POST /api/create-shipment
 * Create a new shipment
 */
app.post('/api/create-shipment', async (req, res) => {
    try {
        const shipmentData = req.body;

        // Validate required fields
        if (!shipmentData.shipper || !shipmentData.consignee) {
            return res.status(400).json({
                success: false,
                error: 'Shipper and consignee information are required'
            });
        }

        if (!shipmentData.items || !Array.isArray(shipmentData.items) || shipmentData.items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Items array is required and must not be empty'
            });
        }

        const result = await aramexService.createShipment(shipmentData);

        res.json(result);

    } catch (error) {
        console.error('Error creating shipment:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * POST /api/track-shipments
 * Track one or more shipments
 */
app.post('/api/track-shipments', async (req, res) => {
    try {
        const { shipmentNumbers, getLastUpdateOnly = false } = req.body;

        if (!shipmentNumbers) {
            return res.status(400).json({
                success: false,
                error: 'Shipment numbers are required'
            });
        }

        const result = await aramexService.trackShipments(shipmentNumbers, getLastUpdateOnly);

        res.json(result);

    } catch (error) {
        console.error('Error tracking shipments:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * GET /api/track/:shipmentNumber
 * Track a single shipment by shipment number
 */
app.get('/api/track/:shipmentNumber', async (req, res) => {
    try {
        const { shipmentNumber } = req.params;
        const { lastUpdateOnly } = req.query;

        const result = await aramexService.trackShipments(
            shipmentNumber,
            lastUpdateOnly === 'true'
        );

        res.json(result);

    } catch (error) {
        console.error('Error tracking shipment:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * POST /api/print-label
 * Print label for a shipment
 */
app.post('/api/print-label', async (req, res) => {
    try {
        const { shipmentNumber, reference1, reportId } = req.body;

        if (!shipmentNumber) {
            return res.status(400).json({
                success: false,
                error: 'Shipment number is required'
            });
        }

        const result = await aramexService.printLabel(shipmentNumber, reference1, reportId);

        res.json(result);

    } catch (error) {
        console.error('Error printing label:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Aramex Shipping Service',
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/config
 * Get current configuration (without sensitive data)
 */
app.get('/api/config', (req, res) => {
    res.json({
        sandbox: config.sandbox,
        preferredCurrency: config.preferredCurrency,
        roundUpPrice: config.roundUpPrice,
        reportId: config.reportId,
        shipper: {
            country: config.shipper.country,
            city: config.shipper.city
        },
        allowedDomesticMethodsCount: Object.keys(config.allowedDomesticMethods).length,
        allowedInternationalMethodsCount: Object.keys(config.allowedInternationalMethods).length
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Aramex Shipping Service API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`\nAvailable endpoints:`);
    console.log(`  POST /api/calculate-shipping - Calculate shipping rates`);
    console.log(`  POST /api/create-shipment - Create a shipment`);
    console.log(`  POST /api/track-shipments - Track shipments`);
    console.log(`  GET  /api/track/:shipmentNumber - Track single shipment`);
    console.log(`  POST /api/print-label - Print shipment label`);
});

module.exports = app;
