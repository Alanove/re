"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetCommerceService = void 0;
const env_config_1 = __importDefault(require("../../config/env.config"));
const currentUrlProviderService_1 = require("../currentUrlProviderService");
function buildBillingAddress(addr) {
    const street = [addr.address1, addr.line1, addr.street].find(Boolean);
    const street2 = [addr.address2, addr.line2, addr.street2].find(Boolean);
    const country = (addr.country_code || addr.country || '').toString().toUpperCase();
    return {
        address: {
            street: (street || '').toString().slice(0, 100),
            street2: (street2 || '').toString().slice(0, 100),
            city: (addr.city || addr.locality || '').toString().slice(0, 100),
            postcodeZip: (addr.postal_code || addr.postcode || addr.zip || '').toString().slice(0, 10),
            country: country.length === 3 ? country : country.slice(0, 2),
            stateProvince: (addr.state || addr.region || '').toString().slice(0, 20)
        }
    };
}
function mapGatewayCodeToMessage(code) {
    if (!code)
        return '';
    const messages = {
        DECLINED: 'Your card was declined.',
        EXPIRED_CARD: 'The card has expired. Please use a different card.',
        TIMED_OUT: 'The request timed out. Please try again.',
        ACQUIRER_SYSTEM_ERROR: 'The payment system is temporarily unavailable.',
        UNSPECIFIED_FAILURE: 'An error occurred with your card. Please check the details and try again.',
        AUTHORIZATION_FAILED: 'The card was not authorized. Please try a different card.'
    };
    return messages[code] || '';
}
class NetCommerceService {
    constructor(config) {
        let gatewayUrl = config?.gatewayUrl || env_config_1.default.netcommerce.gatewayUrl;
        const apiVersion = process.env.NETCOMMERCE_API_VERSION || '100';
        if (gatewayUrl && !gatewayUrl.includes('/api/')) {
            gatewayUrl = gatewayUrl.replace(/\/$/, '') + '/api/rest/version/' + apiVersion;
        }
        const merchantEmail = config?.merchantEmail ?? env_config_1.default.netcommerce.merchantEmail;
        const merchantPhone = config?.merchantPhone ?? env_config_1.default.netcommerce.merchantPhone;
        const merchantLogoUrl = config?.merchantLogoUrl ?? env_config_1.default.netcommerce.merchantLogoUrl;
        const merchantAddressLine1 = config?.merchantAddressLine1 ?? env_config_1.default.netcommerce.merchantAddressLine1;
        const merchantAddressLine2 = config?.merchantAddressLine2 ?? env_config_1.default.netcommerce.merchantAddressLine2;
        this.config = {
            merchantId: config?.merchantId || env_config_1.default.netcommerce.merchantId,
            apiPassword: config?.apiPassword || env_config_1.default.netcommerce.apiPassword,
            gatewayUrl,
            testMode: config?.testMode ?? env_config_1.default.netcommerce.testMode,
            merchantName: config?.merchantName ?? env_config_1.default.netcommerce.merchantName,
            partnerSolutionId: config?.partnerSolutionId ?? env_config_1.default.netcommerce.partnerSolutionId,
            ...(merchantEmail !== undefined && { merchantEmail }),
            ...(merchantPhone !== undefined && { merchantPhone }),
            ...(merchantLogoUrl !== undefined && { merchantLogoUrl }),
            ...(merchantAddressLine1 !== undefined && { merchantAddressLine1 }),
            ...(merchantAddressLine2 !== undefined && { merchantAddressLine2 })
        };
    }
    async processPayment(data) {
        try {
            if (!this.config.merchantId || !this.config.apiPassword) {
                throw new Error('NetCommerce configuration missing (Merchant ID or API Password)');
            }
            const url = `${this.config.gatewayUrl}/merchant/${this.config.merchantId}/session`;
            const gatewayOrderId = `ORDER-${data.orderId}-${Date.now()}`;
            const appBaseUrl = data.baseUrl ?? (0, currentUrlProviderService_1.getBaseUrl)();
            const returnUrl = data.returnUrl || `${appBaseUrl}/checkout/complete?orderId=${data.orderId}`;
            const merchantName = this.config.merchantName || 'Store';
            const customerNameParts = (data.customerName || '').trim().split(/\s+/);
            const customerFirstName = customerNameParts[0] || '';
            const customerLastName = customerNameParts.slice(1).join(' ') || '';
            const payload = {
                apiOperation: 'INITIATE_CHECKOUT',
                interaction: {
                    operation: 'PURCHASE',
                    returnUrl,
                    timeout: 1800,
                    merchant: {
                        name: merchantName,
                        url: appBaseUrl
                    },
                    locale: 'en',
                    displayControl: {
                        billingAddress: 'OPTIONAL',
                        customerEmail: 'MANDATORY',
                        shipping: 'HIDE'
                    }
                },
                order: {
                    id: gatewayOrderId,
                    amount: data.amount.toString(),
                    currency: data.currency,
                    description: `Order #${data.orderId}`,
                    reference: gatewayOrderId
                },
                customer: {
                    email: data.customerEmail,
                    firstName: customerFirstName,
                    lastName: customerLastName,
                    mobilePhone: data.customerPhone || '',
                    phone: data.customerPhone || ''
                },
                transaction: {
                    reference: gatewayOrderId
                }
            };
            if (this.config.merchantEmail)
                payload.interaction.merchant.email = this.config.merchantEmail;
            if (this.config.merchantPhone)
                payload.interaction.merchant.phone = this.config.merchantPhone;
            if (this.config.merchantLogoUrl)
                payload.interaction.merchant.logo = this.config.merchantLogoUrl;
            if (this.config.merchantAddressLine1 || this.config.merchantAddressLine2) {
                payload.interaction.merchant.address = {
                    line1: this.config.merchantAddressLine1 || '',
                    line2: this.config.merchantAddressLine2 || ''
                };
            }
            const requestSentAt = new Date().toISOString();
            const requestHeaders = {
                'Content-Type': 'application/json',
                'Authorization': 'Basic [REDACTED]'
            };
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            let response;
            try {
                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Basic ' + Buffer.from(`merchant.${this.config.merchantId}:${this.config.apiPassword}`).toString('base64')
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
            }
            finally {
                clearTimeout(timeoutId);
            }
            const responseReceivedAt = new Date().toISOString();
            let result;
            let responseBodyRaw = '';
            try {
                responseBodyRaw = await response.text();
                result = responseBodyRaw ? JSON.parse(responseBodyRaw) : {};
            }
            catch (_) {
                const bankDebugReport = {
                    requestSentAt,
                    requestUrl: url,
                    requestMethod: 'POST',
                    requestHeaders,
                    requestBody: payload,
                    responseReceivedAt,
                    responseStatus: response.status,
                    responseBody: { _raw: responseBodyRaw, _parseError: true }
                };
                return {
                    success: false,
                    error: `Gateway returned invalid response (status ${response.status})`,
                    gatewayResponse: null,
                    bankDebugReport
                };
            }
            const bankDebugReport = {
                requestSentAt,
                requestUrl: url,
                requestMethod: 'POST',
                requestHeaders,
                requestBody: payload,
                responseReceivedAt,
                responseStatus: response.status,
                responseBody: result
            };
            if (result.result === 'SUCCESS' && result.session && result.session.id) {
                const appBaseUrl = data.baseUrl ?? (0, currentUrlProviderService_1.getBaseUrl)();
                const redirectUrl = `${appBaseUrl}/checkout/pay?sessionId=${encodeURIComponent(result.session.id)}&orderId=${data.orderId}`;
                bankDebugReport.redirectUrl = redirectUrl;
                bankDebugReport.redirectAt = new Date().toISOString();
                return {
                    success: true,
                    sessionId: result.session.id,
                    redirectUrl: redirectUrl,
                    gatewayOrderId,
                    gatewayResponse: result,
                    bankDebugReport
                };
            }
            else {
                const code = result.response?.gatewayCode || result.error?.cause;
                const explanation = result.error?.explanation || '';
                const errorMessage = explanation || mapGatewayCodeToMessage(code) || 'Failed to create payment session';
                return {
                    success: false,
                    error: errorMessage,
                    gatewayResponse: result,
                    bankDebugReport
                };
            }
        }
        catch (error) {
            const cause = error.cause || error;
            const code = cause?.code || cause?.errno;
            const isUnreachable = code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || error.message === 'fetch failed';
            const mockIfUnreachable = process.env.NETCOMMERCE_MOCK_IF_UNREACHABLE !== 'false' &&
                (process.env.NETCOMMERCE_MOCK_IF_UNREACHABLE === 'true' || process.env.NODE_ENV === 'development');
            if (isUnreachable && mockIfUnreachable && data.returnUrl) {
                const mockSessionId = `mock-session-${data.orderId}-${Date.now()}`;
                const appBaseUrl = data.baseUrl ?? (0, currentUrlProviderService_1.getBaseUrl)();
                const payPageUrl = `${appBaseUrl}/checkout/pay?sessionId=${encodeURIComponent(mockSessionId)}&orderId=${data.orderId}`;
                console.warn('NetCommerce: gateway unreachable – using mock redirect (no bank page). Set NETCOMMERCE_GATEWAY_URL to a reachable gateway for real redirect.');
                const mockReport = {
                    requestSentAt: new Date().toISOString(),
                    requestUrl: `${this.config.gatewayUrl}/merchant/${this.config.merchantId}/session`,
                    requestMethod: 'POST',
                    requestHeaders: { 'Content-Type': 'application/json', 'Authorization': 'Basic [REDACTED]' },
                    requestBody: { _note: 'Request failed before send (gateway unreachable)' },
                    responseReceivedAt: new Date().toISOString(),
                    responseStatus: 0,
                    responseBody: { _note: 'Gateway unreachable (ENOTFOUND/ECONNREFUSED/ETIMEDOUT)', error: error.message },
                    redirectUrl: payPageUrl,
                    redirectAt: new Date().toISOString()
                };
                return {
                    success: true,
                    sessionId: mockSessionId,
                    redirectUrl: payPageUrl,
                    gatewayResponse: { session: { id: mockSessionId }, result: 'SUCCESS' },
                    bankDebugReport: mockReport
                };
            }
            if (!isUnreachable) {
                console.error('NetCommerce payment error:', error);
            }
            let message = error.message || 'Payment processing failed';
            if (isUnreachable) {
                message = 'Payment gateway is unreachable. Set NETCOMMERCE_GATEWAY_URL to a reachable host (e.g. test-gateway.mastercard.com) or get the correct URL from Credit Libanais.';
            }
            return {
                success: false,
                error: message,
                gatewayResponse: null
            };
        }
    }
    async retrieveSession(sessionId) {
        try {
            if (!this.config.merchantId || !this.config.apiPassword) {
                return { success: false, error: 'NetCommerce configuration missing' };
            }
            const url = `${this.config.gatewayUrl}/merchant/${this.config.merchantId}/session/${sessionId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + Buffer.from(`merchant.${this.config.merchantId}:${this.config.apiPassword}`).toString('base64')
                }
            });
            const result = await response.json();
            if (result.result === 'SUCCESS' && result.session) {
                return {
                    success: true,
                    result: result.result,
                    order: result.order
                };
            }
            return {
                success: false,
                result: result.result,
                error: result.error?.explanation || 'Session retrieval failed'
            };
        }
        catch (error) {
            console.error('NetCommerce retrieveSession error:', error);
            return { success: false, error: error.message || 'Failed to retrieve session' };
        }
    }
    async retrieveOrder(gatewayOrderId) {
        try {
            if (!this.config.merchantId || !this.config.apiPassword) {
                return { success: false, error: 'NetCommerce configuration missing' };
            }
            const encodedOrderId = encodeURIComponent(gatewayOrderId);
            const url = `${this.config.gatewayUrl}/merchant/${this.config.merchantId}/order/${encodedOrderId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + Buffer.from(`merchant.${this.config.merchantId}:${this.config.apiPassword}`).toString('base64')
                }
            });
            const orderResult = await response.json();
            const result = (orderResult.result || '').toUpperCase();
            const status = (orderResult.status || '').toUpperCase();
            const success = result === 'SUCCESS' && (status === 'CAPTURED' || status === 'AUTHORIZED' || status === 'PARTIALLY_CAPTURED');
            if (success) {
                return {
                    success: true,
                    result: orderResult.result,
                    status: orderResult.status,
                    order: orderResult
                };
            }
            return {
                success: false,
                result: orderResult.result,
                status: orderResult.status,
                order: orderResult,
                error: orderResult.error?.explanation || `Order result=${result} status=${status}`
            };
        }
        catch (error) {
            console.error('NetCommerce retrieveOrder error:', error);
            return { success: false, error: error.message || 'Failed to retrieve order' };
        }
    }
    async refundPayment(transactionId, amount) {
        return {
            success: false,
            error: 'Refund not fully implemented for Netcommerce yet.'
        };
    }
    async getPaymentStatus(transactionId) {
        return 'unknown';
    }
}
exports.NetCommerceService = NetCommerceService;
exports.default = NetCommerceService;
//# sourceMappingURL=netcommerceService.js.map