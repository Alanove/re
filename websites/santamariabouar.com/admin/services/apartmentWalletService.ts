import { db } from '../../src/config/database';

import {

  InvoiceTransactionsService,

  InvoiceTransaction

} from './invoiceTransactionsService';

import { WALLET_ADJUSTMENT_CATEGORY_NAME } from './transactionReportFilters';



export interface WalletEntry extends InvoiceTransaction {

  source: 'manual' | 'payment';

}



export interface WalletStatementEntry extends WalletEntry {

  date: string;

  description: string;

  accountName: string | null;

  runningBalance: number;

}



export interface ApartmentWalletSummary {

  apartmentId: number;

  balance: number;

  entryCount: number;

}



export interface AddWalletEntryParams {

  apartmentId: number;

  amount: number;

  accountId: number;

  date: string;

  description?: string;

  createdBy: number | null;

}



export interface SubtractWalletEntryParams extends AddWalletEntryParams {

  description: string;

}



export class ApartmentWalletService {

  private static instance: ApartmentWalletService;

  private invoiceTransactionsService = InvoiceTransactionsService.getInstance();



  private constructor() {}



  public static getInstance(): ApartmentWalletService {

    if (!ApartmentWalletService.instance) {

      ApartmentWalletService.instance = new ApartmentWalletService();

    }

    return ApartmentWalletService.instance;

  }



  private round2(n: number): number {

    return Math.round(n * 100) / 100;

  }



  /**
   * Category used for every wallet top-up and deduction so these bookkeeping
   * entries can be excluded from the main transactions report.
   */
  private async getWalletAdjustmentCategoryId(): Promise<number> {
    const TransactionCategoriesService = require('./transactionCategoriesService').TransactionCategoriesService;
    const categoriesService = TransactionCategoriesService.getInstance();
    const categories = await categoriesService.getAllCategories();
    const category = categories.find(
      (c: { name: string }) => c.name.toLowerCase() === WALLET_ADJUSTMENT_CATEGORY_NAME.toLowerCase()
    );

    if (!category) {
      throw new Error(
        `"${WALLET_ADJUSTMENT_CATEGORY_NAME}" category not found. Run data-migration/2026-07-25-add-wallet-adjustment-category.ts`
      );
    }

    return category.id;
  }



  /**

   * Wallet balance = sum of unallocated credits (invoice_id IS NULL) per apartment.

   */

  public async getBalancesByApartmentId(): Promise<Map<number, number>> {

    const result = new Map<number, number>();

    try {

      const [rows] = await db.query(`

        SELECT apartment_id as apartmentId, COALESCE(SUM(amount), 0) as balance

        FROM invoice_transactions

        WHERE invoice_id IS NULL

        GROUP BY apartment_id

      `);



      for (const row of rows as any[]) {

        result.set(parseInt(row.apartmentId, 10), parseFloat(row.balance || 0));

      }

    } catch (error) {

      console.error('Error fetching wallet balances:', error);

    }

    return result;

  }



  public async getTotalBalance(apartmentId: number): Promise<number> {

    return this.invoiceTransactionsService.getTotalCreditForApartment(apartmentId);

  }



  /**
   * Wallet entries enriched with their linked transaction (description, account, date)
   * and a running balance, used by the detail page and the per-wallet report.
   */
  public async getWalletStatement(apartmentId: number): Promise<{
    entries: WalletStatementEntry[];
    totalAdded: number;
    totalSubtracted: number;
    balance: number;
  }> {
    let rows: any[] = [];
    try {
      const [result] = await db.query(`
        SELECT
          it.id,
          it.invoice_id as invoiceId,
          it.transaction_id as transactionId,
          it.apartment_id as apartmentId,
          it.amount,
          DATE_FORMAT(it.created_at, '%Y-%m-%dT%TZ') as createdAt,
          t.description as transactionDescription,
          DATE_FORMAT(t.date, '%Y-%m-%d') as transactionDate,
          a.name as accountName
        FROM invoice_transactions it
        LEFT JOIN transactions t ON t.id = it.transaction_id
        LEFT JOIN accounts a ON a.id = t.account_id
        WHERE it.apartment_id = ? AND it.invoice_id IS NULL
        ORDER BY COALESCE(t.date, DATE(it.created_at)) ASC, it.id ASC
      `, [apartmentId]);
      rows = result as any[];
    } catch (error) {
      console.error('Error fetching wallet statement:', error);
    }

    let running = 0;
    let totalAdded = 0;
    let totalSubtracted = 0;

    const entries: WalletStatementEntry[] = rows.map(row => {
      const amount = parseFloat(row.amount || 0);
      running = this.round2(running + amount);
      if (amount < 0) {
        totalSubtracted = this.round2(totalSubtracted + Math.abs(amount));
      } else {
        totalAdded = this.round2(totalAdded + amount);
      }

      const transactionId = row.transactionId ? parseInt(row.transactionId, 10) : null;
      const description = row.transactionDescription || '';
      const isInvoicePayment = amount < 0 && /^wallet payment\b/i.test(description);

      return {
        id: parseInt(row.id, 10),
        invoiceId: null,
        transactionId,
        apartmentId: parseInt(row.apartmentId, 10),
        amount,
        createdAt: row.createdAt,
        source: isInvoicePayment ? 'payment' : (transactionId ? 'payment' : 'manual'),
        date: row.transactionDate || String(row.createdAt || '').split('T')[0],
        description,
        accountName: row.accountName || null,
        runningBalance: running
      };
    });

    return {
      entries,
      totalAdded,
      totalSubtracted,
      balance: running
    };
  }



  public async getGlobalSummary(): Promise<{

    totalBalance: number;

    apartmentsWithBalance: number;

    entryCount: number;

  }> {

    try {

      const [rows] = await db.query(`

        SELECT

          COALESCE(SUM(amount), 0) as totalBalance,

          COUNT(DISTINCT apartment_id) as apartmentsWithBalance,

          COUNT(*) as entryCount

        FROM invoice_transactions

        WHERE invoice_id IS NULL

      `);

      const row = (rows as any[])[0] || {};

      return {

        totalBalance: parseFloat(row.totalBalance || 0),

        apartmentsWithBalance: parseInt(row.apartmentsWithBalance || 0, 10),

        entryCount: parseInt(row.entryCount || 0, 10)

      };

    } catch (error) {

      console.error('Error fetching wallet summary:', error);

      return { totalBalance: 0, apartmentsWithBalance: 0, entryCount: 0 };

    }

  }



  /**
   * Apply apartment wallet balance toward an invoice.
   * Leaves original top-up amounts intact and records a wallet outflow line.
   */
  public async allocateWalletToInvoice(
    apartmentId: number,
    invoiceId: number,
    requestedAmount: number
  ): Promise<{ allocated: number; remainingWallet: number }> {
    const toApply = this.round2(requestedAmount);
    if (toApply <= 0) {
      return {
        allocated: 0,
        remainingWallet: await this.getTotalBalance(apartmentId)
      };
    }

    const walletBalance = await this.getTotalBalance(apartmentId);
    if (toApply > walletBalance + 0.009) {
      throw new Error(
        `Insufficient wallet balance. Available: $${walletBalance.toFixed(2)}`
      );
    }

    return this.invoiceTransactionsService.applyWalletBalanceToInvoice(
      apartmentId,
      invoiceId,
      toApply
    );
  }



  /**

   * Add wallet balance by recording an income transaction and linked credit line.

   * Same flow as "Wallet (prepaid balance)" on the record-payment screen.

   */

  public async addWalletEntryWithTransaction(params: AddWalletEntryParams): Promise<{ transactionId: number }> {

    const rounded = this.round2(params.amount);

    if (rounded <= 0) {

      throw new Error('Amount must be greater than zero');

    }

    if (!params.accountId) {

      throw new Error('Account is required');

    }

    if (!params.date) {

      throw new Error('Date is required');

    }



    const categoryId = await this.getWalletAdjustmentCategoryId();



    const ApartmentsService = require('./apartmentsService').ApartmentsService;

    const apartment = await ApartmentsService.getInstance().getApartmentById(params.apartmentId);

    const defaultDescription = apartment

      ? `Wallet top-up – Block ${apartment.block} ${apartment.unitNumberOfficial}`

      : `Wallet top-up – Apartment ${params.apartmentId}`;



    const TransactionsService = require('./transactionsService').TransactionsService;

    const transactionsService = TransactionsService.getInstance();



    const transaction = await transactionsService.createCommonExpensePayment({

      amount: rounded,

      description: (params.description || '').trim() || defaultDescription,

      date: params.date,

      apartmentId: params.apartmentId,

      paymentYears: [0],

      yearAmounts: { '0': rounded },

      accountId: params.accountId,

      categoryId,

      createdBy: params.createdBy ?? 0,

      receiptImage: null

    });



    return { transactionId: transaction.id };

  }



  /**
   * Subtract wallet balance by recording an expense transaction and a negative credit line.
   * The deduction leaves the selected account and reduces the apartment wallet.
   */
  public async subtractWalletEntryWithTransaction(
    params: SubtractWalletEntryParams
  ): Promise<{ transactionId: number }> {
    const rounded = this.round2(params.amount);
    if (rounded <= 0) {
      throw new Error('Amount must be greater than zero');
    }
    if (!params.accountId) {
      throw new Error('Account is required');
    }
    if (!params.date) {
      throw new Error('Date is required');
    }

    const description = (params.description || '').trim();
    if (!description) {
      throw new Error('Description is required');
    }

    const balance = await this.getTotalBalance(params.apartmentId);
    if (rounded > balance + 0.009) {
      throw new Error(`Insufficient wallet balance. Available: $${balance.toFixed(2)}`);
    }

    const categoryId = await this.getWalletAdjustmentCategoryId();

    const TransactionsService = require('./transactionsService').TransactionsService;
    const transactionsService = TransactionsService.getInstance();

    const transaction = await transactionsService.createTransaction({
      amount: rounded,
      type: 'expense',
      categoryId,
      description,
      date: params.date,
      accountId: params.accountId,
      apartmentId: params.apartmentId,
      createdBy: params.createdBy ?? 0,
      receiptGenerated: false,
      receiptImage: null
    });

    await this.invoiceTransactionsService.createCredit(
      params.apartmentId,
      -rounded,
      transaction.id
    );

    return { transactionId: transaction.id };
  }



  /**

   * Update wallet entry amount (and linked transaction when present).

   * Deductions are stored as negative credit lines, so the sign is preserved.

   */

  public async updateWalletEntry(
    id: number,
    amount: number,
    description?: string
  ): Promise<InvoiceTransaction> {

    const rounded = this.round2(Math.abs(amount));

    if (rounded <= 0) {

      throw new Error('Amount must be greater than zero');

    }



    const entry = await this.invoiceTransactionsService.getById(id);

    if (entry.invoiceId !== null) {

      throw new Error('This entry is allocated to an invoice and cannot be edited');

    }



    const isDeduction = entry.amount < 0;

    const signedAmount = isDeduction ? -rounded : rounded;

    const trimmedDescription = description !== undefined ? String(description).trim() : undefined;



    if (isDeduction) {

      const otherBalance = this.round2(await this.getTotalBalance(entry.apartmentId) - entry.amount);

      if (rounded > otherBalance + 0.009) {

        throw new Error(`Deduction exceeds available balance. Available: $${otherBalance.toFixed(2)}`);

      }

      if (trimmedDescription !== undefined && !trimmedDescription) {

        throw new Error('Description is required for deductions');

      }

    }



    if (entry.transactionId !== null) {

      const TransactionsService = require('./transactionsService').TransactionsService;

      const transactionsService = TransactionsService.getInstance();

      const updatePayload: { amount: number; description?: string } = { amount: rounded };

      if (trimmedDescription !== undefined) {

        updatePayload.description = trimmedDescription;

      }

      const updated = await transactionsService.updateTransaction(entry.transactionId, updatePayload);

      if (!updated) {

        throw new Error('Failed to update linked transaction');

      }

      await db.query(

        `UPDATE invoice_transactions SET amount = ? WHERE id = ? AND invoice_id IS NULL`,

        [signedAmount, id]

      );

    } else {

      if (trimmedDescription !== undefined && trimmedDescription !== '') {

        throw new Error('This entry has no linked transaction, so description cannot be edited');

      }

      await db.query(

        `UPDATE invoice_transactions SET amount = ? WHERE id = ? AND invoice_id IS NULL AND transaction_id IS NULL`,

        [signedAmount, id]

      );

    }



    return this.invoiceTransactionsService.getById(id);

  }



  /**

   * Remove wallet entry (and linked transaction when present).

   */

  public async deleteWalletEntry(id: number): Promise<boolean> {

    const entry = await this.invoiceTransactionsService.getById(id);

    if (entry.invoiceId !== null) {

      throw new Error('This entry is allocated to an invoice and cannot be deleted');

    }



    if (entry.transactionId !== null) {

      const TransactionsService = require('./transactionsService').TransactionsService;

      return TransactionsService.getInstance().deleteTransaction(entry.transactionId);

    }



    const [result] = await db.query(

      `DELETE FROM invoice_transactions WHERE id = ? AND invoice_id IS NULL AND transaction_id IS NULL`,

      [id]

    );

    return (result as any).affectedRows > 0;

  }

}


