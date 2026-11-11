import { db } from '../../src/config/database';

export interface InvoiceTransaction {
  id: number;
  invoiceId: number | null;
  transactionId: number | null;
  apartmentId: number;
  amount: number;
  createdAt: string;
}

export interface InvoiceAllocation {
  invoiceId: number;
  amount: number;
}

export class InvoiceTransactionsService {
  private static instance: InvoiceTransactionsService;

  private constructor() {}

  /** mysql2 may return camelCase, snake_case, or BigInt — normalize for Map keys. */
  private static coerceTransactionId(row: any): number | null {
    const raw = row?.transactionId ?? row?.transaction_id ?? row?.transactionid;
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'bigint') return Number(raw);
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) ? n : null;
  }

  public static getInstance(): InvoiceTransactionsService {
    if (!InvoiceTransactionsService.instance) {
      InvoiceTransactionsService.instance = new InvoiceTransactionsService();
    }
    return InvoiceTransactionsService.instance;
  }

  /**
   * Create invoice transaction allocation
   */
  public async createAllocation(
    invoiceId: number,
    transactionId: number | null,
    apartmentId: number,
    amount: number
  ): Promise<InvoiceTransaction> {
    try {
      const [result] = await db.query(`
        INSERT INTO invoice_transactions (invoice_id, transaction_id, apartment_id, amount)
        VALUES (?, ?, ?, ?)
      `, [invoiceId, transactionId, apartmentId, amount]);

      const insertId = (result as any).insertId;
      return await this.getById(insertId);
    } catch (error) {
      console.error('Error creating invoice transaction allocation:', error);
      throw error;
    }
  }

  /**
   * Create credit record (unallocated payment for apartment)
   */
  public async createCredit(
    apartmentId: number,
    amount: number,
    transactionId?: number | null
  ): Promise<InvoiceTransaction> {
    try {
      const [result] = await db.query(`
        INSERT INTO invoice_transactions (invoice_id, transaction_id, apartment_id, amount)
        VALUES (NULL, ?, ?, ?)
      `, [transactionId || null, apartmentId, amount]);

      const insertId = (result as any).insertId;

      // Positive unallocated credits are wallet top-ups — ensure members can see them
      if (Number(amount) > 0) {
        try {
          const { usersService } = require('./usersService');
          await usersService.enableWalletForApartmentMembers(apartmentId);
        } catch (enableError) {
          console.error('Failed to auto-enable wallet for apartment members:', enableError);
        }
      }

      return await this.getById(insertId);
    } catch (error) {
      console.error('Error creating credit record:', error);
      throw error;
    }
  }

  /**
   * Allocate payment to multiple invoices
   */
  public async allocateToMultipleInvoices(
    transactionId: number,
    apartmentId: number,
    allocations: InvoiceAllocation[]
  ): Promise<InvoiceTransaction[]> {
    try {
      const results: InvoiceTransaction[] = [];

      for (const allocation of allocations) {
        const result = await this.createAllocation(
          allocation.invoiceId,
          transactionId,
          apartmentId,
          allocation.amount
        );
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error('Error allocating to multiple invoices:', error);
      throw error;
    }
  }

  /**
   * Get invoice transaction by ID
   */
  public async getById(id: number): Promise<InvoiceTransaction> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id,
          invoice_id as invoiceId,
          transaction_id as transactionId,
          apartment_id as apartmentId,
          amount,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt
        FROM invoice_transactions
        WHERE id = ?
      `, [id]);

      const results = rows as any[];
      if (results.length === 0) {
        throw new Error(`Invoice transaction ${id} not found`);
      }

      return this.mapRowToInvoiceTransaction(results[0]);
    } catch (error) {
      console.error('Error fetching invoice transaction by ID:', error);
      throw error;
    }
  }

  /**
   * Get all allocations for an invoice
   */
  public async getByInvoiceId(invoiceId: number): Promise<InvoiceTransaction[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id,
          invoice_id as invoiceId,
          transaction_id as transactionId,
          apartment_id as apartmentId,
          amount,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt
        FROM invoice_transactions
        WHERE invoice_id = ?
        ORDER BY created_at ASC
      `, [invoiceId]);

      return (rows as any[]).map(row => this.mapRowToInvoiceTransaction(row));
    } catch (error) {
      console.error('Error fetching invoice transactions by invoice ID:', error);
      return [];
    }
  }

  /**
   * Get all allocations for a transaction
   */
  public async getByTransactionId(transactionId: number): Promise<InvoiceTransaction[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id,
          invoice_id as invoiceId,
          transaction_id as transactionId,
          apartment_id as apartmentId,
          amount,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt
        FROM invoice_transactions
        WHERE transaction_id = ?
        ORDER BY created_at ASC
      `, [transactionId]);

      return (rows as any[]).map(row => this.mapRowToInvoiceTransaction(row));
    } catch (error) {
      console.error('Error fetching invoice transactions by transaction ID:', error);
      return [];
    }
  }

  /**
   * Get all credits (unallocated payments) for an apartment
   */
  public async getCreditsByApartmentId(apartmentId: number): Promise<InvoiceTransaction[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id,
          invoice_id as invoiceId,
          transaction_id as transactionId,
          apartment_id as apartmentId,
          amount,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt
        FROM invoice_transactions
        WHERE apartment_id = ? AND invoice_id IS NULL
        ORDER BY created_at ASC
      `, [apartmentId]);

      return (rows as any[]).map(row => this.mapRowToInvoiceTransaction(row));
    } catch (error) {
      console.error('Error fetching credits by apartment ID:', error);
      return [];
    }
  }

  /**
   * Sum of all invoice_transactions rows tied to this bank/income transaction
   * (allocations to invoices plus any unallocated credit line with this transaction_id).
   */
  public async getTotalLinkedAmountForTransaction(transactionId: number): Promise<number> {
    try {
      const [rows] = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM invoice_transactions WHERE transaction_id = ?`,
        [transactionId]
      );
      const results = rows as any[];
      return parseFloat(results[0]?.total ?? results[0]?.TOTAL ?? 0);
    } catch (error) {
      console.error('Error summing invoice_transactions by transaction:', error);
      return 0;
    }
  }

  /**
   * Batch: linked totals for many transaction ids (for credits report).
   */
  public async getTotalLinkedAmountsByTransactionIds(transactionIds: number[]): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    if (!transactionIds.length) {
      return result;
    }
    try {
      const placeholders = transactionIds.map(() => '?').join(',');
      const [rows] = await db.query(
        `SELECT transaction_id as transactionId, COALESCE(SUM(amount), 0) as total
         FROM invoice_transactions
         WHERE transaction_id IN (${placeholders})
         GROUP BY transaction_id`,
        transactionIds
      );
      for (const row of rows as any[]) {
        const tid = InvoiceTransactionsService.coerceTransactionId(row);
        if (tid === null) continue;
        const total = parseFloat(String(row.total ?? row.TOTAL ?? 0));
        result.set(tid, total);
      }
      for (const id of transactionIds) {
        if (!result.has(id)) {
          result.set(id, 0);
        }
      }
      return result;
    } catch (error) {
      console.error('Error batching linked amounts by transaction:', error);
      for (const id of transactionIds) {
        result.set(id, 0);
      }
      return result;
    }
  }

  /**
   * Get total amount paid for an invoice
   */
  public async getTotalPaidForInvoice(invoiceId: number): Promise<number> {
    try {
      const [rows] = await db.query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM invoice_transactions
        WHERE invoice_id = ?
      `, [invoiceId]);

      const results = rows as any[];
      return parseFloat(results[0]?.total || 0);
    } catch (error) {
      console.error('Error calculating total paid for invoice:', error);
      return 0;
    }
  }

  /**
   * Split invoice payments into wallet (prepaid credit) vs direct cash transactions.
   */
  public async getInvoicePaymentBreakdown(invoiceId: number): Promise<{
    walletAmount: number;
    cashAmount: number;
    totalPaid: number;
    cashTransactionId: number | null;
    suggestedDate: string;
  }> {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const allocations = await this.getByInvoiceId(invoiceId);
    const TransactionsService = require('./transactionsService').TransactionsService;
    const transactionsService = TransactionsService.getInstance();

    let walletAmount = 0;
    let cashAmount = 0;
    let cashTransactionId: number | null = null;
    let suggestedDate = new Date().toISOString().split('T')[0];

    for (const alloc of allocations) {
      if (!alloc.transactionId) {
        walletAmount += alloc.amount;
        continue;
      }
      const txn = await transactionsService.getTransactionById(alloc.transactionId);
      if (txn && txn.invoiceId === invoiceId) {
        cashAmount += alloc.amount;
        cashTransactionId = txn.id;
        if (txn.date && txn.date > suggestedDate) {
          suggestedDate = txn.date;
        }
      } else {
        walletAmount += alloc.amount;
      }
    }

    return {
      walletAmount: round2(walletAmount),
      cashAmount: round2(cashAmount),
      totalPaid: round2(walletAmount + cashAmount),
      cashTransactionId,
      suggestedDate
    };
  }

  /**
   * Wallet allocations applied to invoices for an apartment (no dedicated bank txn for the pay event).
   * Excludes cash allocations where the linked transaction is the invoice payment itself.
   */
  public async getWalletPaymentsByApartmentId(apartmentId: number): Promise<Array<{
    id: number;
    invoiceId: number;
    apartmentId: number;
    amount: number;
    date: string;
    invoiceDescription: string | null;
  }>> {
    try {
      const [rows] = await db.query(`
        SELECT
          it.id,
          it.invoice_id as invoiceId,
          it.transaction_id as transactionId,
          it.apartment_id as apartmentId,
          it.amount,
          DATE_FORMAT(it.created_at, '%Y-%m-%d') as date,
          i.description as invoiceDescription,
          t.invoice_id as linkedTxnInvoiceId
        FROM invoice_transactions it
        INNER JOIN invoices i ON i.id = it.invoice_id
        LEFT JOIN transactions t ON t.id = it.transaction_id
        WHERE it.apartment_id = ?
          AND it.invoice_id IS NOT NULL
          AND it.amount > 0
        ORDER BY it.created_at DESC
      `, [apartmentId]);

      return (rows as any[])
        .filter((row) => {
          const invoiceId = parseInt(String(row.invoiceId), 10);
          const transactionId = row.transactionId != null ? parseInt(String(row.transactionId), 10) : null;
          if (!transactionId || Number.isNaN(transactionId)) {
            return true;
          }
          const linkedInvoiceId =
            row.linkedTxnInvoiceId != null ? parseInt(String(row.linkedTxnInvoiceId), 10) : null;
          // Cash payment: allocation points at the income txn for this same invoice
          if (linkedInvoiceId === invoiceId) {
            return false;
          }
          return true;
        })
        .map((row) => ({
          id: parseInt(String(row.id), 10),
          invoiceId: parseInt(String(row.invoiceId), 10),
          apartmentId: parseInt(String(row.apartmentId), 10),
          amount: parseFloat(String(row.amount)) || 0,
          date: String(row.date || ''),
          invoiceDescription: row.invoiceDescription ? String(row.invoiceDescription) : null
        }));
    } catch (error) {
      console.error('Error fetching wallet payments by apartment:', error);
      return [];
    }
  }

  /**
   * Get total credit amount for an apartment
   */
  public async getTotalCreditForApartment(apartmentId: number): Promise<number> {
    try {
      const [rows] = await db.query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM invoice_transactions
        WHERE apartment_id = ? AND invoice_id IS NULL
      `, [apartmentId]);

      const results = rows as any[];
      return parseFloat(results[0]?.total || 0);
    } catch (error) {
      console.error('Error calculating total credit for apartment:', error);
      return 0;
    }
  }

  /**
   * Get ALL unallocated credits across all apartments (for the credits report)
   */
  public async getAllCredits(filters?: { block?: string }): Promise<InvoiceTransaction[]> {
    try {
      let query = `
        SELECT 
          it.id,
          it.invoice_id as invoiceId,
          it.transaction_id as transactionId,
          it.apartment_id as apartmentId,
          it.amount,
          DATE_FORMAT(it.created_at, '%Y-%m-%dT%TZ') as createdAt
        FROM invoice_transactions it
        LEFT JOIN apartments a ON it.apartment_id = a.id
        WHERE it.invoice_id IS NULL
      `;
      const params: any[] = [];

      if (filters?.block) {
        query += ` AND a.floor = ?`;
        params.push(filters.block);
      }

      query += ` ORDER BY it.apartment_id, it.created_at ASC`;

      const [rows] = await db.query(query, params);
      return (rows as any[]).map(row => this.mapRowToInvoiceTransaction(row));
    } catch (error) {
      console.error('Error fetching all credits:', error);
      return [];
    }
  }

  /**
   * Apply wallet balance toward an invoice without mutating original top-up rows.
   * Records a negative wallet ledger line (visible on the wallet statement) plus an
   * invoice allocation. Top-ups stay at their original amounts.
   */
  public async applyWalletBalanceToInvoice(
    apartmentId: number,
    invoiceId: number,
    requestedAmount: number,
    options?: { creditRowId?: number; date?: string; createdBy?: number | null }
  ): Promise<{ allocated: number; remainingWallet: number }> {
    const InvoicesService = require('./invoicesService').InvoicesService;
    const invoicesService = InvoicesService.getInstance();
    const TransactionsService = require('./transactionsService').TransactionsService;
    const transactionsService = TransactionsService.getInstance();
    const { WALLET_ADJUSTMENT_CATEGORY_NAME } = require('./transactionReportFilters');

    const round2 = (n: number) => Math.round(n * 100) / 100;

    const invoice = await invoicesService.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (invoice.apartmentId !== apartmentId) {
      throw new Error('Invoice does not belong to this apartment');
    }

    if (options?.creditRowId != null) {
      const credit = await this.getById(options.creditRowId);
      if (credit.invoiceId !== null) {
        throw new Error('This credit line is already linked to an invoice');
      }
      if (credit.apartmentId !== apartmentId) {
        throw new Error('Credit does not belong to this apartment');
      }
      if (credit.amount <= 0) {
        throw new Error('Only positive wallet top-ups can be applied to invoices');
      }
    }

    const paid = await this.getTotalPaidForInvoice(invoiceId);
    const outstanding = round2(Math.max(0, invoice.amount - paid));
    if (outstanding <= 0) {
      throw new Error('This invoice is already fully paid');
    }

    const walletBalance = round2(await this.getTotalCreditForApartment(apartmentId));
    if (walletBalance <= 0.009) {
      throw new Error('No wallet balance available');
    }

    let toAllocate = round2(Math.min(walletBalance, outstanding, requestedAmount));
    if (toAllocate <= 0) {
      throw new Error('Nothing to allocate');
    }

    const accountId = await this.resolveWalletMemoAccountId(apartmentId, options?.creditRowId);
    const categoryId = await this.getWalletAdjustmentCategoryId(WALLET_ADJUSTMENT_CATEGORY_NAME);
    const paymentDate =
      (options?.date && String(options.date).trim()) ||
      new Date().toISOString().split('T')[0]!;
    const invoiceLabel = invoice.description || `Invoice #${invoiceId}`;

    const memoTx = await transactionsService.createTransaction({
      amount: 0,
      type: 'expense',
      categoryId,
      description: `Wallet payment — ${invoiceLabel}`,
      date: paymentDate,
      accountId,
      apartmentId,
      createdBy: options?.createdBy ?? null,
      receiptGenerated: false,
      receiptImage: null
    });

    await this.createCredit(apartmentId, -toAllocate, memoTx.id);
    await this.createAllocation(invoiceId, memoTx.id, apartmentId, toAllocate);

    return {
      allocated: toAllocate,
      remainingWallet: round2(await this.getTotalCreditForApartment(apartmentId))
    };
  }

  private async getWalletAdjustmentCategoryId(categoryName: string): Promise<number> {
    const TransactionCategoriesService = require('./transactionCategoriesService').TransactionCategoriesService;
    const categoriesService = TransactionCategoriesService.getInstance();
    const categories = await categoriesService.getAllCategories();
    const category = categories.find(
      (c: { name: string }) => c.name.toLowerCase() === categoryName.toLowerCase()
    );
    if (!category) {
      throw new Error(
        `"${categoryName}" category not found. Run data-migration/2026-07-25-add-wallet-adjustment-category.ts`
      );
    }
    return category.id;
  }

  private async resolveWalletMemoAccountId(apartmentId: number, creditRowId?: number): Promise<number> {
    if (creditRowId != null) {
      const credit = await this.getById(creditRowId);
      if (credit.transactionId) {
        const TransactionsService = require('./transactionsService').TransactionsService;
        const tx = await TransactionsService.getInstance().getTransactionById(credit.transactionId);
        if (tx?.accountId) {
          return tx.accountId;
        }
      }
    }

    const [rows] = await db.query(
      `
      SELECT t.account_id as accountId
      FROM invoice_transactions it
      INNER JOIN transactions t ON t.id = it.transaction_id
      WHERE it.apartment_id = ?
        AND it.invoice_id IS NULL
        AND it.amount > 0
        AND t.account_id IS NOT NULL
      ORDER BY it.id DESC
      LIMIT 1
    `,
      [apartmentId]
    );
    const fromWallet = (rows as any[])[0]?.accountId;
    if (fromWallet) {
      return parseInt(String(fromWallet), 10);
    }

    const AccountsService = require('./accountsService').AccountsService;
    const accounts = await AccountsService.getInstance().getAllAccounts();
    const active = accounts.find((a: { isActive?: boolean }) => a.isActive !== false);
    if (!active?.id) {
      throw new Error('No account available for wallet payment memo');
    }
    return active.id;
  }

  /**
   * Apply an unallocated credit row toward an invoice for the same apartment.
   * Uses ledger-style wallet outflow (does not rewrite the original top-up amount).
   */
  public async allocateUnallocatedCreditToInvoice(
    creditRowId: number,
    invoiceId: number,
    requestedAmount?: number
  ): Promise<{ allocated: number; remainingCredit: number }> {
    const credit = await this.getById(creditRowId);
    if (credit.invoiceId !== null) {
      throw new Error('This credit line is already linked to an invoice');
    }
    if (credit.amount <= 0) {
      throw new Error('Only positive wallet top-ups can be applied to invoices');
    }

    const walletBalance = await this.getTotalCreditForApartment(credit.apartmentId);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const amount =
      requestedAmount !== undefined && !Number.isNaN(requestedAmount) && requestedAmount > 0
        ? requestedAmount
        : Math.min(credit.amount, walletBalance);

    const result = await this.applyWalletBalanceToInvoice(
      credit.apartmentId,
      invoiceId,
      amount,
      { creditRowId }
    );

    return {
      allocated: result.allocated,
      remainingCredit: round2(result.remainingWallet)
    };
  }

  /**
   * Apply a Credit - Owner income transaction toward an invoice (creates invoice_transactions allocation).
   * Remaining capacity = transaction.amount minus all invoice_transactions already using this transaction_id.
   */
  public async allocateCreditOwnerTransactionToInvoice(
    transactionId: number,
    invoiceId: number,
    requestedAmount?: number
  ): Promise<{ allocated: number; remainingAllocatable: number }> {
    const InvoicesService = require('./invoicesService').InvoicesService;
    const invSvc = InvoicesService.getInstance();

    const round2 = (n: number) => Math.round(n * 100) / 100;

    const invoice = await invSvc.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [lockRows] = await conn.query(
        `SELECT t.id, t.amount, t.apartment_id as apartmentId, t.category_id as categoryId,
                tc.name as categoryName
         FROM transactions t
         INNER JOIN transaction_categories tc ON t.category_id = tc.id
         WHERE t.id = ?
         FOR UPDATE`,
        [transactionId]
      );
      const locked = (lockRows as any[])[0];
      if (!locked) {
        throw new Error('Transaction not found');
      }
      if (locked.categoryName !== 'Credit - Owner') {
        throw new Error('Only Credit - Owner transactions can be allocated here');
      }
      const apartmentId = locked.apartmentId != null ? parseInt(String(locked.apartmentId), 10) : null;
      if (apartmentId == null) {
        throw new Error('Assign an apartment to this credit before applying to an invoice');
      }
      if (invoice.apartmentId !== apartmentId) {
        throw new Error('Invoice does not belong to this apartment');
      }

      const txnAmount = round2(parseFloat(String(locked.amount)));

      const [sumRows] = await conn.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM invoice_transactions WHERE transaction_id = ?`,
        [transactionId]
      );
      const linked = round2(parseFloat(String((sumRows as any[])[0]?.total ?? 0)));

      const available = round2(Math.max(0, txnAmount - linked));
      if (available <= 0) {
        throw new Error('This transaction has no remaining amount to apply');
      }

      const paid = await this.getTotalPaidForInvoice(invoiceId);
      const outstanding = round2(Math.max(0, invoice.amount - paid));
      if (outstanding <= 0) {
        throw new Error('This invoice is already fully paid');
      }

      let toAllocate = Math.min(available, outstanding);
      if (requestedAmount !== undefined && !Number.isNaN(requestedAmount) && requestedAmount > 0) {
        toAllocate = round2(Math.min(available, outstanding, requestedAmount));
      }
      if (toAllocate <= 0) {
        throw new Error('Nothing to allocate');
      }

      await conn.query(
        `INSERT INTO invoice_transactions (invoice_id, transaction_id, apartment_id, amount)
         VALUES (?, ?, ?, ?)`,
        [invoiceId, transactionId, apartmentId, toAllocate]
      );

      await conn.commit();

      const newLinked = linked + toAllocate;
      const remainingAllocatable = round2(Math.max(0, txnAmount - newLinked));

      return { allocated: toAllocate, remainingAllocatable };
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Delete allocation
   */
  public async deleteAllocation(id: number): Promise<boolean> {
    try {
      const [result] = await db.query(`
        DELETE FROM invoice_transactions WHERE id = ?
      `, [id]);

      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error deleting invoice transaction allocation:', error);
      return false;
    }
  }

  /**
   * Delete all allocations for an invoice
   */
  public async deleteByInvoiceId(invoiceId: number): Promise<boolean> {
    try {
      await db.query(`
        DELETE FROM invoice_transactions WHERE invoice_id = ?
      `, [invoiceId]);

      return true;
    } catch (error) {
      console.error('Error deleting invoice transaction allocations:', error);
      return false;
    }
  }

  /**
   * Delete all allocations for a transaction
   */
  public async deleteByTransactionId(transactionId: number): Promise<boolean> {
    try {
      await db.query(`
        DELETE FROM invoice_transactions WHERE transaction_id = ?
      `, [transactionId]);

      return true;
    } catch (error) {
      console.error('Error deleting invoice transaction allocations:', error);
      return false;
    }
  }

  /**
   * Map database row to InvoiceTransaction interface
   */
  private mapRowToInvoiceTransaction(row: any): InvoiceTransaction {
    return {
      id: parseInt(row.id),
      invoiceId: row.invoiceId ? parseInt(row.invoiceId) : null,
      transactionId: row.transactionId ? parseInt(row.transactionId) : null,
      apartmentId: parseInt(row.apartmentId),
      amount: parseFloat(row.amount),
      createdAt: row.createdAt
    };
  }
}



