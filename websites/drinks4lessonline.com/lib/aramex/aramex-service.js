/**
 * Aramex Shipping Service - Complete Node.js Implementation
 * Includes: Rate Calculation, Shipment Creation, Tracking, and Label Printing
 */

const soap = require('soap');
const https = require('https');
const { URL } = require('url');

class AramexService {
    constructor(config) {
        this.config = {
            // Client credentials
            accountCountryCode: config.accountCountryCode,
            accountEntity: config.accountEntity,
            accountNumber: config.accountNumber,
            accountPin: config.accountPin,
            userName: config.userName,
            password: config.password,
            
            // Shipper details
            shipper: {
                name: config.shipper?.name || '',
                company: config.shipper?.company || '',
                address: config.shipper?.address || '',
                city: config.shipper?.city || '',
                state: config.shipper?.state || '',
                postalcode: config.shipper?.postalcode || '',
                country: config.shipper?.country || '',
                phone: config.shipper?.phone || '',
                email: config.shipper?.email || ''
            },
            
            // Allowed shipping methods
            allowedDomesticMethods: config.allowedDomesticMethods || {},
            allowedInternationalMethods: config.allowedInternationalMethods || {},
            
            // Settings
            sandbox: config.sandbox || false,
            preferredCurrency: config.preferredCurrency || 'USD',
            roundUpPrice: config.roundUpPrice !== false,
            reportId: config.reportId || 9729,
            logging: config.logging || false
        };
        
        // WSDL URLs
        this.wsdlUrls = {
            production: {
                rates: 'https://ws.aramex.net/ShippingAPI.V2/RateCalculator/Service_1_0.svc?wsdl',
                shipping: 'https://ws.aramex.net/shippingapi/shipping/service_1_0.svc?wsdl',
                tracking: 'http://ws.aramex.net/shippingapi/tracking/service_1_0.svc?wsdl'
            },
            sandbox: {
                rates: 'https://ws.dev.aramex.net/ShippingAPI.V2/RateCalculator/Service_1_0.svc?wsdl',
                shipping: 'https://ws.dev.aramex.net/shippingapi/shipping/service_1_0.svc?wsdl',
                tracking: 'https://ws.dev.aramex.net/ShippingAPI.V2/Tracking/Service_1_0.svc?wsdl'
            }
        };
    }

    /**
     * Get client info for API authentication
     * Note: Order matters for SOAP serialization - UserName must come first
     */
    getClientInfo() {
        // Using array to preserve order (then converting to object)
        // The API expects UserName first, then Password, then other fields
        const clientInfo = {};
        clientInfo.UserName = this.config.userName;
        clientInfo.Password = this.config.password;
        clientInfo.Version = '1.0';
        clientInfo.AccountNumber = this.config.accountNumber;
        clientInfo.AccountPin = this.config.accountPin;
        clientInfo.AccountEntity = this.config.accountEntity;
        clientInfo.AccountCountryCode = this.config.accountCountryCode;
        clientInfo.Source = 52;
        return clientInfo;
    }

    /**
     * Calculate shipping rates for a package
     */
    async calculateShipping(packageData, weightUnit = 'kg', dimensionUnit = 'cm') {
        try {
            // Normalize weight unit
            if (weightUnit === 'lbs') {
                weightUnit = 'lb';
            }

            // Calculate package totals
            const packageInfo = this.calculatePackageInfo(packageData.items, weightUnit, dimensionUnit);
            
            // Determine if domestic or international
            const isDomestic = this.config.shipper.country.toLowerCase() === 
                             packageData.destination.country.toLowerCase();
            
            const productGroup = isDomestic ? 'DOM' : 'EXP';
            const allowedMethods = isDomestic 
                ? this.config.allowedDomesticMethods 
                : this.config.allowedInternationalMethods;

            if (!allowedMethods || Object.keys(allowedMethods).length === 0) {
                return [];
            }

            // Get WSDL URL
            const wsdlUrl = this.config.sandbox 
                ? this.wsdlUrls.sandbox.rates 
                : this.wsdlUrls.production.rates;

            // Create SOAP client
            const client = await soap.createClientAsync(wsdlUrl);

            const rates = [];

            // Calculate rate for each allowed method
            for (const [methodKey, methodName] of Object.entries(allowedMethods)) {
                try {
                    const rate = await this.calculateRateForMethod(
                        client,
                        methodKey,
                        methodName,
                        packageInfo,
                        packageData.destination,
                        productGroup,
                        weightUnit,
                        dimensionUnit
                    );

                    if (rate) {
                        rates.push(rate);
                    }
                } catch (error) {
                    if (this.config.logging) {
                        console.error(`Error calculating rate for method ${methodKey}:`, error.message);
                    }
                }
            }

            return rates;

        } catch (error) {
            console.error('Error in calculateShipping:', error);
            throw error;
        }
    }

    /**
     * Calculate package information from items
     */
    calculatePackageInfo(items, weightUnit, dimensionUnit) {
        let totalWeight = 0;
        let totalQuantity = 0;
        const itemDetails = [];
        const dimensionsLengths = [];
        const dimensionsWidths = [];
        let totalHeight = 0;

        for (const item of items) {
            const weight = parseFloat(item.weight || 0);
            const quantity = parseInt(item.quantity || 1);
            
            totalWeight += weight * quantity;
            totalQuantity += quantity;

            const length = parseFloat(item.length || 0);
            const width = parseFloat(item.width || 0);
            const height = parseFloat(item.height || 0);
            
            totalHeight += height;
            dimensionsLengths.push(length);
            dimensionsWidths.push(width);

            const price = parseFloat(item.salePrice || item.regularPrice || 0);

            // Build item in the exact order expected by WSDL
            const itemDetail = {
                PackageType: '', // Required field, empty string is acceptable
                Quantity: quantity,
                Weight: {
                    Unit: weightUnit,
                    Value: weight
                }
            };
            
            // Add optional fields
            if (item.name) {
                itemDetail.GoodsDescription = item.name;
            }
            if (price > 0) {
                itemDetail.CustomsValue = {
                    CurrencyCode: item.currency || this.config.preferredCurrency,
                    Value: price
                };
            }
            if (length > 0 || width > 0 || height > 0) {
                itemDetail.PiecesDimensions = {
                    Dimensions: {
                        Length: length,
                        Width: width,
                        Height: height,
                        Unit: dimensionUnit
                    }
                };
            }
            
            itemDetails.push(itemDetail);
        }

        return {
            totalWeight,
            totalQuantity,
            itemDetails,
            dimensions: {
                length: Math.max(...dimensionsLengths, 0),
                width: Math.max(...dimensionsWidths, 0),
                height: totalHeight
            },
            dimensionUnit
        };
    }

    /**
     * Calculate rate for a specific shipping method
     */
    async calculateRateForMethod(
        client,
        methodKey,
        methodName,
        packageInfo,
        destination,
        productGroup,
        weightUnit,
        dimensionUnit
    ) {
        // Build params in the exact order expected by the WSDL
        const params = {
            ClientInfo: this.getClientInfo(),
            Transaction: {
                Reference1: '',
                Reference2: '',
                Reference3: '',
                Reference4: '',
                Reference5: ''
            },
            OriginAddress: {
                Line1: '',
                Line2: '',
                Line3: '',
                City: this.config.shipper.city || '',
                StateOrProvinceCode: this.config.shipper.state || '',
                PostCode: (this.config.shipper.postalcode || '').replace(/\s/g, ''),
                CountryCode: this.config.shipper.country || ''
            },
            DestinationAddress: {
                Line1: '',
                Line2: '',
                Line3: '',
                City: destination.city || '',
                StateOrProvinceCode: destination.state || '',
                PostCode: (destination.postcode || '').replace(/\s/g, ''),
                CountryCode: destination.country || ''
            },
            ShipmentDetails: {
                Dimensions: {
                    Length: packageInfo.dimensions.length,
                    Width: packageInfo.dimensions.width,
                    Height: packageInfo.dimensions.height,
                    Unit: dimensionUnit
                },
                ActualWeight: {
                    Unit: weightUnit,
                    Value: packageInfo.totalWeight
                },
                ChargeableWeight: {
                    Unit: weightUnit,
                    Value: packageInfo.totalWeight
                },
                DescriptionOfGoods: '',
                GoodsOriginCountry: this.config.shipper.country || '',
                NumberOfPieces: packageInfo.totalQuantity,
                ProductGroup: productGroup,
                ProductType: methodKey,
                PaymentType: 'P',
                PaymentOptions: '',
                Services: '',
                Items: {
                    ShipmentItem: packageInfo.itemDetails
                }
            },
            PreferredCurrencyCode: this.config.preferredCurrency
        };

        if (this.config.logging) {
            console.log('CalculateRate API Request:', JSON.stringify(params, null, 2));
        }

        const [result] = await client.CalculateRateAsync(params);

        if (this.config.logging) {
            console.log('CalculateRate API Response:', JSON.stringify(result, null, 2));
        }

        if (result.HasErrors) {
            const notifications = result.Notifications?.Notification;
            
            if (Array.isArray(notifications)) {
                const errors = notifications
                    .filter(n => n.Code !== 'ERR20' && n.Code !== 'ERR61')
                    .map(n => `${n.Code} - ${n.Message}`);
                
                if (errors.length > 0) {
                    throw new Error(`Aramex: ${errors.join(' | ')}`);
                }
            } else if (notifications) {
                if (notifications.Code === 'ERR20' || notifications.Code === 'ERR61') {
                    return null;
                }
                throw new Error(`Aramex: ${notifications.Code} - ${notifications.Message}`);
            }
            
            return null;
        }

        let price = parseFloat(result.TotalAmount?.Value || 0);
        const currency = result.TotalAmount?.CurrencyCode || this.config.preferredCurrency;

        if (this.config.roundUpPrice) {
            price = Math.ceil(price);
        }

        return {
            id: `${methodKey}_aramex`,
            label: methodName ? `Aramex ${methodName}` : 'Aramex',
            cost: price,
            currency: currency,
            method: methodKey,
            productGroup: productGroup
        };
    }

    /**
     * Create a shipment
     */
    async createShipment(shipmentData) {
        try {
            const wsdlUrl = this.config.sandbox 
                ? this.wsdlUrls.sandbox.shipping 
                : this.wsdlUrls.production.shipping;

            const client = await soap.createClientAsync(wsdlUrl, {
                soap_version: 1
            });

            // Capture SOAP XML request for debugging
            let soapXmlRequest = null;
            client.on('request', function(xml, eid) {
                soapXmlRequest = xml;
                if (this.config.logging) {
                    console.log('=== SOAP XML REQUEST ===');
                    console.log(xml);
                    console.log('=== END SOAP XML ===');
                }
            }.bind(this));

            // Build shipment parameters
            const params = this.buildShipmentParams(shipmentData);

            if (this.config.logging) {
                console.log('CreateShipments API Request (JSON):', JSON.stringify(params, null, 2));
            }

            const [result] = await client.CreateShipmentsAsync(params);

            if (this.config.logging) {
                console.log('CreateShipments API Response:', JSON.stringify(result, null, 2));
            }

            if (result.HasErrors) {
                const errors = this.extractErrors(result);
                throw new Error(`Aramex CreateShipment Error: ${errors.join(' | ')}`);
            }

            const processedShipment = result.Shipments?.ProcessedShipment;
            
            if (!processedShipment) {
                throw new Error('No shipment data returned from API');
            }

            return {
                success: true,
                shipmentId: processedShipment.ID,
                labelUrl: processedShipment.ShipmentLabel?.LabelURL || null,
                reference1: processedShipment.Reference1,
                reference2: processedShipment.Reference2,
                reference3: processedShipment.Reference3
            };

        } catch (error) {
            console.error('Error creating shipment:', error);
            // Attach SOAP XML to error for debugging
            if (soapXmlRequest) {
                error.soapXmlRequest = soapXmlRequest;
            }
            throw error;
        }
    }

    /**
     * Convert JavaScript Date or timestamp to Microsoft Date format (/Date(timestamp)/)
     */
    convertToMicrosoftDate(date) {
        if (!date) return null;
        let timestamp;
        if (date instanceof Date) {
            timestamp = date.getTime();
        } else if (typeof date === 'number') {
            // Already a timestamp (milliseconds)
            timestamp = date;
        } else {
            // Try to parse as date string
            timestamp = new Date(date).getTime();
        }
        return `/Date(${timestamp})/`;
    }

    /**
     * Create a shipment using JSON API endpoint (UAT)
     * Uses HTTP POST with JSON instead of SOAP
     */
    async createShipmentJson(shipmentData) {
        try {
            const endpointUrl = 'https://ws.uat.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreateShipments';
            
            // Build shipment parameters using the same structure as SOAP
            const params = this.buildShipmentParams(shipmentData);
            
            // Convert dates to Microsoft Date format for JSON API
            if (params.Shipments && params.Shipments.length > 0) {
                const shipment = params.Shipments[0];
                // Convert Unix timestamp (seconds) to milliseconds for Microsoft Date format
                if (shipment.ShippingDateTime) {
                    const timestamp = typeof shipment.ShippingDateTime === 'number' 
                        ? shipment.ShippingDateTime * 1000  // Convert seconds to milliseconds
                        : shipment.ShippingDateTime;
                    shipment.ShippingDateTime = this.convertToMicrosoftDate(timestamp);
                }
                if (shipment.DueDate) {
                    const timestamp = typeof shipment.DueDate === 'number' 
                        ? shipment.DueDate * 1000  // Convert seconds to milliseconds
                        : shipment.DueDate;
                    shipment.DueDate = this.convertToMicrosoftDate(timestamp);
                }
            }

            const requestBody = JSON.stringify(params);

            if (this.config.logging) {
                console.log('CreateShipments JSON API Request:', JSON.stringify(params, null, 2));
                console.log('Endpoint:', endpointUrl);
            }

            return new Promise((resolve, reject) => {
                const url = new URL(endpointUrl);
                
                const options = {
                    hostname: url.hostname,
                    port: url.port || 443,
                    path: url.pathname + url.search,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(requestBody)
                    }
                };

                const req = https.request(options, (res) => {
                    let responseData = '';

                    res.on('data', (chunk) => {
                        responseData += chunk;
                    });

                    res.on('end', () => {
                        try {
                            const result = JSON.parse(responseData);

                            if (this.config.logging) {
                                console.log('CreateShipments JSON API Response:', JSON.stringify(result, null, 2));
                            }

                            if (result.HasErrors) {
                                const errors = this.extractErrors(result);
                                reject(new Error(`Aramex CreateShipment Error: ${errors.join(' | ')}`));
                                return;
                            }

                            const processedShipment = result.Shipments?.ProcessedShipment || 
                                                      (Array.isArray(result.Shipments) ? result.Shipments[0] : null);
                            
                            if (!processedShipment) {
                                reject(new Error('No shipment data returned from API'));
                                return;
                            }

                            resolve({
                                success: true,
                                shipmentId: processedShipment.ID,
                                labelUrl: processedShipment.ShipmentLabel?.LabelURL || null,
                                reference1: processedShipment.Reference1,
                                reference2: processedShipment.Reference2,
                                reference3: processedShipment.Reference3
                            });
                        } catch (parseError) {
                            reject(new Error(`Failed to parse response: ${parseError.message}. Response: ${responseData}`));
                        }
                    });
                });

                req.on('error', (error) => {
                    reject(new Error(`Request failed: ${error.message}`));
                });

                req.write(requestBody);
                req.end();
            });

        } catch (error) {
            console.error('Error creating shipment via JSON API:', error);
            throw error;
        }
    }

    /**
     * Build shipment parameters from shipment data
     */
    buildShipmentParams(shipmentData) {
        const clientInfo = this.getClientInfo();
        
        // If using COD account
        if (shipmentData.useCodAccount) {
            clientInfo.AccountNumber = shipmentData.codAccountNumber || this.config.accountNumber;
            clientInfo.AccountPin = shipmentData.codAccountPin || this.config.accountPin;
        }

        // Build shipper info (match Aramex sample structure exactly - NO AccountPin in Party, only AccountNumber)
        const shipper = {
            Reference1: shipmentData.shipper?.reference1 || '',
            Reference2: shipmentData.shipper?.reference2 || '',
            AccountNumber: shipmentData.shipper?.accountNumber || clientInfo.AccountNumber,
            // Note: AccountPin is NOT in Party structure per Aramex sample - only in ClientInfo
            PartyAddress: {
                Line1: shipmentData.shipper?.address?.line1 || this.config.shipper.address,
                Line2: shipmentData.shipper?.address?.line2 || '',
                Line3: shipmentData.shipper?.address?.line3 || '',
                City: shipmentData.shipper?.city || this.config.shipper.city,
                StateOrProvinceCode: shipmentData.shipper?.state || this.config.shipper.state,
                PostCode: (shipmentData.shipper?.postalcode || this.config.shipper.postalcode).replace(/\s/g, ''),
                CountryCode: shipmentData.shipper?.country || this.config.shipper.country,
                Longitude: 0, // Per Aramex sample
                Latitude: 0,  // Per Aramex sample
                BuildingNumber: null, // Per Aramex sample
                BuildingName: '', // Per Aramex sample
                Floor: '', // Per Aramex sample
                Apartment: null, // Per Aramex sample
                POBox: null, // Per Aramex sample
                Description: null // Per Aramex sample
            },
            Contact: {
                Department: '',
                PersonName: shipmentData.shipper?.name || this.config.shipper.name,
                Title: '',
                CompanyName: shipmentData.shipper?.company || this.config.shipper.company,
                PhoneNumber1: shipmentData.shipper?.phone || this.config.shipper.phone,
                PhoneNumber1Ext: '',
                PhoneNumber2: '',
                PhoneNumber2Ext: '',
                FaxNumber: '',
                CellPhone: shipmentData.shipper?.phone || this.config.shipper.phone,
                EmailAddress: shipmentData.shipper?.email || this.config.shipper.email,
                Type: ''
            }
        };

        // Build consignee info (match Aramex sample structure exactly - NO AccountPin in Party, only AccountNumber)
        const consignee = {
            Reference1: shipmentData.consignee?.reference1 || '',
            Reference2: shipmentData.consignee?.reference2 || '',
            AccountNumber: shipmentData.consignee?.accountNumber || '',
            // Note: AccountPin is NOT in Party structure per Aramex sample - only in ClientInfo
            PartyAddress: {
                Line1: shipmentData.consignee?.address?.line1 || '',
                Line2: shipmentData.consignee?.address?.line2 || '',
                Line3: shipmentData.consignee?.address?.line3 || '',
                City: shipmentData.consignee?.city || '',
                StateOrProvinceCode: shipmentData.consignee?.state || '',
                PostCode: (shipmentData.consignee?.postalcode || '').replace(/\s/g, ''),
                CountryCode: shipmentData.consignee?.country || '',
                Longitude: 0, // Per Aramex sample
                Latitude: 0,  // Per Aramex sample
                BuildingNumber: '', // Per Aramex sample (empty string for consignee)
                BuildingName: '', // Per Aramex sample
                Floor: '0', // Per Aramex sample (string '0' for consignee)
                Apartment: null, // Per Aramex sample
                POBox: '', // Per Aramex sample (empty string for consignee)
                Description: null // Per Aramex sample
            },
            Contact: {
                Department: '',
                PersonName: shipmentData.consignee?.name || '',
                Title: '',
                CompanyName: shipmentData.consignee?.company || '',
                PhoneNumber1: shipmentData.consignee?.phone || '',
                PhoneNumber1Ext: '',
                PhoneNumber2: '',
                PhoneNumber2Ext: '',
                FaxNumber: '',
                CellPhone: shipmentData.consignee?.phone || '',
                EmailAddress: shipmentData.consignee?.email || '',
                Type: ''
            }
        };

        // Build item details
        const itemDetails = [];
        const pieceDimensions = [];
        
        for (const item of shipmentData.items || []) {
            const quantity = parseInt(item.quantity || 1);
            const weight = parseFloat(item.weight || 0);
            const actualWeight = quantity * weight;

            itemDetails.push({
                Quantity: quantity,
                Weight: {
                    Value: weight,
                    Unit: item.weightUnit || 'kg'
                },
                CommodityCode: item.commodityCode || '',
                GoodsDescription: item.name || '',
                CustomsValue: {
                    Value: parseFloat(item.price || 0),
                    CurrencyCode: item.currency || this.config.preferredCurrency
                }
            });

            pieceDimensions.push({
                Length: parseFloat(item.length || 0),
                Width: parseFloat(item.width || 0),
                Height: parseFloat(item.height || 0),
                ActualWeight: {
                    Value: actualWeight,
                    Unit: item.weightUnit || 'kg'
                },
                NumberOfPieces: quantity,
                Unit: item.dimensionUnit || 'cm'
            });
        }

        // Build services string
        let services = '';
        if (shipmentData.services && Array.isArray(shipmentData.services)) {
            services = shipmentData.services.join(',');
        }
        // PaymentOptions: when using COD, server may expect CODS (per API docs)
        const paymentOptions = shipmentData.paymentOptions ||
            (services && services.indexOf('CODS') !== -1 ? 'CODS' : '');

        // Build shipment details (match Aramex sample structure exactly to avoid server null-refs)
        const details = {
            Dimensions: {
                Length: 0, // Per Aramex sample: number not string
                Width: 0,   // Per Aramex sample: number not string
                Height: 0,  // Per Aramex sample: number not string
                Unit: 'cm'
            },
            PieceDimensions: pieceDimensions.length > 0 ? {
                Dimensions: pieceDimensions
            } : undefined,
            ActualWeight: {
                Value: parseFloat(shipmentData.totalWeight || 0),
                Unit: 'KG' // Per Aramex sample: always uppercase KG
            },
            ChargeableWeight: null, // Per Aramex sample
            ProductGroup: shipmentData.productGroup || 'EXP',
            ProductType: shipmentData.productType || 'PPX',
            PaymentType: shipmentData.paymentType || 'P',
            PaymentOptions: paymentOptions,
            Services: services,
            NumberOfPieces: parseInt(shipmentData.numberOfPieces || 1),
            DescriptionOfGoods: (shipmentData.descriptionOfGoods || '').substring(0, 65),
            GoodsOriginCountry: shipmentData.goodsOriginCountry || this.config.shipper.country,
            CashOnDeliveryAmount: shipmentData.cashOnDeliveryAmount
                ? { Value: parseFloat(shipmentData.cashOnDeliveryAmount), CurrencyCode: shipmentData.cashOnDeliveryCurrency || this.config.preferredCurrency }
                : { Value: 0, CurrencyCode: '' },
            InsuranceAmount: shipmentData.insuranceAmount
                ? { Value: parseFloat(shipmentData.insuranceAmount), CurrencyCode: shipmentData.insuranceCurrency || this.config.preferredCurrency }
                : null, // Per Aramex sample: null when not used
            CollectAmount: null, // Per Aramex sample: null when not used
            CashAdditionalAmount: { Value: 0, CurrencyCode: '' },
            CashAdditionalAmountDescription: '',
            CustomsValueAmount: shipmentData.customsValue
                ? { Value: parseFloat(shipmentData.customsValue), CurrencyCode: shipmentData.customsValueCurrency || this.config.preferredCurrency }
                : { Value: 0, CurrencyCode: '' },
            Items: itemDetails.length > 0 ? {
                ShipmentItem: itemDetails
            } : null, // Per Aramex sample: null when empty
            DeliveryInstructions: null, // Per Aramex sample
            AdditionalProperties: null, // Per Aramex sample (we override if needed below)
            ContainsDangerousGoods: false // Per Aramex sample
        };

        // Add additional properties (for customs, IOSS, etc.)
        if (shipmentData.additionalProperties && shipmentData.additionalProperties.length > 0) {
            details.AdditionalProperties = {
                AdditionalProperty: shipmentData.additionalProperties
            };
        }

        // Build main params (Transaction is required in all method requests per API manual §2.1)
        const params = {
            ClientInfo: clientInfo,
            Transaction: {
                Reference1: shipmentData.transactionReference1 || shipmentData.reference1 || '',
                Reference2: shipmentData.transactionReference2 || shipmentData.reference2 || '',
                Reference3: shipmentData.transactionReference3 || shipmentData.reference3 || '',
                Reference4: shipmentData.transactionReference4 || '',
                Reference5: shipmentData.transactionReference5 || ''
            },
            Shipments: [{
                Shipper: shipper,
                Consignee: consignee,
                ForeignHAWB: shipmentData.foreignHAWB || '',
                Reference1: shipmentData.reference1 || '',
                Reference2: shipmentData.reference2 || '',
                Reference3: shipmentData.reference3 || '',
                TransportType: shipmentData.transportType || 0,
                ShippingDateTime: shipmentData.shippingDateTime 
                    ? (shipmentData.shippingDateTime instanceof Date 
                        ? Math.floor(shipmentData.shippingDateTime.getTime() / 1000) 
                        : shipmentData.shippingDateTime)
                    : Math.floor(Date.now() / 1000),
                DueDate: shipmentData.dueDate 
                    ? (shipmentData.dueDate instanceof Date 
                        ? Math.floor(shipmentData.dueDate.getTime() / 1000) 
                        : shipmentData.dueDate)
                    : Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
                PickupLocation: shipmentData.pickupLocation || 'Reception',
                PickupGUID: shipmentData.pickupGUID || '',
                Comments: shipmentData.comments || '',
                AccountingInstrcutions: shipmentData.accountingInstructions || '',
                OperationsInstructions: shipmentData.operationsInstructions || '',
                Details: details
            }],
            LabelInfo: {
                ReportID: shipmentData.reportId || this.config.reportId,
                ReportType: 'URL'
            }
        };

        // Add attachments if any
        if (shipmentData.attachments && shipmentData.attachments.length > 0) {
            params.Shipments[0].Attachments = shipmentData.attachments;
        }

        // Always include ThirdParty (per Aramex sample - even if empty/null to match their structure)
        if (shipmentData.thirdParty) {
            params.Shipments[0].ThirdParty = {
                Reference1: shipmentData.thirdParty.reference1 || '',
                Reference2: shipmentData.thirdParty.reference2 || '',
                AccountNumber: shipmentData.thirdParty.accountNumber || clientInfo.AccountNumber,
                // Note: AccountPin is NOT in Party structure per Aramex sample - only in ClientInfo
                PartyAddress: {
                    Line1: shipmentData.thirdParty.address?.line1 || this.config.shipper.address,
                    Line2: shipmentData.thirdParty.address?.line2 || '',
                    Line3: shipmentData.thirdParty.address?.line3 || '',
                    City: shipmentData.thirdParty.city || this.config.shipper.city,
                    StateOrProvinceCode: shipmentData.thirdParty.state || this.config.shipper.state,
                    PostCode: (shipmentData.thirdParty.postalcode || this.config.shipper.postalcode).replace(/\s/g, ''),
                    CountryCode: shipmentData.thirdParty.country || this.config.shipper.country,
                    Longitude: 0, // Per Aramex sample
                    Latitude: 0,  // Per Aramex sample
                    BuildingNumber: null, // Per Aramex sample
                    BuildingName: null,   // Per Aramex sample
                    Floor: null,          // Per Aramex sample
                    Apartment: null,      // Per Aramex sample
                    POBox: null,         // Per Aramex sample
                    Description: null     // Per Aramex sample
                },
                Contact: {
                    Department: '',
                    PersonName: shipmentData.thirdParty.name || this.config.shipper.name,
                    Title: '',
                    CompanyName: shipmentData.thirdParty.company || this.config.shipper.company,
                    PhoneNumber1: shipmentData.thirdParty.phone || this.config.shipper.phone,
                    PhoneNumber1Ext: '',
                    PhoneNumber2: '',
                    PhoneNumber2Ext: '',
                    FaxNumber: '',
                    CellPhone: shipmentData.thirdParty.phone || this.config.shipper.phone,
                    EmailAddress: shipmentData.thirdParty.email || this.config.shipper.email,
                    Type: ''
                }
            };
        } else {
            // Include empty ThirdParty structure to match Aramex sample (prevents server null-ref)
            params.Shipments[0].ThirdParty = {
                Reference1: '',
                Reference2: '',
                AccountNumber: '',
                PartyAddress: {
                    Line1: '',
                    Line2: '',
                    Line3: '',
                    City: '',
                    StateOrProvinceCode: '',
                    PostCode: '',
                    CountryCode: '',
                    Longitude: 0, // Per Aramex sample
                    Latitude: 0,  // Per Aramex sample
                    BuildingNumber: null, // Per Aramex sample
                    BuildingName: null,   // Per Aramex sample
                    Floor: null,          // Per Aramex sample
                    Apartment: null,      // Per Aramex sample
                    POBox: null,         // Per Aramex sample
                    Description: null     // Per Aramex sample
                },
                Contact: {
                    Department: '',
                    PersonName: '',
                    Title: '',
                    CompanyName: '',
                    PhoneNumber1: '',
                    PhoneNumber1Ext: '',
                    PhoneNumber2: '',
                    PhoneNumber2Ext: '',
                    FaxNumber: '',
                    CellPhone: '',
                    EmailAddress: '',
                    Type: ''
                }
            };
        }

        return params;
    }

    /**
     * Track shipments
     */
    async trackShipments(shipmentNumbers, getLastUpdateOnly = false) {
        try {
            const wsdlUrl = this.config.sandbox 
                ? this.wsdlUrls.sandbox.tracking 
                : this.wsdlUrls.production.tracking;

            const client = await soap.createClientAsync(wsdlUrl, {
                soap_version: 1
            });

            // Ensure shipmentNumbers is an array
            const shipments = Array.isArray(shipmentNumbers) ? shipmentNumbers : [shipmentNumbers];

            const params = {
                ClientInfo: this.getClientInfo(),
                Transaction: {
                    Reference1: '001'
                },
                Shipments: shipments,
                GetLastTrackingUpdateOnly: getLastUpdateOnly
            };

            if (this.config.logging) {
                console.log('TrackShipments API Request:', JSON.stringify(params, null, 2));
            }

            const [result] = await client.TrackShipmentsAsync(params);

            if (this.config.logging) {
                console.log('TrackShipments API Response:', JSON.stringify(result, null, 2));
            }

            if (result.HasErrors) {
                const errors = this.extractErrors(result);
                throw new Error(`Aramex TrackShipments Error: ${errors.join(' | ')}`);
            }

            // Parse tracking results
            const trackingResults = {};
            const results = result.TrackingResults?.KeyValueOfstringArrayOfTrackingResultmFAkxlpY;

            if (Array.isArray(results)) {
                for (const kv of results) {
                    const shipmentNumber = kv.Key;
                    const trackingData = Array.isArray(kv.Value?.TrackingResult) 
                        ? kv.Value.TrackingResult 
                        : [kv.Value?.TrackingResult].filter(Boolean);
                    
                    trackingResults[shipmentNumber] = trackingData.map(tr => ({
                        updateLocation: tr.UpdateLocation || '',
                        updateDateTime: tr.UpdateDateTime || '',
                        updateDescription: tr.UpdateDescription || '',
                        comments: tr.Comments || ''
                    }));
                }
            } else if (results) {
                const shipmentNumber = results.Key;
                const trackingData = Array.isArray(results.Value?.TrackingResult) 
                    ? results.Value.TrackingResult 
                    : [results.Value?.TrackingResult].filter(Boolean);
                
                trackingResults[shipmentNumber] = trackingData.map(tr => ({
                    updateLocation: tr.UpdateLocation || '',
                    updateDateTime: tr.UpdateDateTime || '',
                    updateDescription: tr.UpdateDescription || '',
                    comments: tr.Comments || ''
                }));
            }

            return {
                success: true,
                trackingResults: trackingResults
            };

        } catch (error) {
            console.error('Error tracking shipments:', error);
            throw error;
        }
    }

    /**
     * Print label for a shipment
     */
    async printLabel(shipmentNumber, reference1 = '', reportId = null) {
        try {
            const wsdlUrl = this.config.sandbox 
                ? this.wsdlUrls.sandbox.shipping 
                : this.wsdlUrls.production.shipping;

            const client = await soap.createClientAsync(wsdlUrl, {
                soap_version: 1
            });

            const params = {
                ClientInfo: this.getClientInfo(),
                Transaction: {
                    Reference1: reference1 || shipmentNumber,
                    Reference2: '',
                    Reference3: '',
                    Reference4: '',
                    Reference5: ''
                },
                LabelInfo: {
                    ReportID: reportId || this.config.reportId,
                    ReportType: 'URL'
                },
                ShipmentNumber: shipmentNumber
            };

            if (this.config.logging) {
                console.log('PrintLabel API Request:', JSON.stringify(params, null, 2));
            }

            const [result] = await client.PrintLabelAsync(params);

            if (this.config.logging) {
                console.log('PrintLabel API Response:', JSON.stringify(result, null, 2));
            }

            if (result.HasErrors) {
                const errors = this.extractErrors(result);
                throw new Error(`Aramex PrintLabel Error: ${errors.join(' | ')}`);
            }

            return {
                success: true,
                labelUrl: result.ShipmentLabel?.LabelURL || null
            };

        } catch (error) {
            console.error('Error printing label:', error);
            throw error;
        }
    }

    /**
     * Extract errors from API response
     */
    extractErrors(result) {
        const errors = [];
        const notifications = result.Notifications?.Notification;

        if (Array.isArray(notifications)) {
            for (const notification of notifications) {
                errors.push(`${notification.Code} - ${notification.Message}`);
            }
        } else if (notifications) {
            errors.push(`${notifications.Code} - ${notifications.Message}`);
        }

        // Check for shipment-level errors
        if (result.Shipments?.ProcessedShipment?.Notifications) {
            const shipmentNotifications = result.Shipments.ProcessedShipment.Notifications.Notification;
            if (Array.isArray(shipmentNotifications)) {
                for (const notification of shipmentNotifications) {
                    errors.push(`Shipment: ${notification.Code} - ${notification.Message}`);
                }
            } else if (shipmentNotifications) {
                errors.push(`Shipment: ${shipmentNotifications.Code} - ${shipmentNotifications.Message}`);
            }
        }

        return errors.length > 0 ? errors : ['Unknown error'];
    }
}

module.exports = AramexService;
