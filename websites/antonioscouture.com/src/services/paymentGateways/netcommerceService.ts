import { IPaymentGateway, PaymentData, PaymentResult, BankDebugReport } from '../paymentService';
import envConfig from '../../config/env.config';
import { getBaseUrl } from '../currentUrlProviderService';

/** Build gateway billing address from our billing shape (sample uses street, city, postcodeZip, country, etc.) */
function buildBillingAddress(addr: Record<string, unknown>): { address: Record<string, string> } {
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

/** Map gateway response codes to user-facing messages (aligned with sample gateway) */
function mapGatewayCodeToMessage(code: string | undefined): string {
  if (!code) return '';
  const messages: Record<string, string> = {
    DECLINED: 'Your card was declined.',
    EXPIRED_CARD: 'The card has expired. Please use a different card.',
    TIMED_OUT: 'The request timed out. Please try again.',
    ACQUIRER_SYSTEM_ERROR: 'The payment system is temporarily unavailable.',
    UNSPECIFIED_FAILURE: 'An error occurred with your card. Please check the details and try again.',
    AUTHORIZATION_FAILED: 'The card was not authorized. Please try a different card.'
  };
  return messages[code] || '';
}

interface NetcommerceConfig {
  merchantId: string;
  apiPassword: string;
  gatewayUrl: string;
  testMode: boolean;
  merchantName: string;
  partnerSolutionId: string;
  merchantEmail?: string;
  merchantPhone?: string;
  merchantLogoUrl?: string;
  merchantAddressLine1?: string;
  merchantAddressLine2?: string;
}

/**
 * NetCommerce Payment Gateway Service
 * Implements Mastercard Payment Gateway Services (MPGS) Direct Payment API
 * 
 * Documentation: https://creditlibanais-netcommerce.gateway.mastercard.com/api/documentation/integrationGuidelines/directPayment/integrationModelDirectPayment.html?locale=en_US
 */
export class NetCommerceService implements IPaymentGateway {
  private config: NetcommerceConfig;

  constructor(config?: Partial<NetcommerceConfig>) {
    let gatewayUrl = config?.gatewayUrl || envConfig.netcommerce.gatewayUrl;
    const apiVersion = process.env.NETCOMMERCE_API_VERSION || '100';
    // If URL is host-only (no /api/ path), append standard API path (version 100 matches Postman collection)
    if (gatewayUrl && !gatewayUrl.includes('/api/')) {
      gatewayUrl = gatewayUrl.replace(/\/$/, '') + '/api/rest/version/' + apiVersion;
    }
    const merchantEmail = config?.merchantEmail ?? envConfig.netcommerce.merchantEmail;
    const merchantPhone = config?.merchantPhone ?? envConfig.netcommerce.merchantPhone;
    const merchantLogoUrl = config?.merchantLogoUrl ?? envConfig.netcommerce.merchantLogoUrl;
    const merchantAddressLine1 = config?.merchantAddressLine1 ?? envConfig.netcommerce.merchantAddressLine1;
    const merchantAddressLine2 = config?.merchantAddressLine2 ?? envConfig.netcommerce.merchantAddressLine2;
    this.config = {
      merchantId: config?.merchantId || envConfig.netcommerce.merchantId,
      apiPassword: config?.apiPassword || envConfig.netcommerce.apiPassword,
      gatewayUrl,
      testMode: config?.testMode ?? envConfig.netcommerce.testMode,
      merchantName: config?.merchantName ?? envConfig.netcommerce.merchantName,
      partnerSolutionId: config?.partnerSolutionId ?? envConfig.netcommerce.partnerSolutionId,
      ...(merchantEmail !== undefined && { merchantEmail }),
      ...(merchantPhone !== undefined && { merchantPhone }),
      ...(merchantLogoUrl !== undefined && { merchantLogoUrl }),
      ...(merchantAddressLine1 !== undefined && { merchantAddressLine1 }),
      ...(merchantAddressLine2 !== undefined && { merchantAddressLine2 })
    };
  }

  /**
   * Process payment through NetCommerce (MPGS)
   */
  public async processPayment(data: PaymentData): Promise<PaymentResult> {
    try {
      // Validate configuration
      if (!this.config.merchantId || !this.config.apiPassword) {
        throw new Error('NetCommerce configuration missing (Merchant ID or API Password)');
      }

      const amountNum = Number(data.amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return {
          success: true,
          transactionId: `NETCOMMERCE-SKIP-ZERO-${data.orderId}-${Date.now()}`,
          gatewayResponse: {
            skipped: true,
            reason: 'zero_or_invalid_amount',
            amount: data.amount
          }
        };
      }

      // Hosted Checkout Session
      // POST https://{gatewayUrl}/api/rest/version/{version}/merchant/{merchantId}/session
      const url = `${this.config.gatewayUrl}/merchant/${this.config.merchantId}/session`;

      // Payload per Credit Libanais Hosted Checkout Ver.100 (Step 1: Create a Checkout Session).
      const gatewayOrderId = `ORDER-${data.orderId}-${Date.now()}`;
      const appBaseUrl = data.baseUrl ?? getBaseUrl();
      const returnUrl = data.returnUrl || `${appBaseUrl}/checkout/complete?orderId=${data.orderId}`;
      const merchantName = this.config.merchantName || 'Store';
      const customerNameParts = (data.customerName || '').trim().split(/\s+/);
      const customerFirstName = customerNameParts[0] || '';
      const customerLastName = customerNameParts.slice(1).join(' ') || '';

      const payload: Record<string, unknown> = {
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

      // Optional merchant fields (bank doc: interaction.merchant)
      if (this.config.merchantEmail) (payload.interaction as any).merchant.email = this.config.merchantEmail;
      if (this.config.merchantPhone) (payload.interaction as any).merchant.phone = this.config.merchantPhone;
      if (this.config.merchantLogoUrl) (payload.interaction as any).merchant.logo = this.config.merchantLogoUrl;
      if (this.config.merchantAddressLine1 || this.config.merchantAddressLine2) {
        (payload.interaction as any).merchant.address = {
          line1: this.config.merchantAddressLine1 || '',
          line2: this.config.merchantAddressLine2 || ''
        };
      }

      const requestSentAt = new Date().toISOString();
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': 'Basic [REDACTED]'
      };

      // Make Request (with timeout so we don't hang and cause client "fetch failed")
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      let response: Response;
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
      } finally {
        clearTimeout(timeoutId);
      }

      const responseReceivedAt = new Date().toISOString();
      let result: any;
      let responseBodyRaw = '';
      try {
        responseBodyRaw = await response.text();
        result = responseBodyRaw ? JSON.parse(responseBodyRaw) : {};
      } catch (_) {
        const bankDebugReport: BankDebugReport = {
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

      // Build bank debug report (for success or failure)
      const bankDebugReport: BankDebugReport = {
        requestSentAt,
        requestUrl: url,
        requestMethod: 'POST',
        requestHeaders,
        requestBody: payload,
        responseReceivedAt,
        responseStatus: response.status,
        responseBody: result
      };

      // Check Response – Step 2 per bank doc: redirect to OUR pay page which loads bank JS (Checkout.configure + Checkout.showPaymentPage).
      if (result.result === 'SUCCESS' && result.session && result.session.id) {
        const appBaseUrl = data.baseUrl ?? getBaseUrl();
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
      } else {
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

    } catch (error: any) {
      const cause = error.cause || error;
      const code = cause?.code || cause?.errno;
      const isUnreachable = code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || error.message === 'fetch failed';

      // In development: if gateway is unreachable, simulate success so you can test the full flow (redirect → complete → paid)
      // Set NETCOMMERCE_MOCK_IF_UNREACHABLE=false in .env to disable and see the real error.
      const mockIfUnreachable = process.env.NETCOMMERCE_MOCK_IF_UNREACHABLE !== 'false' &&
        (process.env.NETCOMMERCE_MOCK_IF_UNREACHABLE === 'true' || process.env.NODE_ENV === 'development');
      if (isUnreachable && mockIfUnreachable && data.returnUrl) {
        const mockSessionId = `mock-session-${data.orderId}-${Date.now()}`;
        const appBaseUrl = data.baseUrl ?? getBaseUrl();
        const payPageUrl = `${appBaseUrl}/checkout/pay?sessionId=${encodeURIComponent(mockSessionId)}&orderId=${data.orderId}`;
        console.warn('NetCommerce: gateway unreachable – using mock redirect (no bank page). Set NETCOMMERCE_GATEWAY_URL to a reachable gateway for real redirect.');
        const mockReport: BankDebugReport = {
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

  /**
   * Retrieve session from gateway (after redirect from hosted checkout) to confirm payment result.
   * GET merchant/{merchantId}/session/{sessionId}
   */
  public async retrieveSession(sessionId: string): Promise<{ success: boolean; result?: string; order?: any; error?: string }> {
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
    } catch (error: any) {
      console.error('NetCommerce retrieveSession error:', error);
      return { success: false, error: error.message || 'Failed to retrieve session' };
    }
  }

  /**
   * Retrieve order from gateway (after redirect from hosted checkout).
   * Per Hosted Checkout doc: "To consider the payment as successful, check: result = SUCCESS, status = CAPTURED."
   * GET merchant/{merchantId}/order/{orderId}
   * @see https://creditlibanais-netcommerce.gateway.mastercard.com/api/documentation/apiDocumentation/rest-json/version/latest/operation/Transaction%3a%20%20Retrieve%20Order.html
   */
  public async retrieveOrder(gatewayOrderId: string): Promise<{ success: boolean; result?: string; status?: string; order?: any; error?: string }> {
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
      // Doc: result = SUCCESS and status = CAPTURED. Also accept AUTHORIZED (auth-only) and PARTIALLY_CAPTURED.
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
    } catch (error: any) {
      console.error('NetCommerce retrieveOrder error:', error);
      return { success: false, error: error.message || 'Failed to retrieve order' };
    }
  }

  /**
   * Refund payment
   */
  public async refundPayment(transactionId: string, amount: number): Promise<PaymentResult> {
    // NOTE: Providing a basic implementation. 
    // Refund usually requires the original order ID and a new transaction ID for the refund.
    // This signature might need adjustment if we don't store the original order ID with the transaction ID properly or if the gateway requires it.
    // For MPGS, refund is usually PUT .../order/{orderId}/transaction/{refundTxnId}

    // For now, returning not implemented as it requires more context (original order ID) than just transaction ID, 
    // or we need to look up the transaction in DB to get the order ID.
    return {
      success: false,
      error: 'Refund not fully implemented for Netcommerce yet.'
    };
  }

  public async getPaymentStatus(transactionId: string): Promise<string> {
    return 'unknown';
  }
}

export default NetCommerceService;
