import { db } from '../../src/config/database';

export interface PricePerMeter {
  year: number;
  price: number;
}

export const DEFAULT_YEARLY_INTEREST_RATE = 5;
const YEARLY_INTEREST_RATE_TYPE = 'yearly_interest_rate';

export function formatYearlyInterestRate(rate: number): string {
  return String(parseFloat(Number(rate).toFixed(2)));
}

export class PaymentsService {
  private static instance: PaymentsService;

  private constructor() {}

  public static getInstance(): PaymentsService {
    if (!PaymentsService.instance) {
      PaymentsService.instance = new PaymentsService();
    }
    return PaymentsService.instance;
  }

  /**
   * Get all price per meter entries
   */
  public async getAllPricePerMeter(): Promise<PricePerMeter[]> {
    try {
      const [rows] = await db.query(`
        SELECT year, amount as price
        FROM common_expenses_settings
        WHERE payment_type = 'price_per_meter'
        ORDER BY year ASC
      `);
      return (rows as any[]).map(row => ({
        year: parseInt(row.year),
        price: parseFloat(row.price)
      }));
    } catch (error) {
      console.error('Error fetching price per meter:', error);
      return [];
    }
  }

  /**
   * Get price per meter for a specific year
   */
  public async getPriceForYear(year: number): Promise<number | null> {
    try {
      const [rows] = await db.query(`
        SELECT amount as price
        FROM common_expenses_settings
        WHERE year = ? AND payment_type = 'price_per_meter'
      `, [year]);
      
      const results = rows as any[];
      return results.length > 0 ? parseFloat(results[0].price) : null;
    } catch (error) {
      console.error('Error fetching price for year:', error);
      return null;
    }
  }

  /**
   * Add or update price per meter for a year
   */
  public async setPriceForYear(year: number, price: number): Promise<boolean> {
    try {
      // Check if entry exists
      const existing = await this.getPriceForYear(year);
      
      if (existing !== null) {
        // Update existing
        await db.query(`
          UPDATE common_expenses_settings
          SET amount = ?
          WHERE year = ? AND payment_type = 'price_per_meter'
        `, [price, year]);
      } else {
        // Insert new
        await db.query(`
          INSERT INTO common_expenses_settings (name, amount, year, payment_type)
          VALUES (?, ?, ?, 'price_per_meter')
        `, [`Price per meter ${year}`, price, year]);
      }
      
      return true;
    } catch (error) {
      console.error('Error setting price for year:', error);
      return false;
    }
  }

  /**
   * Delete price per meter entry for a year
   */
  public async deletePriceForYear(year: number): Promise<boolean> {
    try {
      const [result] = await db.query(`
        DELETE FROM common_expenses_settings
        WHERE year = ? AND payment_type = 'price_per_meter'
      `, [year]);
      
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error deleting price for year:', error);
      return false;
    }
  }

  /**
   * Global yearly interest rate (percent). Defaults to 5 if unset.
   */
  public async getYearlyInterestRate(): Promise<number> {
    try {
      const [rows] = await db.query(`
        SELECT amount
        FROM common_expenses_settings
        WHERE payment_type = ?
        ORDER BY id DESC
        LIMIT 1
      `, [YEARLY_INTEREST_RATE_TYPE]);

      const results = rows as any[];
      if (results.length === 0) {
        return DEFAULT_YEARLY_INTEREST_RATE;
      }
      const rate = parseFloat(results[0].amount);
      return Number.isFinite(rate) ? rate : DEFAULT_YEARLY_INTEREST_RATE;
    } catch (error) {
      console.error('Error fetching yearly interest rate:', error);
      return DEFAULT_YEARLY_INTEREST_RATE;
    }
  }

  /**
   * Upsert the global yearly interest rate (percent).
   */
  public async setYearlyInterestRate(rate: number): Promise<boolean> {
    try {
      const [rows] = await db.query(`
        SELECT id FROM common_expenses_settings
        WHERE payment_type = ?
        LIMIT 1
      `, [YEARLY_INTEREST_RATE_TYPE]);

      if ((rows as any[]).length > 0) {
        await db.query(`
          UPDATE common_expenses_settings
          SET amount = ?, name = ?
          WHERE payment_type = ?
        `, [rate, 'Yearly interest rate', YEARLY_INTEREST_RATE_TYPE]);
      } else {
        await db.query(`
          INSERT INTO common_expenses_settings (name, amount, year, payment_type)
          VALUES (?, ?, 0, ?)
        `, ['Yearly interest rate', rate, YEARLY_INTEREST_RATE_TYPE]);
      }

      return true;
    } catch (error) {
      console.error('Error setting yearly interest rate:', error);
      return false;
    }
  }

  /**
   * Get payment statistics
   */
  public async getPaymentStats(): Promise<{
    totalYears: number;
    averagePrice: number;
    latestYear: number | null;
    latestPrice: number | null;
  }> {
    try {
      const [rows] = await db.query(`
        SELECT 
          COUNT(*) as totalYears,
          AVG(amount) as averagePrice,
          MAX(year) as latestYear,
          (SELECT amount FROM common_expenses_settings WHERE payment_type = 'price_per_meter' ORDER BY year DESC LIMIT 1) as latestPrice
        FROM common_expenses_settings
        WHERE payment_type = 'price_per_meter'
      `);
      
      const stats = (rows as any)[0];
      return {
        totalYears: parseInt(stats.totalYears) || 0,
        averagePrice: parseFloat(stats.averagePrice) || 0,
        latestYear: stats.latestYear ? parseInt(stats.latestYear) : null,
        latestPrice: stats.latestPrice ? parseFloat(stats.latestPrice) : null
      };
    } catch (error) {
      console.error('Error getting payment stats:', error);
      return {
        totalYears: 0,
        averagePrice: 0,
        latestYear: null,
        latestPrice: null
      };
    }
  }
}
