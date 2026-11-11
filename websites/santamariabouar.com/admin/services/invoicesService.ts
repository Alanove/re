import { db } from '../../src/config/database';
import { PaymentsService } from './paymentsService';
import { ApartmentsService } from './apartmentsService';
import { InvoiceTransactionsService } from './invoiceTransactionsService';

export interface Invoice {
  id: number;
  apartmentId: number;
  categoryId: number;
  amount: number;
  description: string;
  dueDate: string | null;
  invoiceDate: string;
  status: 'unpaid' | 'partial' | 'paid';  // Computed from invoice_transactions
  amountPaid: number;  // Computed from invoice_transactions
  year: number | null;
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  // Enriched fields
  apartment?: any;
  category?: any;
  categoryName?: string;
  categoryColor?: string;
}

export interface InvoiceFilters {
  apartmentId?: number;
  categoryId?: number;
  status?: string;
  block?: string;
  year?: number;
  searchTerm?: string;
}

export interface InterestSimulationApartment {
  id: number;
  unitNumber: string;
  unitNumberUnofficial: string;
  block: string;
  ownerName: string;
  outstandingBase: number;
  amount: number;
  exists: boolean;
}

export interface InterestSimulationBlock {
  block: string;
  totalOutstanding: number;
  totalAmount: number;
  apartments: InterestSimulationApartment[];
}

export class InvoicesService {
  private static instance: InvoicesService;
  private paymentsService: PaymentsService;
  private apartmentsService: ApartmentsService;
  private invoiceTransactionsService: InvoiceTransactionsService;

  private constructor() {
    this.paymentsService = PaymentsService.getInstance();
    this.apartmentsService = ApartmentsService.getInstance();
    this.invoiceTransactionsService = InvoiceTransactionsService.getInstance();
  }

  public static getInstance(): InvoicesService {
    if (!InvoicesService.instance) {
      InvoicesService.instance = new InvoicesService();
    }
    return InvoicesService.instance;
  }

  /**
   * Get invoice status from invoice_transactions
   */
  private async getInvoiceStatus(invoiceId: number): Promise<'unpaid' | 'partial' | 'paid'> {
    const amountPaid = await this.invoiceTransactionsService.getTotalPaidForInvoice(invoiceId);
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) return 'unpaid';
    
    if (amountPaid >= invoice.amount) {
      return 'paid';
    } else if (amountPaid > 0) {
      return 'partial';
    }
    return 'unpaid';
  }

  /**
   * Get invoice amount paid from invoice_transactions
   */
  private async getInvoiceAmountPaid(invoiceId: number): Promise<number> {
    return await this.invoiceTransactionsService.getTotalPaidForInvoice(invoiceId);
  }

  /**
   * Get all invoices with computed status and amountPaid
   */
  public async getAllInvoices(): Promise<Invoice[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          i.id,
          i.apartment_id as apartmentId,
          i.category_id as categoryId,
          i.amount,
          i.description,
          DATE_FORMAT(i.due_date, '%Y-%m-%d') as dueDate,
          DATE_FORMAT(i.invoice_date, '%Y-%m-%d') as invoiceDate,
          i.year,
          i.notes,
          i.created_by as createdBy,
          DATE_FORMAT(i.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(i.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          COALESCE(SUM(it.amount), 0) as amountPaid,
          CASE 
            WHEN COALESCE(SUM(it.amount), 0) >= i.amount THEN 'paid'
            WHEN COALESCE(SUM(it.amount), 0) > 0 THEN 'partial'
            ELSE 'unpaid'
          END as status
        FROM invoices i
        LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
        GROUP BY i.id, i.apartment_id, i.category_id, i.amount, i.description, i.due_date, i.invoice_date, i.year, i.notes, i.created_by, i.created_at, i.updated_at
        ORDER BY i.invoice_date DESC, i.id DESC
      `);
      return (rows as any[]).map(row => this.mapRowToInvoice(row));
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return [];
    }
  }

  /**
   * Get invoice by ID with computed status
   */
  public async getInvoiceById(id: number): Promise<Invoice | null> {
    try {
      const [rows] = await db.query(`
        SELECT 
          i.id,
          i.apartment_id as apartmentId,
          i.category_id as categoryId,
          i.amount,
          i.description,
          DATE_FORMAT(i.due_date, '%Y-%m-%d') as dueDate,
          DATE_FORMAT(i.invoice_date, '%Y-%m-%d') as invoiceDate,
          i.year,
          i.notes,
          i.created_by as createdBy,
          DATE_FORMAT(i.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(i.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          COALESCE(SUM(it.amount), 0) as amountPaid,
          CASE 
            WHEN COALESCE(SUM(it.amount), 0) >= i.amount THEN 'paid'
            WHEN COALESCE(SUM(it.amount), 0) > 0 THEN 'partial'
            ELSE 'unpaid'
          END as status
        FROM invoices i
        LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
        WHERE i.id = ?
        GROUP BY i.id, i.apartment_id, i.category_id, i.amount, i.description, i.due_date, i.invoice_date, i.year, i.notes, i.created_by, i.created_at, i.updated_at
      `, [id]);
      const invoices = (rows as any[]).map(row => this.mapRowToInvoice(row));
      return invoices[0] || null;
    } catch (error) {
      console.error('Error fetching invoice by ID:', error);
      return null;
    }
  }

  /**
   * Get invoices by apartment
   */
  public async getInvoicesByApartment(apartmentId: number): Promise<Invoice[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          i.id,
          i.apartment_id as apartmentId,
          i.category_id as categoryId,
          i.amount,
          i.description,
          DATE_FORMAT(i.due_date, '%Y-%m-%d') as dueDate,
          DATE_FORMAT(i.invoice_date, '%Y-%m-%d') as invoiceDate,
          i.year,
          i.notes,
          i.created_by as createdBy,
          DATE_FORMAT(i.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(i.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          COALESCE(SUM(it.amount), 0) as amountPaid,
          CASE 
            WHEN COALESCE(SUM(it.amount), 0) >= i.amount THEN 'paid'
            WHEN COALESCE(SUM(it.amount), 0) > 0 THEN 'partial'
            ELSE 'unpaid'
          END as status
        FROM invoices i
        LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
        WHERE i.apartment_id = ?
        GROUP BY i.id, i.apartment_id, i.category_id, i.amount, i.description, i.due_date, i.invoice_date, i.year, i.notes, i.created_by, i.created_at, i.updated_at
        ORDER BY i.invoice_date DESC, i.id DESC
      `, [apartmentId]);
      return (rows as any[]).map(row => this.mapRowToInvoice(row));
    } catch (error) {
      console.error('Error fetching invoices by apartment:', error);
      return [];
    }
  }

  /**
   * Get unpaid/partial invoices with filters
   */
  public async getUnpaidInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
    try {
      let query = `
        SELECT 
          i.id,
          i.apartment_id as apartmentId,
          i.category_id as categoryId,
          i.amount,
          i.description,
          DATE_FORMAT(i.due_date, '%Y-%m-%d') as dueDate,
          DATE_FORMAT(i.invoice_date, '%Y-%m-%d') as invoiceDate,
          i.year,
          i.notes,
          i.created_by as createdBy,
          DATE_FORMAT(i.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(i.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          tc.name as categoryName,
          tc.color as categoryColor,
          COALESCE(SUM(it.amount), 0) as amountPaid,
          CASE 
            WHEN COALESCE(SUM(it.amount), 0) >= i.amount THEN 'paid'
            WHEN COALESCE(SUM(it.amount), 0) > 0 THEN 'partial'
            ELSE 'unpaid'
          END as status
        FROM invoices i
        LEFT JOIN apartments a ON i.apartment_id = a.id
        LEFT JOIN transaction_categories tc ON i.category_id = tc.id
        LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (filters) {
        if (filters.apartmentId) {
          query += ` AND i.apartment_id = ?`;
          params.push(filters.apartmentId);
        }
        if (filters.categoryId) {
          query += ` AND i.category_id = ?`;
          params.push(filters.categoryId);
        }
        if (filters.block) {
          query += ` AND a.floor = ?`;
          params.push(filters.block);
        }
        if (filters.year) {
          query += ` AND i.year = ?`;
          params.push(filters.year);
        }
        if (filters.searchTerm) {
          query += ` AND (i.description LIKE ? OR a.apartment_number LIKE ? OR a.apartment_number_unofficial LIKE ? OR a.floor LIKE ? OR a.owner_name LIKE ? OR CONCAT("Block ", a.floor, " ", a.apartment_number, " ", a.apartment_number_unofficial) LIKE ?)`;
          const searchPattern = `%${filters.searchTerm}%`;
          params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }
      }

      query += ` 
        GROUP BY i.id, i.apartment_id, i.category_id, i.amount, i.description, i.due_date, i.invoice_date, i.year, i.notes, i.created_by, i.created_at, i.updated_at, tc.name, tc.color
        HAVING COALESCE(SUM(it.amount), 0) < i.amount
          AND i.amount > 0
          AND (i.amount - COALESCE(SUM(it.amount), 0)) > 0
        ORDER BY i.invoice_date DESC, i.id DESC
      `;

      const [rows] = await db.query(query, params);
      return (rows as any[]).map(row => this.mapRowToInvoice(row));
    } catch (error) {
      console.error('Error fetching unpaid invoices:', error);
      return [];
    }
  }

  /**
   * Get overpaid invoices (credits) with filters
   * These are invoices where amountPaid > amount (overpaid / credit balance)
   */
  public async getOverpaidInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
    try {
      let query = `
        SELECT 
          i.id,
          i.apartment_id as apartmentId,
          i.category_id as categoryId,
          i.amount,
          i.description,
          DATE_FORMAT(i.due_date, '%Y-%m-%d') as dueDate,
          DATE_FORMAT(i.invoice_date, '%Y-%m-%d') as invoiceDate,
          i.year,
          i.notes,
          i.created_by as createdBy,
          DATE_FORMAT(i.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(i.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          COALESCE(SUM(it.amount), 0) as amountPaid,
          CASE 
            WHEN COALESCE(SUM(it.amount), 0) >= i.amount THEN 'paid'
            WHEN COALESCE(SUM(it.amount), 0) > 0 THEN 'partial'
            ELSE 'unpaid'
          END as status
        FROM invoices i
        LEFT JOIN apartments a ON i.apartment_id = a.id
        LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (filters) {
        if (filters.apartmentId) {
          query += ` AND i.apartment_id = ?`;
          params.push(filters.apartmentId);
        }
        if (filters.categoryId) {
          query += ` AND i.category_id = ?`;
          params.push(filters.categoryId);
        }
        if (filters.block) {
          query += ` AND a.floor = ?`;
          params.push(filters.block);
        }
        if (filters.year) {
          query += ` AND i.year = ?`;
          params.push(filters.year);
        }
        if (filters.searchTerm) {
          query += ` AND (i.description LIKE ? OR a.apartment_number LIKE ? OR a.apartment_number_unofficial LIKE ? OR a.floor LIKE ? OR a.owner_name LIKE ? OR CONCAT("Block ", a.floor, " ", a.apartment_number, " ", a.apartment_number_unofficial) LIKE ?)`;
          const searchPattern = `%${filters.searchTerm}%`;
          params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }
      }

      query += ` 
        GROUP BY i.id, i.apartment_id, i.category_id, i.amount, i.description, i.due_date, i.invoice_date, i.year, i.notes, i.created_by, i.created_at, i.updated_at
        HAVING COALESCE(SUM(it.amount), 0) > i.amount
          AND i.amount > 0
        ORDER BY i.invoice_date DESC, i.id DESC
      `;

      const [rows] = await db.query(query, params);
      return (rows as any[]).map(row => this.mapRowToInvoice(row));
    } catch (error) {
      console.error('Error fetching overpaid invoices:', error);
      return [];
    }
  }

  /**
   * Create new invoice
   */
  public async createInvoice(invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'amountPaid'>): Promise<Invoice> {
    try {
      const [result] = await db.query(`
        INSERT INTO invoices (
          apartment_id, category_id, amount, description, due_date, invoice_date,
          year, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceData.apartmentId,
        invoiceData.categoryId,
        invoiceData.amount,
        invoiceData.description,
        invoiceData.dueDate || null,
        invoiceData.invoiceDate,
        invoiceData.year || null,
        invoiceData.notes || null,
        invoiceData.createdBy || null
      ]);

      const insertId = (result as any).insertId;
      const newInvoice = await this.getInvoiceById(insertId);
      if (!newInvoice) throw new Error('Failed to retrieve created invoice');
      return newInvoice;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  }

  /**
   * Update invoice
   */
  public async updateInvoice(id: number, updateData: Partial<Omit<Invoice, 'id' | 'createdAt' | 'createdBy' | 'status' | 'amountPaid'>>): Promise<Invoice | null> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];

      if (updateData.apartmentId !== undefined) {
        updateFields.push('apartment_id = ?');
        values.push(updateData.apartmentId);
      }
      if (updateData.categoryId !== undefined) {
        updateFields.push('category_id = ?');
        values.push(updateData.categoryId);
      }
      if (updateData.amount !== undefined) {
        updateFields.push('amount = ?');
        values.push(updateData.amount);
      }
      if (updateData.description !== undefined) {
        updateFields.push('description = ?');
        values.push(updateData.description);
      }
      if (updateData.dueDate !== undefined) {
        updateFields.push('due_date = ?');
        values.push(updateData.dueDate || null);
      }
      if (updateData.invoiceDate !== undefined) {
        updateFields.push('invoice_date = ?');
        values.push(updateData.invoiceDate);
      }
      if (updateData.year !== undefined) {
        updateFields.push('year = ?');
        values.push(updateData.year || null);
      }
      if (updateData.notes !== undefined) {
        updateFields.push('notes = ?');
        values.push(updateData.notes || null);
      }

      if (updateFields.length === 0) {
        return await this.getInvoiceById(id);
      }

      values.push(id);
      await db.query(`
        UPDATE invoices
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, values);

      return await this.getInvoiceById(id);
    } catch (error) {
      console.error('Error updating invoice:', error);
      return null;
    }
  }

  /**
   * Delete invoice
   */
  public async deleteInvoice(id: number): Promise<boolean> {
    try {
      const [result] = await db.query(`
        DELETE FROM invoices WHERE id = ?
      `, [id]);
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error deleting invoice:', error);
      return false;
    }
  }

  /**
   * Recalculate invoice amounts from invoice_transactions
   * This method is now simplified since status is computed on-the-fly
   */
  public async recalculateInvoiceAmountsFromTransactions(invoiceId?: number): Promise<void> {
    try {
      // Status and amountPaid are now computed on-the-fly from invoice_transactions
      // This method is kept for backward compatibility but doesn't need to do anything
      // since the data is always computed from invoice_transactions
      console.log('Invoice status and amountPaid are computed on-the-fly from invoice_transactions. No recalculation needed.');
    } catch (error) {
      console.error('Error recalculating invoice amounts from transactions:', error);
    }
  }

  /**
   * Get invoices grouped by block
   */
  public async getInvoicesByBlock(block: string): Promise<Invoice[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          i.id,
          i.apartment_id as apartmentId,
          i.category_id as categoryId,
          i.amount,
          i.description,
          DATE_FORMAT(i.due_date, '%Y-%m-%d') as dueDate,
          DATE_FORMAT(i.invoice_date, '%Y-%m-%d') as invoiceDate,
          i.year,
          i.notes,
          i.created_by as createdBy,
          DATE_FORMAT(i.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(i.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          COALESCE(SUM(it.amount), 0) as amountPaid,
          CASE 
            WHEN COALESCE(SUM(it.amount), 0) >= i.amount THEN 'paid'
            WHEN COALESCE(SUM(it.amount), 0) > 0 THEN 'partial'
            ELSE 'unpaid'
          END as status
        FROM invoices i
        LEFT JOIN apartments a ON i.apartment_id = a.id
        LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
        WHERE a.floor = ?
        GROUP BY i.id, i.apartment_id, i.category_id, i.amount, i.description, i.due_date, i.invoice_date, i.year, i.notes, i.created_by, i.created_at, i.updated_at
        ORDER BY i.invoice_date DESC, i.id DESC
      `, [block]);
      return (rows as any[]).map(row => this.mapRowToInvoice(row));
    } catch (error) {
      console.error('Error fetching invoices by block:', error);
      return [];
    }
  }

  /**
   * Get common expense invoices for a year (identified by category)
   */
  public async getCommonExpenseInvoices(year: number, apartmentId?: number): Promise<Invoice[]> {
    try {
      let query = `
        SELECT 
          i.id,
          i.apartment_id as apartmentId,
          i.category_id as categoryId,
          i.amount,
          i.description,
          DATE_FORMAT(i.due_date, '%Y-%m-%d') as dueDate,
          DATE_FORMAT(i.invoice_date, '%Y-%m-%d') as invoiceDate,
          i.year,
          i.notes,
          i.created_by as createdBy,
          DATE_FORMAT(i.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(i.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          COALESCE(SUM(it.amount), 0) as amountPaid,
          CASE 
            WHEN COALESCE(SUM(it.amount), 0) >= i.amount THEN 'paid'
            WHEN COALESCE(SUM(it.amount), 0) > 0 THEN 'partial'
            ELSE 'unpaid'
          END as status
        FROM invoices i
        LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
        LEFT JOIN transaction_categories tc ON i.category_id = tc.id
        WHERE LOWER(tc.name) = 'common expenses' AND i.year = ?
        GROUP BY i.id, i.apartment_id, i.category_id, i.amount, i.description, i.due_date, i.invoice_date, i.year, i.notes, i.created_by, i.created_at, i.updated_at
      `;
      const params: any[] = [year];

      if (apartmentId) {
        query += ` AND i.apartment_id = ?`;
        params.push(apartmentId);
      }

      query += ` ORDER BY i.invoice_date DESC, i.id DESC`;

      const [rows] = await db.query(query, params);
      return (rows as any[]).map(row => this.mapRowToInvoice(row));
    } catch (error) {
      console.error('Error fetching common expense invoices:', error);
      return [];
    }
  }

  /**
   * Get available years from invoices
   */
  public async getAvailableYears(): Promise<number[]> {
    try {
      const [rows] = await db.query(`
        SELECT DISTINCT year FROM invoices WHERE year IS NOT NULL ORDER BY year DESC
      `);
      return (rows as any[]).map(row => row.year);
    } catch (error) {
      console.error('Error fetching available years:', error);
      return [];
    }
  }

  /**
   * Generate common expense invoices for a year
   */
  public async createCommonExpenseInvoices(year: number, apartmentIds?: number[]): Promise<{ success: boolean; message: string; newInvoicesCount: number }> {
    try {
      const pricePerM2 = await this.paymentsService.getPriceForYear(year);
      if (!pricePerM2) {
        throw new Error(`No price per meter defined for year ${year}`);
      }

      // Get Common Expenses category
      const [categoryRows] = await db.query(`
        SELECT id FROM transaction_categories WHERE LOWER(name) = 'common expenses'
      `);
      if ((categoryRows as any[]).length === 0) {
        throw new Error('Common Expenses category not found');
      }
      const categoryId = (categoryRows as any[])[0].id;

      // Get apartments (exclude not sold — they should not receive common expense invoices)
      let apartments: any[] = [];
      if (apartmentIds && apartmentIds.length > 0) {
        apartments = await Promise.all(
          apartmentIds.map(id => this.apartmentsService.getApartmentById(id))
        );
        apartments = apartments.filter(apt => apt !== null) as any[];
      } else {
        apartments = await this.apartmentsService.getAllApartments();
      }
      apartments = apartments.filter(apartment => apartment.status !== 'not_sold');

      // Get existing invoices for this year
      const existingInvoices = await this.getCommonExpenseInvoices(year);
      const existingApartmentIds = existingInvoices.map(inv => inv.apartmentId);

      // Filter apartments that don't have invoices for this year
      const newApartments = apartments.filter(apartment => !existingApartmentIds.includes(apartment.id));

      if (newApartments.length === 0) {
        return {
          success: true,
          message: `All apartments already have invoices for year ${year}`,
          newInvoicesCount: 0
        };
      }

      let newInvoicesCount = 0;
      const dueDate = `${year}-12-31`;

      for (const apartment of newApartments) {
        // Default to full year
        let monthsToCharge = 12;
        let invoiceDate = `${year}-01-01`;
        
        if (apartment.registrationDate) {
          const regDate = new Date(apartment.registrationDate);
          const regYear = regDate.getFullYear();
          const regMonth = regDate.getMonth(); // 0-11
          
          if (regYear > year) {
            // Apartment registered after this year, skip
            continue;
          } else if (regYear === year) {
            // Partial year: Charge from registration month to December
            // e.g. March (index 2) -> (12 - 2) = 10 months
            monthsToCharge = 12 - regMonth;
            invoiceDate = apartment.registrationDate.split('T')[0];
          }
        }

        // Calculate total amount based on area, price per m², and pro-rated months
        const fullYearAmount = (apartment.areaInM2 || 0) * pricePerM2;
        const totalAmount = (fullYearAmount / 12) * monthsToCharge;

        // Generate description
        let description = `Common Expenses ${year} - Block ${apartment.block} ${apartment.unitNumberOfficial}${apartment.unitNumberUnofficial ? ` (${apartment.unitNumberUnofficial})` : ''}`;
        
        if (monthsToCharge < 12) {
          description += ` (Pro-rated: ${monthsToCharge} months)`;
        }

        await db.query(`
          INSERT INTO invoices (
            apartment_id, category_id, amount, description, due_date, invoice_date,
            year, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          apartment.id,
          categoryId,
          totalAmount,
          description,
          dueDate,
          invoiceDate,
          year,
          null
        ]);

        newInvoicesCount++;
      }

      return {
        success: true,
        message: `Generated invoices for ${newInvoicesCount} new apartments for year ${year}`,
        newInvoicesCount
      };
    } catch (error) {
      console.error('Error generating common expense invoices:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate invoices',
        newInvoicesCount: 0
      };
    }
  }

  private async getInterestCategoryId(): Promise<number> {
    const [categoryRows] = await db.query(`
      SELECT id FROM transaction_categories WHERE LOWER(name) = 'interest' LIMIT 1
    `);
    if ((categoryRows as any[]).length === 0) {
      throw new Error('Interest category not found');
    }
    return (categoryRows as any[])[0].id;
  }

  public async getInterestInvoices(year: number): Promise<Invoice[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          i.id,
          i.apartment_id as apartmentId,
          i.category_id as categoryId,
          i.amount,
          i.description,
          DATE_FORMAT(i.due_date, '%Y-%m-%d') as dueDate,
          DATE_FORMAT(i.invoice_date, '%Y-%m-%d') as invoiceDate,
          i.year,
          i.notes,
          i.created_by as createdBy,
          DATE_FORMAT(i.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(i.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          COALESCE(SUM(it.amount), 0) as amountPaid,
          CASE 
            WHEN COALESCE(SUM(it.amount), 0) >= i.amount THEN 'paid'
            WHEN COALESCE(SUM(it.amount), 0) > 0 THEN 'partial'
            ELSE 'unpaid'
          END as status
        FROM invoices i
        LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
        LEFT JOIN transaction_categories tc ON i.category_id = tc.id
        WHERE LOWER(tc.name) = 'interest' AND i.year = ?
        GROUP BY i.id, i.apartment_id, i.category_id, i.amount, i.description, i.due_date, i.invoice_date, i.year, i.notes, i.created_by, i.created_at, i.updated_at
        ORDER BY i.invoice_date DESC, i.id DESC
      `, [year]);
      return (rows as any[]).map(row => this.mapRowToInvoice(row));
    } catch (error) {
      console.error('Error fetching interest invoices:', error);
      return [];
    }
  }

  private async getOutstandingByApartmentBeforeYear(year: number): Promise<Map<number, number>> {
    const [rows] = await db.query(`
      SELECT
        i.apartment_id as apartmentId,
        SUM(i.amount - COALESCE(paid.totalPaid, 0)) as outstandingBase
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) as totalPaid
        FROM invoice_transactions
        WHERE invoice_id IS NOT NULL
        GROUP BY invoice_id
      ) paid ON paid.invoice_id = i.id
      WHERE COALESCE(i.year, YEAR(i.invoice_date)) < ?
        AND (i.amount - COALESCE(paid.totalPaid, 0)) > 0.01
      GROUP BY i.apartment_id
    `, [year]);

    const map = new Map<number, number>();
    for (const row of rows as any[]) {
      map.set(parseInt(row.apartmentId, 10), parseFloat(row.outstandingBase) || 0);
    }
    return map;
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Preview interest invoices for a year (prior-year outstanding × yearly rate).
   */
  public async simulateInterestInvoices(
    year: number,
    onlyMissing = false
  ): Promise<{ year: number; rate: number; simulation: InterestSimulationBlock[] }> {
    const rate = await this.paymentsService.getYearlyInterestRate();
    const apartments = (await this.apartmentsService.getAllApartments())
      .filter(apartment => apartment.status !== 'not_sold');
    const existingInvoices = await this.getInterestInvoices(year);
    const existingApartmentIds = new Set(existingInvoices.map(inv => inv.apartmentId));
    const outstandingMap = await this.getOutstandingByApartmentBeforeYear(year);

    const simulationByBlock: { [key: string]: InterestSimulationBlock } = {};

    for (const apt of apartments) {
      if (apt.registrationDate) {
        const regYear = new Date(apt.registrationDate).getFullYear();
        if (regYear > year) {
          continue;
        }
      }

      const exists = existingApartmentIds.has(apt.id);
      if (onlyMissing && exists) {
        continue;
      }

      const outstandingBase = this.roundCurrency(outstandingMap.get(apt.id) || 0);
      const amount = this.roundCurrency(outstandingBase * rate / 100);

      if (amount < 0.01 && !exists) {
        continue;
      }
      if (onlyMissing && amount < 0.01) {
        continue;
      }

      const block = apt.block || 'Unassigned';
      if (!simulationByBlock[block]) {
        simulationByBlock[block] = {
          block,
          totalOutstanding: 0,
          totalAmount: 0,
          apartments: []
        };
      }

      simulationByBlock[block].totalOutstanding += outstandingBase;
      simulationByBlock[block].totalAmount += amount;
      simulationByBlock[block].apartments.push({
        id: apt.id,
        unitNumber: apt.unitNumberOfficial,
        unitNumberUnofficial: apt.unitNumberUnofficial,
        block: apt.block,
        ownerName: apt.ownerName || 'Unknown',
        outstandingBase,
        amount,
        exists
      });
    }

    const simulation = Object.values(simulationByBlock)
      .map(group => ({
        ...group,
        totalOutstanding: this.roundCurrency(group.totalOutstanding),
        totalAmount: this.roundCurrency(group.totalAmount)
      }))
      .sort((a, b) => a.block.localeCompare(b.block));

    return { year, rate, simulation };
  }

  /**
   * Create interest invoices for a year from prior-year unpaid balances.
   */
  public async createInterestInvoices(year: number): Promise<{ success: boolean; message: string; newInvoicesCount: number }> {
    try {
      const rate = await this.paymentsService.getYearlyInterestRate();
      const categoryId = await this.getInterestCategoryId();
      const apartments = (await this.apartmentsService.getAllApartments())
        .filter(apartment => apartment.status !== 'not_sold');
      const existingInvoices = await this.getInterestInvoices(year);
      const existingApartmentIds = new Set(existingInvoices.map(inv => inv.apartmentId));
      const outstandingMap = await this.getOutstandingByApartmentBeforeYear(year);

      let newInvoicesCount = 0;
      const dueDate = `${year}-12-31`;
      const invoiceDate = `${year}-01-01`;

      for (const apartment of apartments) {
        if (existingApartmentIds.has(apartment.id)) {
          continue;
        }

        if (apartment.registrationDate) {
          const regYear = new Date(apartment.registrationDate).getFullYear();
          if (regYear > year) {
            continue;
          }
        }

        const outstandingBase = this.roundCurrency(outstandingMap.get(apartment.id) || 0);
        const amount = this.roundCurrency(outstandingBase * rate / 100);
        if (amount < 0.01) {
          continue;
        }

        const description = `Interest ${year} - Block ${apartment.block} ${apartment.unitNumberOfficial}${apartment.unitNumberUnofficial ? ` (${apartment.unitNumberUnofficial})` : ''}`;

        await db.query(`
          INSERT INTO invoices (
            apartment_id, category_id, amount, description, due_date, invoice_date,
            year, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          apartment.id,
          categoryId,
          amount,
          description,
          dueDate,
          invoiceDate,
          year,
          null
        ]);

        newInvoicesCount++;
      }

      if (newInvoicesCount === 0) {
        return {
          success: true,
          message: `All apartments already have interest invoices for year ${year}, or none have prior-year unpaid balances`,
          newInvoicesCount: 0
        };
      }

      return {
        success: true,
        message: `Generated interest invoices for ${newInvoicesCount} apartments for year ${year}`,
        newInvoicesCount
      };
    } catch (error) {
      console.error('Error generating interest invoices:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate interest invoices',
        newInvoicesCount: 0
      };
    }
  }

  /**
   * Map database row to Invoice interface
   */
  private mapRowToInvoice(row: any): Invoice {
    return {
      id: parseInt(row.id),
      apartmentId: parseInt(row.apartmentId),
      categoryId: parseInt(row.categoryId),
      amount: parseFloat(row.amount),
      description: row.description || '',
      dueDate: row.dueDate || null,
      invoiceDate: row.invoiceDate,
      status: row.status as 'unpaid' | 'partial' | 'paid',
      amountPaid: parseFloat(row.amountPaid || 0),
      year: row.year ? parseInt(row.year) : null,
      notes: row.notes || null,
      createdBy: row.createdBy ? parseInt(row.createdBy) : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      categoryName: row.categoryName || undefined,
      categoryColor: row.categoryColor || undefined
    };
  }
}

