import { db } from '../config/database';

export interface PaymentMethod {
  id: number;
  name: string;
  code: string;
  type: 'gateway' | 'manual';
  description: string | null;
  config: string | null; // JSON
  is_active: boolean;
  order_index: number;
  created_at: Date;
  updated_at: Date;
}

/** Debug report for bank/gateway communication (sent to bank, received, redirect) */
export interface BankDebugReport {
  requestSentAt: string;   // ISO timestamp
  requestUrl: string;
  requestMethod: string;
  requestHeaders: Record<string, string>; // Auth redacted
  requestBody: unknown;
  responseReceivedAt: string; // ISO timestamp
  responseStatus: number;
  responseBody: unknown;
  redirectUrl?: string;
  redirectAt?: string;     // ISO timestamp when redirect was returned to client
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  gatewayResponse?: any;
  redirectUrl?: string; // For hosted checkout/redirection
  sessionId?: string;   // For hosted session
  /** Gateway order ID (e.g. ORDER-33-123) for Retrieve Order after redirect */
  gatewayOrderId?: string;
  bankDebugReport?: BankDebugReport;
}

export interface PaymentData {
  orderId: number;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  /** Customer phone for gateway (e.g. bank Hosted Checkout Step 1 customer.mobilePhone/phone) */
  customerPhone?: string;
  billingAddress?: any;
  paymentMethodId: number;
  returnUrl?: string;
  cancelUrl?: string;
  /** Base URL for the app (e.g. for redirects). When provided, gateways use this instead of inferring from env. */
  baseUrl?: string;
  cardToken?: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  cardholderName?: string;
}

export interface IPaymentGateway {
  processPayment(data: PaymentData): Promise<PaymentResult>;
  refundPayment(transactionId: string, amount: number): Promise<PaymentResult>;
  getPaymentStatus(transactionId: string): Promise<string>;
}

export class PaymentService {
  private static instance: PaymentService;
  private gateways: Map<string, IPaymentGateway> = new Map();

  private constructor() {
    // Register payment gateways
    this.initializeGateways();
  }

  /**
   * Initialize and register payment gateways
   */
  private initializeGateways(): void {
    // Register Cash on Delivery
    const CashOnDeliveryService = require('./paymentGateways/cashOnDeliveryService').default;
    this.registerGateway('cash_on_delivery', new CashOnDeliveryService());

    // Register NetCommerce
    const NetCommerceService = require('./paymentGateways/netcommerceService').default;
    const netcommerce = new NetCommerceService();
    this.registerGateway('netcommerce', netcommerce);
  }

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Register a payment gateway
   */
  public registerGateway(code: string, gateway: IPaymentGateway): void {
    this.gateways.set(code, gateway);
  }

  /**
   * Whether the country is Lebanon (LB or "Lebanon").
   */
  private isLebanon(countryCode?: string): boolean {
    if (!countryCode || typeof countryCode !== 'string') return false;
    const c = countryCode.trim().toUpperCase();
    return c === 'LB' || c === 'LEBANON';
  }

  /**
   * Get all active payment methods for a country.
   * Lebanon: Pay on delivery (cash_on_delivery) only — no Credit Card.
   * All other countries: Pay by card (netcommerce) only.
   */
  public async getActivePaymentMethods(countryCode?: string): Promise<PaymentMethod[]> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM payment_methods WHERE is_active = TRUE ORDER BY order_index ASC, id ASC'
      );

      let filtered = rows.filter((method: PaymentMethod) => {
        if (!countryCode) return true;

        let config: any = method.config;
        if (typeof config === 'string') {
          try {
            config = JSON.parse(config);
          } catch (e) {
            config = {};
          }
        }

        // Check allowedCountries from method config
        if (config && Array.isArray(config.allowedCountries) && config.allowedCountries.length > 0) {
          return config.allowedCountries.includes(countryCode.toUpperCase());
        }

        return true;
      });

      // Country-based rules: Lebanon = pay on delivery only; other countries = pay by card only
      if (countryCode) {
        const lebanon = this.isLebanon(countryCode);
        const allowedCodes = lebanon ? ['cash_on_delivery'] : ['netcommerce'];
        filtered = filtered.filter((method: PaymentMethod) => allowedCodes.includes(method.code));
      }

      return filtered;
    } catch (error) {
      console.error('Error getting active payment methods:', error);
      throw error;
    }
  }

  /**
   * Get payment method by code
   */
  public async getPaymentMethodByCode(code: string): Promise<PaymentMethod | null> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM payment_methods WHERE code = ? AND is_active = TRUE',
        [code]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting payment method by code:', error);
      throw error;
    }
  }

  /**
   * Get payment method by ID
   */
  public async getPaymentMethodById(id: number): Promise<PaymentMethod | null> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM payment_methods WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting payment method by id:', error);
      throw error;
    }
  }

  /**
   * Process payment
   */
  public async processPayment(data: PaymentData): Promise<PaymentResult> {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Get payment method
      const [methodRows] = await connection.query<any>(
        'SELECT * FROM payment_methods WHERE id = ?',
        [data.paymentMethodId]
      );

      if (methodRows.length === 0) {
        throw new Error('Payment method not found');
      }

      const paymentMethod = methodRows[0];

      // Handle manual payment methods (like Cash on Delivery)
      if (paymentMethod.type === 'manual') {
        // For manual payments, just record the transaction
        const [result] = await connection.query<any>(
          `INSERT INTO payment_transactions (
            order_id, payment_method_id, amount, currency, status
          ) VALUES (?, ?, ?, ?, 'pending')`,
          [data.orderId, data.paymentMethodId, data.amount, data.currency]
        );

        await connection.commit();

        return {
          success: true,
          transactionId: (result as any).insertId.toString()
        };
      }

      // Handle gateway payments
      if (paymentMethod.type === 'gateway') {
        const gateway = this.gateways.get(paymentMethod.code);
        if (!gateway) {
          throw new Error(`Payment gateway ${paymentMethod.code} not registered`);
        }

        // Process payment through gateway
        const result = await gateway.processPayment(data);

        // Hosted checkout: success + redirectUrl means user must complete payment on gateway; keep order pending
        const isHostedCheckoutRedirect = result.success && !!result.redirectUrl;

        // Record transaction (pending for hosted checkout until callback confirms payment)
        const gatewayResponseToStore = result.gatewayResponse
          ? { ...result.gatewayResponse, gatewayOrderId: result.gatewayOrderId ?? result.gatewayResponse?.order?.id }
          : null;
        const [transResult] = await connection.query<any>(
          `INSERT INTO payment_transactions (
            order_id, payment_method_id, transaction_id, amount, currency, 
            status, gateway_response
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            data.orderId,
            data.paymentMethodId,
            result.transactionId || result.sessionId || null,
            data.amount,
            data.currency,
            isHostedCheckoutRedirect ? 'pending' : (result.success ? 'completed' : 'failed'),
            gatewayResponseToStore ? JSON.stringify(gatewayResponseToStore) : null
          ]
        );

        if (result.success && !isHostedCheckoutRedirect) {
          // Immediate success (e.g. non-redirect gateway): mark order paid
          await connection.query(
            'UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?',
            ['paid', data.orderId]
          );
        } else if (!result.success) {
          // Gateway reported failure
          await connection.query(
            'UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?',
            ['failed', data.orderId]
          );
          await connection.query(
            'UPDATE payment_transactions SET failure_reason = ? WHERE id = ?',
            [result.error || 'Payment failed', (transResult as any).insertId]
          );
        }
        // If isHostedCheckoutRedirect: order stays payment_status = pending until checkout/complete callback

        await connection.commit();

        return {
          ...result,
          transactionId: (transResult as any).insertId.toString()
        };
      }

      throw new Error('Unknown payment method type');
    } catch (error: any) {
      await connection.rollback();
      console.error('Error processing payment:', error);
      return {
        success: false,
        error: error.message || 'Payment processing failed'
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Record transaction (for manual payments)
   */
  public async recordTransaction(
    orderId: number,
    paymentMethodId: number,
    amount: number,
    currency: string,
    status: string = 'pending',
    transactionId?: string,
    gatewayResponse?: any
  ): Promise<number> {
    try {
      const [result] = await db.query<any>(
        `INSERT INTO payment_transactions (
          order_id, payment_method_id, transaction_id, amount, currency, 
          status, gateway_response
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          paymentMethodId,
          transactionId || null,
          amount,
          currency,
          status,
          gatewayResponse ? JSON.stringify(gatewayResponse) : null
        ]
      );

      return (result as any).insertId;
    } catch (error) {
      console.error('Error recording transaction:', error);
      throw error;
    }
  }

  /**
   * Get transaction by ID
   */
  public async getTransaction(transactionId: number): Promise<any> {
    try {
      const [rows] = await db.query<any>(
        `SELECT t.*, pm.name as payment_method_name, pm.code as payment_method_code
        FROM payment_transactions t
        LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
        WHERE t.id = ?`,
        [transactionId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting transaction:', error);
      throw error;
    }
  }

  /**
   * Get transactions for order
   */
  public async getOrderTransactions(orderId: number): Promise<any[]> {
    try {
      const [rows] = await db.query<any>(
        `SELECT t.*, pm.name as payment_method_name, pm.code as payment_method_code
        FROM payment_transactions t
        LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
        WHERE t.order_id = ?
        ORDER BY t.created_at DESC`,
        [orderId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting order transactions:', error);
      throw error;
    }
  }

  /**
   * Initialize default payment methods
   */
  public async initializeDefaultPaymentMethods(): Promise<void> {
    try {
      // Check if methods already exist
      const [existing] = await db.query<any>(
        'SELECT id FROM payment_methods LIMIT 1'
      );

      if (existing.length > 0) {
        return; // Already initialized
      }

      // Insert Cash on Delivery
      await db.query(
        `INSERT INTO payment_methods (name, code, type, description, is_active, order_index)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'Cash on Delivery',
          'cash_on_delivery',
          'manual',
          'Pay with cash when your order is delivered',
          true,
          1
        ]
      );

      // Insert NetCommerce placeholder (will be configured later)
      await db.query(
        `INSERT INTO payment_methods (name, code, type, description, config, is_active, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'Pay with bank card',
          'netcommerce',
          'gateway',
          'Pay with bank card',
          JSON.stringify({ testMode: true }),
          true,
          2
        ]
      );
    } catch (error) {
      console.error('Error initializing default payment methods:', error);
      // Don't throw - this is a setup operation
    }
  }
}

export default PaymentService.getInstance();

