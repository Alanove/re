/**
 * Aramex Shipping Service - Complete Node.js Implementation
 * Includes: Rate Calculation, Shipment Creation, Tracking, and Label Printing
 *
 * If lib/aramex/test-calculate-shipping.js works but the app gets ETIMEDOUT or ERR75:
 * - Sandbox: Turn OFF "Use shipping test mode" in admin to match test (production).
 * - PIN: Set ARAMEX_ACCOUNT_PIN in env or Account PIN in admin (same value as test script).
 * - Network: If the app runs on a different machine (e.g. server), ensure it can reach
 *   https://ws.aramex.net and outbound 443; firewall may block Aramex IPs.
 */

const soap = require('soap');
const axios = require('axios');
const https = require('https');
const { URL } = require('url');

/** Return an ISO 8601 datetime string for Aramex (xsd:dateTime). API expects this, not Unix timestamp. */
function toAramexDateTime(value) {
    if (value == null) return new Date().toISOString();
    const d = value instanceof Date ? value : new Date(typeof value === 'number' ? (value < 1e10 ? value * 1000 : value) : value);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

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

        // WSDL URLs - Using production format that works
        this.wsdlUrls = {
            production: {
                rates: 'https://ws.aramex.net/ShippingAPI.V2/RateCalculator/Service_1_0.svc?wsdl',
                shipping: 'https://ws.aramex.net/shippingapi.v2/shipping/service_1_0.svc?wsdl',
                tracking: 'https://ws.aramex.net/shippingapi.v2/tracking/service_1_0.svc?wsdl'
            },
            sandbox: {
                rates: 'https://ws.dev.aramex.net/ShippingAPI.V2/RateCalculator/Service_1_0.svc?wsdl',
                shipping: 'https://ws.dev.aramex.net/shippingapi.v2/shipping/service_1_0.svc?wsdl',
                tracking: 'https://ws.dev.aramex.net/shippingapi.v2/tracking/service_1_0.svc?wsdl'
            }
        };
    }

    getClientInfo() {
        const clientInfo = {};
        clientInfo.UserName = this.config.userName;
        clientInfo.Password = this.config.password;
        clientInfo.Version = 'v1.0';
        clientInfo.AccountNumber = this.config.accountNumber;
        clientInfo.AccountPin = this.config.accountPin;
        clientInfo.AccountEntity = this.config.accountEntity;
        clientInfo.AccountCountryCode = this.config.accountCountryCode;
        // Note: Source field removed - not in official C# sample (Reference.cs)
        return clientInfo;
    }

    async calculateShipping(packageData, weightUnit = 'kg', dimensionUnit = 'cm', options = {}) {
        try {
            if (weightUnit === 'lbs') {
                weightUnit = 'lb';
            }

            const packageInfo = this.calculatePackageInfo(packageData.items, weightUnit, dimensionUnit);

            const isDomestic = this.config.shipper.country.toLowerCase() ===
                packageData.destination.country.toLowerCase();

            const productGroup = isDomestic ? 'DOM' : 'EXP';
            const allowedMethods = isDomestic
                ? this.config.allowedDomesticMethods
                : this.config.allowedInternationalMethods;

            if (!allowedMethods || Object.keys(allowedMethods).length === 0) {
                return [];
            }

            const wsdlUrl = this.config.sandbox
                ? this.wsdlUrls.sandbox.rates
                : this.wsdlUrls.production.rates;

            const clientInfo = this.getClientInfo();
            const redacted = {
                UserName: clientInfo.UserName,
                Password: '***',
                Version: clientInfo.Version,
                AccountNumber: clientInfo.AccountNumber,
                AccountPin: '***',
                AccountEntity: clientInfo.AccountEntity,
                AccountCountryCode: clientInfo.AccountCountryCode,
                Source: clientInfo.Source
            };
            if (this.config.logging) {
                console.log('[Aramex] calculateShipping: sandbox=%s, wsdlUrl=%s, destination=%s %s %s, ClientInfo(redacted)=%j',
                    this.config.sandbox, wsdlUrl,
                    packageData.destination.country, packageData.destination.city, packageData.destination.postcode || '',
                    redacted);
            }

            const client = await soap.createClientAsync(wsdlUrl, {
                wsdl_options: { request_options: { timeout: 60000 } }
            });

            const rates = [];
            const throwFirstError = options && options.throwFirstError === true;

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
                    if (throwFirstError) {
                        throw error;
                    }
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

            const itemDetail = {
                PackageType: '',
                Quantity: quantity,
                Weight: {
                    Unit: weightUnit,
                    Value: weight
                }
            };

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
            price = Math.round(price);
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

    async createShipment(shipmentData) {
        try {
            const wsdlUrl = this.config.sandbox
                ? this.wsdlUrls.sandbox.shipping
                : this.wsdlUrls.production.shipping;

            const client = await soap.createClientAsync(wsdlUrl, {
                wsdl_options: { timeout: 60000 }
            });

            // Capture raw SOAP requests for debugging
            let lastRequestXML = null;
            let lastResponseXML = null;

            client.on('request', (xml) => {
                lastRequestXML = xml;
                if (this.config.logging) {
                    console.log('\n[Aramex] Raw SOAP Request XML:\n', xml);
                }
            });

            client.on('response', (xml) => {
                lastResponseXML = xml;
                if (this.config.logging) {
                    console.log('\n[Aramex] Raw SOAP Response XML:\n', xml);
                }
            });

            const params = this.buildShipmentParams(shipmentData);

            if (this.config.logging) {
                console.log('[Aramex] CreateShipments SOAP API Request (JSON):', JSON.stringify(params, null, 2));
            }

            const [result] = await client.CreateShipmentsAsync(params);

            if (this.config.logging) {
                console.log('[Aramex] CreateShipments SOAP API Response:', JSON.stringify(result, null, 2));
            }

            if (result.HasErrors) {
                const errors = this.extractErrors(result);
                // Attach raw XML for debugging
                const error = new Error(`Aramex CreateShipment Error: ${errors.join(' | ')}`);
                error.soapRequest = lastRequestXML;
                error.soapResponse = lastResponseXML;
                throw error;
            }

            let processedShipment = result.Shipments?.ProcessedShipment;
            if (Array.isArray(processedShipment)) processedShipment = processedShipment[0];
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
            console.error('Error creating shipment:', error.message);
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

            // For JSON API, use the structure from corrected Aramex data
            const itemDetail = {
                PackageType: item.packageType || 'Box',
                Quantity: quantity,
                Weight: {
                    Value: weight,
                    Unit: item.weightUnit || 'Kg'
                },
                Comments: item.name || '',
                Reference: item.commodityCode || ''
            };
            
            // Add CustomsValue only if price is provided (for international shipments)
            if (item.price && parseFloat(item.price) > 0) {
                itemDetail.CustomsValue = {
                    Value: parseFloat(item.price),
                    CurrencyCode: item.currency || this.config.preferredCurrency
                };
            }
            
            itemDetails.push(itemDetail);

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
                Length: shipmentData.dimensions?.length || 0, // Per Aramex sample: number not string
                Width: shipmentData.dimensions?.width || 0,   // Per Aramex sample: number not string
                Height: shipmentData.dimensions?.height || 0,  // Per Aramex sample: number not string
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
            Items: itemDetails.length > 0 ? itemDetails : [], // JSON API expects direct array
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
                ReportID: shipmentData.reportId || this.config.reportId || 9729,
                ReportType: shipmentData.reportType || 'URL'
            }
        };

        // Add ThirdParty if provided
        if (shipmentData.thirdParty) {
            params.Shipments[0].ThirdParty = {
                Reference1: shipmentData.thirdParty.reference1 || '',
                Reference2: shipmentData.thirdParty.reference2 || '',
                AccountNumber: shipmentData.thirdParty.accountNumber || '',
                PartyAddress: {
                    Line1: shipmentData.thirdParty.address?.line1 || '',
                    Line2: shipmentData.thirdParty.address?.line2 || '',
                    Line3: shipmentData.thirdParty.address?.line3 || '',
                    City: shipmentData.thirdParty.city || '',
                    StateOrProvinceCode: shipmentData.thirdParty.state || '',
                    PostCode: (shipmentData.thirdParty.postalcode || '').replace(/\s/g, ''),
                    CountryCode: shipmentData.thirdParty.country || '',
                    Longitude: 0,
                    Latitude: 0,
                    BuildingNumber: '',
                    BuildingName: '',
                    Floor: '',
                    Apartment: null,
                    POBox: '',
                    Description: null
                },
                Contact: {
                    Department: '',
                    PersonName: shipmentData.thirdParty.name || '',
                    Title: '',
                    CompanyName: shipmentData.thirdParty.company || '',
                    PhoneNumber1: shipmentData.thirdParty.phone || '',
                    PhoneNumber1Ext: '',
                    PhoneNumber2: '',
                    PhoneNumber2Ext: '',
                    FaxNumber: '',
                    CellPhone: shipmentData.thirdParty.phone || '',
                    EmailAddress: shipmentData.thirdParty.email || '',
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

            return result;

        } catch (error) {
            console.error('Error tracking shipments:', error.message);
            // Save SOAP XML to files for debugging
            if (error.root?.Envelope) {
                const fs = require('fs');
                const path = require('path');
                const debugDir = path.join(__dirname, '../../lib/aramex/debug');

                try {
                    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

                    // Save request XML
                    if (error.soapRequest || client?.lastRequest) {
                        const requestXml = error.soapRequest || client.lastRequest;
                        fs.writeFileSync(path.join(debugDir, 'last-soap-request.xml'), requestXml);
                        console.log('\n✓ SOAP Request XML saved to: lib/aramex/debug/last-soap-request.xml');
                    }

                    // Save response XML
                    if (error.soapResponse || client?.lastResponse) {
                        const responseXml = error.soapResponse || client.lastResponse;
                        fs.writeFileSync(path.join(debugDir, 'last-soap-response.xml'), responseXml);
                        console.log('✓ SOAP Response XML saved to: lib/aramex/debug/last-soap-response.xml');
                    }
                } catch (fileError) {
                    console.error('Could not save debug XML files:', fileError.message);
                }
            }

            throw error;
        }
    }

    buildShipmentParams(shipmentData) {
        const clientInfo = this.getClientInfo();

        if (shipmentData.useCodAccount) {
            clientInfo.AccountNumber = shipmentData.codAccountNumber || this.config.accountNumber;
            clientInfo.AccountPin = shipmentData.codAccountPin || this.config.accountPin;
        }

        const shipper = {
            Reference1: shipmentData.shipper?.reference1 || '',
            Reference2: shipmentData.shipper?.reference2 || '',
            AccountNumber: shipmentData.shipper?.accountNumber || clientInfo.AccountNumber,
            PartyAddress: {
                Line1: shipmentData.shipper?.address?.line1 || this.config.shipper.address,
                Line2: shipmentData.shipper?.address?.line2 || '',
                Line3: shipmentData.shipper?.address?.line3 || '',
                City: shipmentData.shipper?.city || this.config.shipper.city,
                StateOrProvinceCode: shipmentData.shipper?.state || this.config.shipper.state,
                PostCode: (shipmentData.shipper?.postalcode || this.config.shipper.postalcode).replace(/\s/g, ''),
                CountryCode: shipmentData.shipper?.country || this.config.shipper.country,
                Longitude: 0,
                Latitude: 0,
                BuildingNumber: '',
                BuildingName: '',
                Floor: '',
                Apartment: '',
                POBox: '',
                Description: ''
            },
            Contact: {
                Department: '',
                PersonName: shipmentData.shipper?.name || this.config.shipper.name || 'Sender',
                Title: '',
                CompanyName: shipmentData.shipper?.company || this.config.shipper.company || 'Company',
                PhoneNumber1: shipmentData.shipper?.phone || this.config.shipper.phone || '0000000',
                PhoneNumber1Ext: '',
                PhoneNumber2: '',
                PhoneNumber2Ext: '',
                FaxNumber: '',
                CellPhone: shipmentData.shipper?.phone || this.config.shipper.phone || '0000000',
                EmailAddress: shipmentData.shipper?.email || this.config.shipper.email || 'noreply@example.com',
                Type: ''
            }
        };

        const consignee = {
            Reference1: shipmentData.consignee?.reference1 || '',
            Reference2: shipmentData.consignee?.reference2 || '',
            AccountNumber: shipmentData.consignee?.accountNumber || '',
            PartyAddress: {
                Line1: shipmentData.consignee?.address?.line1 || 'Address',
                Line2: shipmentData.consignee?.address?.line2 || '',
                Line3: shipmentData.consignee?.address?.line3 || '',
                City: shipmentData.consignee?.city || 'City',
                StateOrProvinceCode: shipmentData.consignee?.state || '',
                PostCode: (shipmentData.consignee?.postalcode || '0000').replace(/\s/g, ''),
                CountryCode: shipmentData.consignee?.country || 'LB',
                Longitude: 0,
                Latitude: 0,
                BuildingNumber: '',
                BuildingName: '',
                Floor: '',
                Apartment: '',
                POBox: '',
                Description: ''
            },
            Contact: {
                Department: '',
                PersonName: shipmentData.consignee?.name || 'Customer',
                Title: '',
                CompanyName: shipmentData.consignee?.company || '-',
                PhoneNumber1: shipmentData.consignee?.phone || '0000000',
                PhoneNumber1Ext: '',
                PhoneNumber2: '',
                PhoneNumber2Ext: '',
                FaxNumber: '',
                CellPhone: shipmentData.consignee?.phone || '0000000',
                EmailAddress: shipmentData.consignee?.email || 'customer@example.com',
                Type: ''
            }
        };

        const itemDetails = [];

        for (const item of shipmentData.items || []) {
            const quantity = parseInt(item.quantity || 1);
            const weight = parseFloat(item.weight || 0);

            // Weight element order: Unit then Value (required by Aramex .NET DataContract). Avoid empty strings to prevent server NullReferenceException.
            itemDetails.push({
                PackageType: item.packageType || 'Box',
                Quantity: quantity,
                Weight: {
                    Unit: item.weightUnit || 'Kg',
                    Value: weight
                },
                Comments: (item.name || 'Item').substring(0, 100),
                Reference: (item.commodityCode || '-').substring(0, 50)
            });
        }

        let services = '';
        if (shipmentData.services && Array.isArray(shipmentData.services)) {
            services = shipmentData.services.join(',');
        }

        // Build Details in same order as official Aramex PHP sample; include all Money fields to avoid server NullReferenceException
        const totalW = parseFloat(shipmentData.totalWeight || 0.5);
        const defCurrency = this.config.preferredCurrency || 'USD';
        const codAmount = shipmentData.cashOnDeliveryAmount && shipmentData.cashOnDeliveryAmount > 0 ? parseFloat(shipmentData.cashOnDeliveryAmount) : 0;
        const codCurrency = (shipmentData.cashOnDeliveryAmount && shipmentData.cashOnDeliveryAmount > 0) ? (shipmentData.cashOnDeliveryCurrency || defCurrency) : defCurrency;
        const insuranceAmount = shipmentData.insuranceAmount && shipmentData.insuranceAmount > 0 ? parseFloat(shipmentData.insuranceAmount) : 0;
        const insuranceCurrency = (shipmentData.insuranceAmount && shipmentData.insuranceAmount > 0) ? (shipmentData.insuranceCurrency || defCurrency) : defCurrency;
        const collectAmount = shipmentData.collectAmount && shipmentData.collectAmount > 0 ? parseFloat(shipmentData.collectAmount) : 0;
        const collectCurrency = (shipmentData.collectAmount && shipmentData.collectAmount > 0) ? (shipmentData.collectCurrency || defCurrency) : defCurrency;
        const cashAdditionalAmount = shipmentData.cashAdditionalAmount && shipmentData.cashAdditionalAmount > 0 ? parseFloat(shipmentData.cashAdditionalAmount) : 0;
        const cashAdditionalCurrency = (shipmentData.cashAdditionalAmount && shipmentData.cashAdditionalAmount > 0) ? (shipmentData.cashAdditionalCurrency || defCurrency) : defCurrency;
        const customsValue = shipmentData.customsValue && shipmentData.customsValue > 0 ? parseFloat(shipmentData.customsValue) : 0;
        const customsCurrency = (shipmentData.customsValue && shipmentData.customsValue > 0) ? (shipmentData.customsValueCurrency || defCurrency) : defCurrency;

        // Build Details in API element order. Include Money fields only when value > 0 to avoid server NullReferenceException.
        const details = {
            Dimensions: {
                Length: parseFloat(shipmentData.dimensions?.length || 10),
                Width: parseFloat(shipmentData.dimensions?.width || 10),
                Height: parseFloat(shipmentData.dimensions?.height || 10),
                Unit: 'cm'
            },
            ActualWeight: { Unit: 'Kg', Value: totalW },
            ChargeableWeight: { Unit: 'Kg', Value: totalW },
            DescriptionOfGoods: (shipmentData.descriptionOfGoods || 'Goods').substring(0, 65),
            GoodsOriginCountry: shipmentData.goodsOriginCountry || this.config.shipper.country,
            NumberOfPieces: parseInt(shipmentData.numberOfPieces || 1),
            ProductGroup: shipmentData.productGroup || 'EXP',
            ProductType: shipmentData.productType || 'PPX',
            PaymentType: shipmentData.paymentType || 'P',
            PaymentOptions: shipmentData.paymentOptions || '',
            Services: services
        };
        if (codAmount > 0) details.CashOnDeliveryAmount = { Value: codAmount, CurrencyCode: codCurrency };
        if (insuranceAmount > 0) details.InsuranceAmount = { Value: insuranceAmount, CurrencyCode: insuranceCurrency };
        if (collectAmount > 0) details.CollectAmount = { Value: collectAmount, CurrencyCode: collectCurrency };
        if (cashAdditionalAmount > 0) {
            details.CashAdditionalAmount = { Value: cashAdditionalAmount, CurrencyCode: cashAdditionalCurrency };
            details.CashAdditionalAmountDescription = shipmentData.cashAdditionalAmountDescription || '-';
        }
        if (customsValue > 0) details.CustomsValueAmount = { Value: customsValue, CurrencyCode: customsCurrency };
        details.Items = itemDetails;
        details.ContainsDangerousGoods = shipmentData.containsDangerousGoods || false;

        if (shipmentData.additionalProperties && shipmentData.additionalProperties.length > 0) {
            details.AdditionalProperties = {
                AdditionalProperty: shipmentData.additionalProperties
            };
        }

        // Build params in exact WSDL order (critical for DataContract serialization)
        const shipment = {
            Reference1: shipmentData.reference1 || '',
            Reference2: shipmentData.reference2 || '',
            Reference3: shipmentData.reference3 || '',
            Shipper: shipper,
            Consignee: consignee,
            ThirdParty: {
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
                    Longitude: 0,
                    Latitude: 0,
                    BuildingNumber: '',
                    BuildingName: '',
                    Floor: '',
                    Apartment: '',
                    POBox: '',
                    Description: ''
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
            },
            ShippingDateTime: toAramexDateTime(shipmentData.shippingDateTime),
            DueDate: toAramexDateTime(shipmentData.dueDate),
            Comments: shipmentData.comments || '',
            PickupLocation: shipmentData.pickupLocation || 'Reception',
            OperationsInstructions: shipmentData.operationsInstructions || '',
            AccountingInstrcutions: shipmentData.accountingInstructions || '',
            Details: details,
            ForeignHAWB: shipmentData.foreignHAWB || shipmentData.reference1 || '-',  // Use order number as HAWB reference
            TransportType: shipmentData.transportType || 0,
            PickupGUID: shipmentData.pickupGUID || '',
            Number: '',
            ScheduledDelivery: null
        };

        // Override ThirdParty if provided (no AccountPin in Party, only AccountNumber!)
        if (shipmentData.thirdParty) {
            shipment.ThirdParty = {
                Reference1: shipmentData.thirdParty.reference1 || '',
                Reference2: shipmentData.thirdParty.reference2 || '',
                AccountNumber: shipmentData.thirdParty.accountNumber || '',
                PartyAddress: {
                    Line1: shipmentData.thirdParty.address?.line1 || '',
                    Line2: shipmentData.thirdParty.address?.line2 || '',
                    Line3: shipmentData.thirdParty.address?.line3 || '',
                    City: shipmentData.thirdParty.city || '',
                    StateOrProvinceCode: shipmentData.thirdParty.state || '',
                    PostCode: (shipmentData.thirdParty.postalcode || '').replace(/\s/g, ''),
                    CountryCode: shipmentData.thirdParty.country || ''
                },
                Contact: {
                    Department: '',
                    PersonName: shipmentData.thirdParty.name || '',
                    Title: '',
                    CompanyName: shipmentData.thirdParty.company || '',
                    PhoneNumber1: shipmentData.thirdParty.phone || '',
                    PhoneNumber1Ext: '',
                    PhoneNumber2: '',
                    PhoneNumber2Ext: '',
                    FaxNumber: '',
                    CellPhone: shipmentData.thirdParty.phone || '',
                    EmailAddress: shipmentData.thirdParty.email || '',
                    Type: ''
                }
            };
        }

        if (shipmentData.attachments && shipmentData.attachments.length > 0) {
            shipment.Attachments = shipmentData.attachments;
        }

        // Shipments as array: .NET API expects List<Shipment>; avoids NullReference when service accesses request collection
        const params = {
            Shipments: [shipment],
            ClientInfo: clientInfo,
            Transaction: {
                Reference1: '001',
                Reference2: '',
                Reference3: '',
                Reference4: '',
                Reference5: ''
            },
            LabelInfo: {
                ReportID: shipmentData.reportId || this.config.reportId,
                ReportType: 'URL'
            }
        };

        return params;
    }

    async trackShipments(shipmentNumbers, getLastUpdateOnly = false) {
        try {
            const wsdlUrl = this.config.sandbox
                ? this.wsdlUrls.sandbox.tracking
                : this.wsdlUrls.production.tracking;

            const client = await soap.createClientAsync(wsdlUrl, {
                soap_version: 1
            });

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
     * Schedule a pickup with Aramex (CreatePickup API).
     * pickupData: {
     *   reference1: string (e.g. order number),
     *   pickupDate: Date or ISO string (date of pickup),
     *   readyTime: Date or ISO string (ready from),
     *   closingTime: Date or ISO string (last pickup time),
     *   location?: string (e.g. 'Reception'),
     *   vehicle?: string (e.g. '0'),
     *   comments?: string,
     *   productGroup?: string ('DOM' | 'EXP'),
     *   productType?: string (e.g. 'PPX'),
     *   paymentType?: string ('P' = Prepaid),
     *   numberOfShipments: number,
     *   numberOfPieces: number,
     *   weight: number,
     *   weightUnit?: string ('kg'),
     *   contact?: { personName, companyName, phone, cellPhone, email },
     *   address?: { line1, city, stateOrProvinceCode, postCode, countryCode }
     * }
     */
    async createPickup(pickupData) {
        try {
            const wsdlUrl = this.config.sandbox
                ? this.wsdlUrls.sandbox.shipping
                : this.wsdlUrls.production.shipping;

            const client = await soap.createClientAsync(wsdlUrl, {
                soap_version: 1
            });

            const toDate = (d) => {
                if (!d) return null;
                if (d instanceof Date) return d;
                const parsed = new Date(d);
                return isNaN(parsed.getTime()) ? null : parsed;
            };
            const toAramexDateTime = (d) => {
                const date = toDate(d);
                if (!date) return '';
                return date.toISOString();
            };

            const pickupDate = toDate(pickupData.pickupDate) || new Date();
            const readyTime = toDate(pickupData.readyTime) || new Date(pickupDate.getFullYear(), pickupDate.getMonth(), pickupDate.getDate(), 10, 0, 0);
            const closingTime = toDate(pickupData.closingTime) || new Date(pickupDate.getFullYear(), pickupDate.getMonth(), pickupDate.getDate(), 17, 0, 0);

            const contact = pickupData.contact || this.config.shipper;
            const address = pickupData.address || {
                line1: this.config.shipper.address,
                city: this.config.shipper.city,
                stateOrProvinceCode: this.config.shipper.state,
                postCode: (this.config.shipper.postalcode || '').replace(/\s/g, ''),
                countryCode: this.config.shipper.country
            };

            const params = {
                ClientInfo: this.getClientInfo(),
                Transaction: {
                    Reference1: pickupData.reference1 || '',
                    Reference2: pickupData.reference2 || '',
                    Reference3: '',
                    Reference4: '',
                    Reference5: ''
                },
                Pickup: {
                    PickupAddress: {
                        Line1: address.line1 || '',
                        Line2: address.line2 || '',
                        Line3: address.line3 || '',
                        City: address.city || '',
                        StateOrProvinceCode: address.stateOrProvinceCode || address.state || '',
                        PostCode: (address.postCode || address.postalcode || '').replace(/\s/g, ''),
                        CountryCode: address.countryCode || address.country || ''
                    },
                    PickupContact: {
                        Department: '',
                        PersonName: contact.personName || contact.name || '',
                        Title: '',
                        CompanyName: contact.companyName || contact.company || '',
                        PhoneNumber1: contact.phone || '',
                        PhoneNumber1Ext: contact.phoneExt || '',
                        PhoneNumber2: '',
                        PhoneNumber2Ext: '',
                        FaxNumber: '',
                        CellPhone: contact.cellPhone || contact.phone || '',
                        EmailAddress: contact.email || '',
                        Type: ''
                    },
                    PickupLocation: pickupData.location || 'Reception',
                    PickupDate: toAramexDateTime(pickupDate),
                    ReadyTime: toAramexDateTime(readyTime),
                    LastPickupTime: toAramexDateTime(closingTime),
                    ClosingTime: toAramexDateTime(closingTime),
                    Comments: pickupData.comments || '',
                    Reference1: pickupData.reference1 || '',
                    Reference2: pickupData.reference2 || '',
                    Vehicle: pickupData.vehicle || '0',
                    Shipments: { Shipment: [] },
                    PickupItems: {
                        PickupItemDetail: {
                            ProductGroup: pickupData.productGroup || 'EXP',
                            ProductType: pickupData.productType || 'PPX',
                            NumberOfShipments: parseInt(pickupData.numberOfShipments || 1, 10),
                            PackageType: '',
                            Payment: pickupData.paymentType || 'P',
                            ShipmentWeight: {
                                Unit: pickupData.weightUnit || 'kg',
                                Value: parseFloat(pickupData.weight || 1)
                            },
                            ShipmentVolume: null,
                            NumberOfPieces: parseInt(pickupData.numberOfPieces || 1, 10),
                            CashAmount: null,
                            ExtraCharges: null,
                            ShipmentDimensions: null,
                            Comments: ''
                        }
                    },
                    Status: pickupData.status || 'Ready'
                }
            };

            if (this.config.logging) {
                console.log('CreatePickup API Request:', JSON.stringify(params, null, 2));
            }

            const [result] = await client.CreatePickupAsync(params);

            if (this.config.logging) {
                console.log('CreatePickup API Response:', JSON.stringify(result, null, 2));
            }

            if (result.HasErrors) {
                const errors = this.extractErrors(result);
                throw new Error(`Aramex CreatePickup Error: ${errors.join(' | ')}`);
            }

            const processed = result.ProcessedPickup;
            return {
                success: true,
                pickupId: processed?.ID || null,
                pickupGUID: processed?.GUID || null,
                reference1: processed?.Reference1 || null,
                reference2: processed?.Reference2 || null
            };
        } catch (error) {
            console.error('Error creating pickup:', error);
            throw error;
        }
    }

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
