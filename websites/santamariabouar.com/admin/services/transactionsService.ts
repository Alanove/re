import { db } from '../../src/config/database';

export interface Transaction {
    id: number;
    amount: number;
    type: 'income' | 'expense';
    categoryId: number;
    description: string;
    date: string;
    accountId: number;
    apartmentId?: number | null;
    invoiceId?: number | null;
    relatedTransactionId?: number | null;
    receiptGenerated?: boolean;
    receiptImage?: string | null;
    createdAt: string;
    createdBy: number | null;
}

export interface TransactionListFilters {
    fromDate?: string;
    toDate?: string;
    keyword?: string;
    apartmentId?: number;
}

export interface TransferRequest {
    fromAccountId: number;
    toAccountId: number;
    amount: number;
    categoryId: number;
    description: string;
    date: string;
    createdBy: number;
}

export interface CommonExpenseRequest {
    amount: number;
    description: string;
    date: string;
    apartmentIds: number[];
    accountId: number;
    categoryId: number;
    createdBy: number;
}

export interface CommonExpensePaymentRequest {
    amount: number;
    description: string;
    date: string;
    apartmentId: number;
    paymentYears: number[];
    yearAmounts?: { [year: string]: number };
    accountId: number;
    categoryId: number;
    createdBy: number;
    receiptImage?: string | null;
}

export class TransactionsService {
    private static instance: TransactionsService;

    public static getInstance(): TransactionsService {
        if (!TransactionsService.instance) {
            TransactionsService.instance = new TransactionsService();
        }
        return TransactionsService.instance;
    }

    async getAllTransactions(): Promise<Transaction[]> {
        try {
            const [rows] = await db.query(`
                SELECT 
                    id, amount, type, category_id as categoryId,
                    description, DATE_FORMAT(date, '%Y-%m-%d') as date,
                    account_id as accountId,
                    apartment_id as apartmentId,
                    invoice_id as invoiceId,
                    reference as relatedTransactionId,
                    receipt_generated as receiptGenerated,
                    receipt_image as receiptImage,
                    created_by as createdBy,
                    DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt
                FROM transactions
                ORDER BY date DESC, id DESC
            `);
            return (rows as any[]).map(row => ({
                ...row,
                id: parseInt(row.id),
                amount: parseFloat(row.amount),
                categoryId: parseInt(row.categoryId),
                accountId: parseInt(row.accountId),
                apartmentId: row.apartmentId ? parseInt(row.apartmentId) : null,
                invoiceId: row.invoiceId ? parseInt(row.invoiceId) : null,
                relatedTransactionId: row.relatedTransactionId ? parseInt(row.relatedTransactionId) : null,
                receiptGenerated: Boolean(row.receiptGenerated),
                receiptImage: row.receiptImage || null,
                createdBy: row.createdBy ? parseInt(row.createdBy) : null
            }));
        } catch (error) {
            console.error('Error fetching transactions:', error);
            return [];
        }
    }

    async getTransactionById(id: number): Promise<Transaction | null> {
        try {
            const [rows] = await db.query(`
                SELECT 
                    id, amount, type, category_id as categoryId,
                    description, DATE_FORMAT(date, '%Y-%m-%d') as date,
                    account_id as accountId,
                    apartment_id as apartmentId,
                    invoice_id as invoiceId,
                    reference as relatedTransactionId,
                    receipt_generated as receiptGenerated,
                    receipt_image as receiptImage,
                    created_by as createdBy,
                    DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt
                FROM transactions
                WHERE id = ?
            `, [id]);
            const transactions = (rows as any[]).map(row => ({
                ...row,
                id: parseInt(row.id),
                amount: parseFloat(row.amount),
                categoryId: parseInt(row.categoryId),
                accountId: parseInt(row.accountId),
                apartmentId: row.apartmentId ? parseInt(row.apartmentId) : null,
                invoiceId: row.invoiceId ? parseInt(row.invoiceId) : null,
                relatedTransactionId: row.relatedTransactionId ? parseInt(row.relatedTransactionId) : null,
                receiptGenerated: Boolean(row.receiptGenerated),
                receiptImage: row.receiptImage || null,
                createdBy: row.createdBy ? parseInt(row.createdBy) : null
            }));
            return transactions[0] || null;
        } catch (error) {
            console.error('Error fetching transaction by ID:', error);
            return null;
        }
    }

    async getTransactionsByAccount(accountId: number): Promise<Transaction[]> {
        try {
            const [rows] = await db.query(`
                SELECT 
                    id, amount, type, category_id as categoryId,
                    description, DATE_FORMAT(date, '%Y-%m-%d') as date,
                    account_id as accountId,
                    apartment_id as apartmentId,
                    invoice_id as invoiceId,
                    reference as relatedTransactionId,
                    receipt_generated as receiptGenerated,
                    receipt_image as receiptImage,
                    created_by as createdBy,
                    DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt
                FROM transactions
                WHERE account_id = ?
                ORDER BY date DESC, id DESC
            `, [accountId]);
            return (rows as any[]).map(row => ({
                ...row,
                id: parseInt(row.id),
                amount: parseFloat(row.amount),
                categoryId: parseInt(row.categoryId),
                accountId: parseInt(row.accountId),
                apartmentId: row.apartmentId ? parseInt(row.apartmentId) : null,
                invoiceId: row.invoiceId ? parseInt(row.invoiceId) : null,
                relatedTransactionId: row.relatedTransactionId ? parseInt(row.relatedTransactionId) : null,
                receiptGenerated: Boolean(row.receiptGenerated),
                receiptImage: row.receiptImage || null,
                createdBy: row.createdBy ? parseInt(row.createdBy) : null
            }));
        } catch (error) {
            console.error('Error fetching transactions by account:', error);
            return [];
        }
    }

    async getTransactionsByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
        try {
            const [rows] = await db.query(`
                SELECT 
                    id, amount, type, category_id as categoryId,
                    description, DATE_FORMAT(date, '%Y-%m-%d') as date,
                    account_id as accountId,
                    apartment_id as apartmentId,
                    invoice_id as invoiceId,
                    reference as relatedTransactionId,
                    receipt_generated as receiptGenerated,
                    receipt_image as receiptImage,
                    created_by as createdBy,
                    DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt
                FROM transactions
                WHERE date >= ? AND date <= ?
                ORDER BY date DESC, id DESC
            `, [startDate, endDate]);
            return (rows as any[]).map(row => ({
                ...row,
                id: parseInt(row.id),
                amount: parseFloat(row.amount),
                categoryId: parseInt(row.categoryId),
                accountId: parseInt(row.accountId),
                apartmentId: row.apartmentId ? parseInt(row.apartmentId) : null,
                invoiceId: row.invoiceId ? parseInt(row.invoiceId) : null,
                relatedTransactionId: row.relatedTransactionId ? parseInt(row.relatedTransactionId) : null,
                receiptGenerated: Boolean(row.receiptGenerated),
                receiptImage: row.receiptImage || null,
                createdBy: row.createdBy ? parseInt(row.createdBy) : null
            }));
        } catch (error) {
            console.error('Error fetching transactions by date range:', error);
            return [];
        }
    }

    async getFilteredTransactions(filters: TransactionListFilters): Promise<Transaction[]> {
        try {
            const conditions: string[] = [];
            const values: Array<string> = [];

            if (filters.fromDate) {
                conditions.push('t.date >= ?');
                values.push(filters.fromDate);
            }

            if (filters.toDate) {
                conditions.push('t.date <= ?');
                values.push(filters.toDate);
            }

            if (filters.apartmentId) {
                conditions.push('t.apartment_id = ?');
                values.push(String(filters.apartmentId));
            }

            const keyword = filters.keyword?.trim();
            if (keyword) {
                const searchPattern = `%${keyword}%`;
                conditions.push(`(
                    LOWER(t.description) LIKE LOWER(?)
                    OR LOWER(COALESCE(NULLIF(u.username, ''), a.owner_name, '')) LIKE LOWER(?)
                    OR LOWER(COALESCE(a.apartment_number, '')) LIKE LOWER(?)
                    OR LOWER(COALESCE(a.apartment_number_unofficial, '')) LIKE LOWER(?)
                    OR LOWER(CONCAT(
                        'Block ',
                        COALESCE(a.floor, ''),
                        ' ',
                        COALESCE(a.apartment_number, ''),
                        ' (',
                        COALESCE(a.apartment_number_unofficial, ''),
                        ')'
                    )) LIKE LOWER(?)
                )`);
                values.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
            }

            const whereClause = conditions.length > 0
                ? `WHERE ${conditions.join(' AND ')}`
                : '';

            const [rows] = await db.query(`
                SELECT
                    t.id, t.amount, t.type, t.category_id as categoryId,
                    t.description, DATE_FORMAT(t.date, '%Y-%m-%d') as date,
                    t.account_id as accountId,
                    t.apartment_id as apartmentId,
                    t.invoice_id as invoiceId,
                    t.reference as relatedTransactionId,
                    t.receipt_generated as receiptGenerated,
                    t.receipt_image as receiptImage,
                    t.created_by as createdBy,
                    DATE_FORMAT(t.created_at, '%Y-%m-%dT%TZ') as createdAt
                FROM transactions t
                LEFT JOIN apartments a ON t.apartment_id = a.id
                LEFT JOIN users u ON a.owner_id = u.id
                ${whereClause}
                ORDER BY t.date DESC, t.id DESC
            `, values);

            return (rows as any[]).map(row => ({
                ...row,
                id: parseInt(row.id),
                amount: parseFloat(row.amount),
                categoryId: parseInt(row.categoryId),
                accountId: parseInt(row.accountId),
                apartmentId: row.apartmentId ? parseInt(row.apartmentId) : null,
                invoiceId: row.invoiceId ? parseInt(row.invoiceId) : null,
                relatedTransactionId: row.relatedTransactionId ? parseInt(row.relatedTransactionId) : null,
                receiptGenerated: Boolean(row.receiptGenerated),
                receiptImage: row.receiptImage || null,
                createdBy: row.createdBy ? parseInt(row.createdBy) : null
            }));
        } catch (error) {
            console.error('Error fetching filtered transactions:', error);
            return [];
        }
    }

    async getAvailableYears(): Promise<number[]> {
        try {
            const [rows] = await db.query(`
                SELECT DISTINCT YEAR(date) as year
                FROM transactions
                ORDER BY year DESC
            `);
            return (rows as any[])
                .map(row => parseInt(row.year, 10))
                .filter(year => !Number.isNaN(year));
        } catch (error) {
            console.error('Error fetching transaction years:', error);
            return [];
        }
    }

    async createTransaction(transactionData: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
        try {
            const [result] = await db.query(`
                INSERT INTO transactions (amount, type, category_id, description, date, account_id, apartment_id, invoice_id, reference, created_by, receipt_generated, receipt_image)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                transactionData.amount,
                transactionData.type,
                transactionData.categoryId,
                transactionData.description,
                transactionData.date,
                transactionData.accountId,
                transactionData.apartmentId || null,
                transactionData.invoiceId || null,
                transactionData.relatedTransactionId || null,
                transactionData.createdBy || null,
                transactionData.receiptGenerated ? 1 : 0,
                transactionData.receiptImage || null
            ]);
            
            const insertId = (result as any).insertId;
            const newTransaction = await this.getTransactionById(insertId);
            if (!newTransaction) throw new Error('Failed to retrieve created transaction');
            return newTransaction;
        } catch (error) {
            console.error('Error creating transaction:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to create transaction: ${errorMessage}`);
        }
    }

    async updateTransaction(id: number, updateData: Partial<Omit<Transaction, 'id' | 'createdAt' | 'createdBy'>>): Promise<Transaction | null> {
        try {
            const updateFields: string[] = [];
            const values: any[] = [];
            
            if (updateData.amount !== undefined) {
                updateFields.push('amount = ?');
                values.push(updateData.amount);
            }
            if (updateData.type !== undefined) {
                updateFields.push('type = ?');
                values.push(updateData.type);
            }
            if (updateData.categoryId !== undefined) {
                updateFields.push('category_id = ?');
                values.push(updateData.categoryId);
            }
            if (updateData.description !== undefined) {
                updateFields.push('description = ?');
                values.push(updateData.description);
            }
            if (updateData.date !== undefined) {
                updateFields.push('date = ?');
                values.push(updateData.date);
            }
            if (updateData.accountId !== undefined) {
                updateFields.push('account_id = ?');
                values.push(updateData.accountId);
            }
            if (updateData.apartmentId !== undefined) {
                updateFields.push('apartment_id = ?');
                values.push(updateData.apartmentId);
            }
            if (updateData.invoiceId !== undefined) {
                updateFields.push('invoice_id = ?');
                values.push(updateData.invoiceId || null);
            }
            if (updateData.receiptGenerated !== undefined) {
                updateFields.push('receipt_generated = ?');
                values.push(updateData.receiptGenerated ? 1 : 0);
            }
            if (updateData.receiptImage !== undefined) {
                updateFields.push('receipt_image = ?');
                values.push(updateData.receiptImage);
            }

            if (updateFields.length === 0) {
                return await this.getTransactionById(id);
            }

            values.push(id);
            await db.query(`
                UPDATE transactions
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `, values);
            
            return await this.getTransactionById(id);
        } catch (error) {
            console.error('Error updating transaction:', error);
            return null;
        }
    }

    async deleteTransaction(id: number): Promise<boolean> {
        try {
            // Get transaction before deleting to check for invoiceId and other details
            const transaction = await this.getTransactionById(id);
            const invoiceId = transaction?.invoiceId;
            const apartmentId = transaction?.apartmentId;
            const categoryId = transaction?.categoryId;
            
            // If this transaction has any allocations/credits in invoice_transactions,
            // remove them first so invoice status/amountPaid are updated correctly.
            if (transaction) {
                try {
                    const InvoiceTransactionsService = require('./invoiceTransactionsService').InvoiceTransactionsService;
                    const invoiceTransactionsService = InvoiceTransactionsService.getInstance();
                    await invoiceTransactionsService.deleteByTransactionId(id);
                } catch (allocError) {
                    console.error('Error deleting invoice allocations for transaction:', allocError);
                    // Continue with transaction deletion even if allocation cleanup fails
                }
            }
            
            // Delete the transaction
            const [result] = await db.query(`
                DELETE FROM transactions WHERE id = ?
            `, [id]);
            
            const deleted = (result as any).affectedRows > 0;
            
            // If transaction was deleted and it was linked to an invoice or could affect invoices,
            // recalculate invoice amounts
            if (deleted) {
                const InvoicesService = require('./invoicesService').InvoicesService;
                const invoicesService = InvoicesService.getInstance();
                
                if (invoiceId) {
                    // Transaction was directly linked to an invoice - recalculate that specific invoice
                    console.log(`Transaction ${id} deleted, recalculating invoice ${invoiceId} amounts...`);
                    await invoicesService.recalculateInvoiceAmountsFromTransactions(invoiceId);
                } else if (apartmentId && categoryId) {
                    // Transaction might affect invoices for this apartment/category
                    // Recalculate all invoices to be safe (the method is efficient)
                    console.log(`Transaction ${id} deleted (apt ${apartmentId}, cat ${categoryId}), recalculating all invoice amounts...`);
                    await invoicesService.recalculateInvoiceAmountsFromTransactions();
                } else {
                    // Recalculate all invoices to be safe
                    console.log(`Transaction ${id} deleted, recalculating all invoice amounts...`);
                    await invoicesService.recalculateInvoiceAmountsFromTransactions();
                }
            }
            
            return deleted;
        } catch (error) {
            console.error('Error deleting transaction:', error);
            return false;
        }
    }

    async getTotalIncome(accountId?: number): Promise<number> {
        try {
            let query = `
                SELECT IFNULL(SUM(amount), 0) as total
                FROM transactions
                WHERE type = 'income'
            `;
            const params: any[] = [];
            
            if (accountId !== undefined) {
                query += ` AND account_id = ?`;
                params.push(accountId);
            }
            
            const [rows] = await db.query(query, params);
            return (rows as any)[0].total || 0;
        } catch (error) {
            console.error('Error calculating total income:', error);
            return 0;
        }
    }

    async getTotalExpense(accountId?: number): Promise<number> {
        try {
            let query = `
                SELECT IFNULL(SUM(amount), 0) as total
                FROM transactions
                WHERE type = 'expense'
            `;
            const params: any[] = [];
            
            if (accountId !== undefined) {
                query += ` AND account_id = ?`;
                params.push(accountId);
            }
            
            const [rows] = await db.query(query, params);
            return (rows as any)[0].total || 0;
        } catch (error) {
            console.error('Error calculating total expense:', error);
            return 0;
        }
    }

    async getTransactionStats(startDate?: string, endDate?: string): Promise<{
        totalIncome: number;
        totalExpense: number;
        netBalance: number;
        transactionCount: number;
    }> {
        try {
            let query = `
                SELECT 
                    IFNULL(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as totalIncome,
                    IFNULL(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as totalExpense,
                    COUNT(*) as transactionCount
                FROM transactions
                WHERE 1=1
            `;
            const params: any[] = [];
            
            if (startDate) {
                query += ` AND date >= ?`;
                params.push(startDate);
            }
            if (endDate) {
                query += ` AND date <= ?`;
                params.push(endDate);
            }
            
            const [rows] = await db.query(query, params);
            const stats = (rows as any)[0];

            const totalIncome = parseFloat(stats.totalIncome) || 0;
            const totalExpense = parseFloat(stats.totalExpense) || 0;
            const transactionCount = parseInt(stats.transactionCount) || 0;

            return {
                totalIncome,
                totalExpense,
                netBalance: totalIncome - totalExpense,
                transactionCount
            };
        } catch (error) {
            console.error('Error getting transaction stats:', error);
            return {
                totalIncome: 0,
                totalExpense: 0,
                netBalance: 0,
                transactionCount: 0
            };
        }
    }

    async getTransactionSummary(): Promise<{
        totalIncome: number;
        totalExpenses: number;
        balance: number;
        transactionCount: number;
    }> {
        try {
            const stats = await this.getTransactionStats();
            return {
                totalIncome: stats.totalIncome,
                totalExpenses: stats.totalExpense,
                balance: stats.netBalance,
                transactionCount: stats.transactionCount
            };
        } catch (error) {
            console.error('Error getting transaction summary:', error);
            return {
                totalIncome: 0,
                totalExpenses: 0,
                balance: 0,
                transactionCount: 0
            };
        }
    }

    // Simplified transfer creation
    async createTransfer(transferData: TransferRequest): Promise<{ fromTransaction: Transaction, toTransaction: Transaction }> {
        try {
            // Get transfer category
            const fromTransaction = await this.createTransaction({
                amount: transferData.amount,
                type: 'expense',
                categoryId: transferData.categoryId,
                description: `Transfer to account: ${transferData.description}`,
                date: transferData.date,
                accountId: transferData.fromAccountId,
                createdBy: transferData.createdBy
            });

            const toTransaction = await this.createTransaction({
                amount: transferData.amount,
                type: 'income',
                categoryId: transferData.categoryId,
                description: `Transfer from account: ${transferData.description}`,
                date: transferData.date,
                accountId: transferData.toAccountId,
                relatedTransactionId: fromTransaction.id,
                createdBy: transferData.createdBy
            });

            return { fromTransaction, toTransaction };
        } catch (error) {
            console.error('Error creating transfer:', error);
            throw error;
        }
    }

    async createCommonExpensePayment(paymentData: CommonExpensePaymentRequest): Promise<Transaction> {
        try {
            // Create the main transaction
            const transaction = await this.createTransaction({
                amount: paymentData.amount,
                type: 'income',
                categoryId: paymentData.categoryId,
                description: paymentData.description,
                date: paymentData.date,
                accountId: paymentData.accountId,
                apartmentId: paymentData.apartmentId,
                createdBy: paymentData.createdBy,
                receiptGenerated: true,
                receiptImage: paymentData.receiptImage || null
            });

            // Handle payment allocation
            const InvoiceTransactionsService = require('./invoiceTransactionsService').InvoiceTransactionsService;
            const invoiceTransactionsService = InvoiceTransactionsService.getInstance();
            const InvoicesService = require('./invoicesService').InvoicesService;
            const invoicesService = InvoicesService.getInstance();
            
            let remainingAmount = paymentData.amount;
            
            // Process yearAmounts if provided (manual allocation)
            if (paymentData.yearAmounts) {
                for (const [yearStr, amount] of Object.entries(paymentData.yearAmounts)) {
                    const year = parseInt(yearStr);
                    const paymentAmount = parseFloat(amount.toString());
                    
                    if (paymentAmount <= 0) continue;
                    
                    // Handle credit (year 0)
                    if (year === 0) {
                        await invoiceTransactionsService.createCredit(
                            paymentData.apartmentId,
                            paymentAmount,
                            transaction.id
                        );
                        remainingAmount -= paymentAmount;
                    } else {
                        // Allocate to invoice for this year
                        const invoices = await invoicesService.getCommonExpenseInvoices(year, paymentData.apartmentId);
                        const invoice = invoices.find((inv: { apartmentId: number }) => inv.apartmentId === paymentData.apartmentId);
                        
                        if (invoice) {
                            await invoiceTransactionsService.createAllocation(
                                invoice.id,
                                transaction.id,
                                paymentData.apartmentId,
                                paymentAmount
                            );
                            remainingAmount -= paymentAmount;
                        }
                    }
                }
            } else {
                // Auto-distribute: allocate to years in order, then credit
                const sortedYears = [...paymentData.paymentYears].sort((a, b) => a - b);
                
                for (const year of sortedYears) {
                    if (remainingAmount <= 0) break;
                    
                    // Handle credit (year 0)
                    if (year === 0) {
                        // All remaining amount goes to credit
                        if (remainingAmount > 0) {
                            await invoiceTransactionsService.createCredit(
                                paymentData.apartmentId,
                                remainingAmount,
                                transaction.id
                            );
                            remainingAmount = 0;
                        }
                    } else {
                        // Allocate to invoice for this year
                        const invoices = await invoicesService.getCommonExpenseInvoices(year, paymentData.apartmentId);
                        const invoice = invoices.find((inv: { apartmentId: number }) => inv.apartmentId === paymentData.apartmentId);
                        
                        if (invoice) {
                            const outstanding = invoice.amount - invoice.amountPaid;
                            const paymentAmount = Math.min(remainingAmount, outstanding);
                            
                            if (paymentAmount > 0) {
                                await invoiceTransactionsService.createAllocation(
                                    invoice.id,
                                    transaction.id,
                                    paymentData.apartmentId,
                                    paymentAmount
                                );
                                remainingAmount -= paymentAmount;
                            }
                        }
                    }
                }
                
                // If there's still remaining amount after processing all years, add to credit
                if (remainingAmount > 0) {
                    await invoiceTransactionsService.createCredit(
                        paymentData.apartmentId,
                        remainingAmount,
                        transaction.id
                    );
                }
            }

            return transaction;
        } catch (error) {
            console.error('Error creating common expense payment:', error);
            throw error;
        }
    }

    async createInvoicePayment(paymentData: {
        invoiceId: number;
        amount: number;
        date: string;
        accountId: number;
        categoryId: number;
        description?: string;
        createdBy: number | null;
        receiptImage?: string | null;
    }): Promise<Transaction> {
        try {
            // Get invoice details
            const InvoicesService = require('./invoicesService').InvoicesService;
            const invoiceService = InvoicesService.getInstance();
            const invoice = await invoiceService.getInvoiceById(paymentData.invoiceId);

            if (!invoice) {
                throw new Error('Invoice not found');
            }

            // Create the transaction linked to invoice
            const transaction = await this.createTransaction({
                amount: paymentData.amount,
                type: 'income',
                categoryId: paymentData.categoryId,
                description: paymentData.description || invoice.description,
                date: paymentData.date,
                accountId: paymentData.accountId,
                apartmentId: invoice.apartmentId,
                invoiceId: paymentData.invoiceId,
                createdBy: paymentData.createdBy,
                receiptGenerated: true,
                receiptImage: paymentData.receiptImage || null
            });

            // Create invoice_transactions record
            const InvoiceTransactionsService = require('./invoiceTransactionsService').InvoiceTransactionsService;
            const invoiceTransactionsService = InvoiceTransactionsService.getInstance();
            await invoiceTransactionsService.createAllocation(
                paymentData.invoiceId,
                transaction.id,
                invoice.apartmentId,
                paymentData.amount
            );

            return transaction;
        } catch (error) {
            console.error('Error creating invoice payment:', error);
            throw error;
        }
    }

    /**
     * Create payment for multiple invoices in one transaction
     */
    async createMultipleInvoicePayment(paymentData: {
        invoiceIds: number[];
        invoiceAmounts?: { [invoiceId: string]: number };  // Optional: specific amounts per invoice
        totalAmount: number;
        date: string;
        accountId: number;
        categoryId: number;
        description?: string;
        createdBy: number | null;
        receiptImage?: string | null;
    }): Promise<Transaction> {
        try {
            const InvoicesService = require('./invoicesService').InvoicesService;
            const InvoiceTransactionsService = require('./invoiceTransactionsService').InvoiceTransactionsService;
            const invoiceService = InvoicesService.getInstance();
            const invoiceTransactionsService = InvoiceTransactionsService.getInstance();

            // Get all invoices
            const invoices = await Promise.all(
                paymentData.invoiceIds.map(id => invoiceService.getInvoiceById(id))
            );

            const validInvoices = invoices.filter(inv => inv !== null);
            if (validInvoices.length === 0) {
                throw new Error('No valid invoices found');
            }

            // Use first invoice's apartment (all should be same apartment for single payment)
            const apartmentId = validInvoices[0]!.apartmentId;

            // Calculate amounts per invoice
            const allocations: { invoiceId: number; amount: number }[] = [];
            let remainingAmount = paymentData.totalAmount;

            if (paymentData.invoiceAmounts) {
                // Use provided amounts
                for (const invoice of validInvoices) {
                    const amount = paymentData.invoiceAmounts[invoice!.id.toString()] || 0;
                    if (amount > 0) {
                        allocations.push({ invoiceId: invoice!.id, amount });
                        remainingAmount -= amount;
                    }
                }
            } else {
                // Auto-distribute: allocate to invoices in order until amount is used up
                for (const invoice of validInvoices) {
                    if (remainingAmount <= 0) break;
                    
                    const invoiceBalance = invoice!.amount - invoice!.amountPaid;
                    const amountToAllocate = Math.min(remainingAmount, invoiceBalance);
                    
                    if (amountToAllocate > 0) {
                        allocations.push({ invoiceId: invoice!.id, amount: amountToAllocate });
                        remainingAmount -= amountToAllocate;
                    }
                }
            }

            // Create the transaction
            const transaction = await this.createTransaction({
                amount: paymentData.totalAmount,
                type: 'income',
                categoryId: paymentData.categoryId,
                description: paymentData.description || `Payment for ${allocations.length} invoice(s)`,
                date: paymentData.date,
                accountId: paymentData.accountId,
                apartmentId: apartmentId,
                invoiceId: null,  // Not linked to single invoice
                createdBy: paymentData.createdBy,
                receiptGenerated: true,
                receiptImage: paymentData.receiptImage || null
            });

            // Create invoice_transactions records for each allocation
            await invoiceTransactionsService.allocateToMultipleInvoices(
                transaction.id,
                apartmentId,
                allocations
            );

            // If there's remaining amount (overpayment), create credit record
            if (remainingAmount > 0) {
                await invoiceTransactionsService.createCredit(
                    apartmentId,
                    remainingAmount,
                    transaction.id
                );
            }

            return transaction;
        } catch (error) {
            console.error('Error creating multiple invoice payment:', error);
            throw error;
        }
    }

    /**
     * Get all transactions in the "Credit - Owner" category.
     * These represent ad-hoc owner credits entered directly as income transactions.
     */
    async getCreditOwnerTransactions(filters?: { block?: string }): Promise<any[]> {
        try {
            let query = `
                SELECT
                    t.id,
                    t.amount,
                    t.type,
                    t.category_id as categoryId,
                    t.description,
                    DATE_FORMAT(t.date, '%Y-%m-%d') as date,
                    t.account_id as accountId,
                    t.apartment_id as apartmentId,
                    t.reference,
                    t.notes,
                    DATE_FORMAT(t.created_at, '%Y-%m-%dT%TZ') as createdAt,
                    tc.name as categoryName,
                    a.floor as block,
                    a.apartment_number as unitNumber
                FROM transactions t
                INNER JOIN transaction_categories tc ON t.category_id = tc.id
                LEFT JOIN apartments a ON t.apartment_id = a.id
                WHERE tc.name = 'Credit - Owner'
            `;
            const params: any[] = [];

            if (filters?.block) {
                query += ` AND a.floor = ?`;
                params.push(filters.block);
            }

            query += ` ORDER BY t.date DESC, t.id DESC`;

            const [rows] = await db.query(query, params);
            return (rows as any[]).map(row => ({
                ...row,
                id: parseInt(row.id),
                amount: parseFloat(row.amount),
                categoryId: parseInt(row.categoryId),
                accountId: parseInt(row.accountId),
                apartmentId: row.apartmentId ? parseInt(row.apartmentId) : null,
            }));
        } catch (error) {
            console.error('Error fetching Credit-Owner transactions:', error);
            return [];
        }
    }
}
