import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { DATA_PATHS } from '../../src/constants';
import { TransactionListFilters, TransactionsService } from '../services/transactionsService';
import { AccountsService } from '../services/accountsService';
import { TransactionCategoriesService } from '../services/transactionCategoriesService';
import { ApartmentsService } from '../services/apartmentsService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { PaymentsService } from '../services/paymentsService';
import { UsersService, User } from '../services/usersService';
import {
    isHiddenFromReports,
    isTransferTransaction,
    isWalletAdjustmentTransaction
} from '../services/transactionReportFilters';
import { notifyOwnerOfInvoicePayment, notifyAfterCommonExpensePayment } from '../../src/services/emailService';

// Configure multer for receipt image uploads (DATA_PATHS resolves project root in both dev and dist)
const uploadDir = DATA_PATHS.RECEIPTS_UPLOADS_DIR;

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const RECEIPT_MAX_SIZE_MB = 20;

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.heic', '.heif', '.pdf'];
    const isAllowedMime =
        file.mimetype.startsWith('image/') ||
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/x-pdf';
    const isAllowedExt = allowedExtensions.includes(ext);

    if (isAllowedMime || isAllowedExt) {
        return cb(null, true);
    }
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) and PDF are allowed!'));
};

export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: RECEIPT_MAX_SIZE_MB * 1024 * 1024
    }
});

export class TransactionsController {
    /**
     * Multer middleware with user-friendly errors for receipt uploads.
     */
    static handleReceiptUpload(req: Request, res: Response, next: NextFunction): void {
        upload.single('receiptImage')(req, res, (err: unknown) => {
            if (!err) {
                return next();
            }

            console.error('Receipt upload error:', err);

            let message = 'Receipt upload failed';
            const multerErr = err as { code?: string; message?: string };
            if (multerErr.code === 'LIMIT_FILE_SIZE') {
                message = `Receipt file is too large. Maximum size is ${RECEIPT_MAX_SIZE_MB}MB.`;
            } else if (multerErr.message) {
                message = multerErr.message;
            }

            if (req.headers.accept?.includes('application/json')) {
                res.status(400).json({ success: false, message });
                return;
            }

            const transactionId = req.params.id;
            const redirectUrl = transactionId
                ? `/admin/transactions/${transactionId}/edit?error=${encodeURIComponent(message)}`
                : `/admin/transactions/create?error=${encodeURIComponent(message)}`;
            res.redirect(redirectUrl);
        });
    }

    private static transactionsService = TransactionsService.getInstance();
    private static accountsService = AccountsService.getInstance();
    private static categoriesService = TransactionCategoriesService.getInstance();
    private static apartmentsService = ApartmentsService.getInstance();
    private static usersService = new UsersService();
    private static siteSettingsService = SiteSettingsService.getInstance();
    private static paymentsService = PaymentsService.getInstance();

    static async transactions(req: Request, res: Response) {
        try {
            const siteTitle = await TransactionsController.siteSettingsService.getSiteTitle();
            
            // Get list filters from query parameters
            const fromDate = req.query.fromDate as string | undefined;
            const toDate = req.query.toDate as string | undefined;
            const keyword = ((req.query.keyword as string | undefined) || '').trim();

            const transactionFilters: TransactionListFilters = { keyword };
            if (fromDate) transactionFilters.fromDate = fromDate;
            if (toDate) transactionFilters.toDate = toDate;

            const transactions = await TransactionsController.transactionsService.getFilteredTransactions(transactionFilters);
            
            const accounts = await TransactionsController.accountsService.getAllAccounts();
            const categories = await TransactionsController.categoriesService.getAllCategories();
            const apartments = await TransactionsController.apartmentsService.getAllApartments();
            const users = await TransactionsController.usersService.getAllUsers();

            // Enrich transactions with related data
            const enrichedTransactions = transactions.map(transaction => {
                const account = accounts.find(w => w.id === transaction.accountId);
                const category = categories.find(c => c.id === transaction.categoryId);
                const apartment = transaction.apartmentId ? apartments.find(a => a.id === transaction.apartmentId) : null;
                const user: User | null | undefined = users.find((u: User) => u.id === transaction.createdBy) || 
                    (transaction.createdBy === 1 ? users.find((u: User) => u.role === 'Super Admin') : null);

                return {
                    ...transaction,
                    accountName: account ? account.name : 'Unknown Account',
                    categoryName: category ? category.name : 'Unknown Category',
                    categoryColor: category ? category.color : '#999999',
                    apartmentNumber: apartment ? `Block ${apartment.block} ${apartment.unitNumberOfficial} (${apartment.unitNumberUnofficial})` : null,
                    apartmentOwnerName: apartment && apartment.ownerName ? apartment.ownerName : null,
                    apartmentOwnerId: apartment ? apartment.ownerId : null,
                    createdByName: user ? user.name : 'Unknown User'
                };
            });

            // Get summary - if date range is provided, calculate summary for that range
            let summary;
            if (fromDate && toDate) {
                const stats = await TransactionsController.transactionsService.getTransactionStats(fromDate, toDate);
                summary = {
                    totalIncome: stats.totalIncome,
                    totalExpenses: stats.totalExpense,
                    balance: stats.netBalance,
                    transactionCount: stats.transactionCount
                };
            } else {
                summary = await TransactionsController.transactionsService.getTransactionSummary();
            }

            res.render('transactions/list', {
                title: 'Transactions',
                siteTitle,
                transactions: enrichedTransactions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
                summary,
                accounts,
                categories,
                currentPage: 'transactions',
                fromDate: fromDate || '',
                toDate: toDate || '',
                keyword
            });
        } catch (error) {
            console.error('Error fetching transactions:', error);
            res.status(500).render('admin/error', { 
                message: 'Error loading transactions',
                error: error 
            });
        }
    }

    static async createTransaction(req: Request, res: Response) {
        try {
            const siteTitle = await TransactionsController.siteSettingsService.getSiteTitle();
            const accounts = await TransactionsController.accountsService.getAllAccountsWithBalance();
            const categories = await TransactionsController.categoriesService.getActiveCategories();
            const apartments = await TransactionsController.apartmentsService.getAllApartments();
            const users = await TransactionsController.usersService.getAllUsers();

            // Get apartmentId from query if provided
            const apartmentId = req.query.apartmentId ? parseInt(req.query.apartmentId as string) : undefined;
            
            // Fetch outstanding invoices for this apartment if apartmentId is provided
            let outstandingInvoices: any[] = [];
            if (apartmentId) {
                const InvoicesService = require('../services/invoicesService').InvoicesService;
                const invoicesService = InvoicesService.getInstance();
                
                // Get all invoices for this apartment (status computed on-the-fly)
                const allInvoices = await invoicesService.getInvoicesByApartment(apartmentId);
                
                // Filter for unpaid/partial invoices
                outstandingInvoices = allInvoices.filter((inv: any) => {
                    const balance = inv.amount - inv.amountPaid;
                    return balance > 0 && (inv.status === 'unpaid' || inv.status === 'partial');
                }).map((inv: any) => {
                    const category = categories.find(c => c.id === inv.categoryId);
                    return {
                        ...inv,
                        categoryName: category ? category.name : 'Unknown',
                        categoryColor: category ? category.color : '#999999',
                        balance: inv.amount - inv.amountPaid
                    };
                });
            }

            res.render('transactions/create', {
                title: 'Create Transaction',
                siteTitle,
                accounts,
                categories,
                apartments,
                users,
                apartmentId,
                outstandingInvoices,
                currentPage: 'transactions'
            });
        } catch (error) {
            console.error('Error loading create transaction page:', error);
            res.status(500).render('admin/error', { 
                message: 'Error loading create transaction page',
                error: error 
            });
        }
    }

    static async createTransactionPost(req: Request, res: Response) {
        try {
            const { amount, categoryId, description, date, accountId, apartmentIds, transactionType, submitAction, invoiceId, invoiceIds, invoiceAmounts } = req.body;
            const userId = (req.session as any).user?.id || (req.session as any).adminUser?.id || 10; // Get from session, fallback to first admin user
            
            // Handle uploaded receipt image
            const receiptImage = (req as any).file ? `/uploads/receipts/${(req as any).file.filename}` : null;

            // If multiple invoiceIds are provided, use multiple invoice payment flow
            if (invoiceIds && Array.isArray(invoiceIds) && invoiceIds.length > 0) {
                const InvoicesService = require('../services/invoicesService').InvoicesService;
                const invoicesService = InvoicesService.getInstance();
                const totalAmount = parseFloat(amount);
                
                if (!totalAmount || !date || !accountId) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Amount, date, and account are required for invoice payment' 
                    });
                }
                
                // Parse invoice amounts if provided
                let parsedInvoiceAmounts: { [key: string]: number } | undefined;
                if (invoiceAmounts) {
                    try {
                        parsedInvoiceAmounts = typeof invoiceAmounts === 'string' 
                            ? JSON.parse(invoiceAmounts) 
                            : invoiceAmounts;
                    } catch (e) {
                        console.error('Error parsing invoiceAmounts:', e);
                    }
                }
                
                // Create multiple invoice payment transaction
                
                const paymentReq: any = {
                    invoiceIds: invoiceIds.map((id: string) => parseInt(id)),
                    totalAmount,
                    date,
                    accountId: parseInt(accountId),
                    categoryId: parseInt(categoryId),
                    description: description || `Payment for ${invoiceIds.length} invoice(s)`,
                    createdBy: userId,
                    receiptImage: receiptImage || null
                };
                if (parsedInvoiceAmounts !== undefined) {
                    paymentReq.invoiceAmounts = parsedInvoiceAmounts;
                }
                
                const transaction = await TransactionsController.transactionsService.createMultipleInvoicePayment(paymentReq);

                try {
                    const InvoiceTransactionsService = require('../services/invoiceTransactionsService').InvoiceTransactionsService;
                    const invoiceTransactionsService = InvoiceTransactionsService.getInstance();
                    const allocations = await invoiceTransactionsService.getByTransactionId(transaction.id);
                    for (const allocation of allocations) {
                        if (allocation.invoiceId) {
                            void notifyOwnerOfInvoicePayment({
                                invoiceId: allocation.invoiceId,
                                cashAmount: allocation.amount,
                                walletAmount: 0,
                                paymentDate: date,
                                transactionId: transaction.id
                            });
                        }
                    }
                } catch (emailErr) {
                    console.error('[payment-email] Failed after multi-invoice payment:', emailErr);
                }

                // Redirect based on submitAction
                if (submitAction === 'create_edit') {
                    return res.json({
                        success: true,
                        message: 'Invoice payments recorded successfully',
                        transaction,
                        redirect: `/admin/transactions/${transaction.id}/edit`
                    });
                } else {
                    return res.json({
                        success: true,
                        message: 'Invoice payments recorded successfully',
                        transaction,
                        redirect: '/admin/transactions'
                    });
                }
            }

            // If single invoiceId is provided, check if we should use common expenses flow (with credit)
            if (invoiceId) {
                const InvoicesService = require('../services/invoicesService').InvoicesService;
                const invoicesService = InvoicesService.getInstance();
                const invoiceIdNum = parseInt(invoiceId);
                const paymentAmount = parseFloat(amount);
                
                if (!paymentAmount || !date || !accountId) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Amount, date, and account are required for invoice payment' 
                    });
                }
                
                // Get invoice to get categoryId
                const invoice = await invoicesService.getInvoiceById(invoiceIdNum);
                if (!invoice) {
                    return res.status(404).json({ 
                        success: false, 
                        message: 'Invoice not found' 
                    });
                }
                
                // Check if this is a common expenses invoice and credit is also selected
                const category = await TransactionsController.categoriesService.getCategoryById(parseInt(categoryId));
                const isCommonExpenses = category && category.name.toLowerCase() === 'common expenses';
                const { paymentYears, yearAmounts } = req.body;
                const parsedPaymentYears = paymentYears 
                    ? (Array.isArray(paymentYears) 
                        ? paymentYears.map((year: string) => parseInt(year))
                        : [parseInt(paymentYears)])
                    : [];
                const hasCredit = parsedPaymentYears.includes(0);
                
                // If it's common expenses and credit is selected, use common expenses flow
                if (isCommonExpenses && hasCredit && invoice.year) {
                    // Parse year amounts if provided
                    let parsedYearAmounts: { [year: string]: number } | undefined;
                    if (yearAmounts) {
                        try {
                            parsedYearAmounts = JSON.parse(yearAmounts);
                        } catch (e) {
                            console.error('Error parsing yearAmounts:', e);
                        }
                    }
                    
                    // Ensure invoice year is in paymentYears if not already
                    if (!parsedPaymentYears.includes(invoice.year)) {
                        parsedPaymentYears.push(invoice.year);
                    }
                    
                    // Calculate amounts: invoice amount goes to invoice year, credit amount to credit
                    if (!parsedYearAmounts) {
                        parsedYearAmounts = {};
                    }
                    
                    // Get invoice balance
                    const invoiceBalance = invoice.amount - invoice.amountPaid;
                    
                    // If yearAmounts already has values, use them (user manually entered)
                    // Otherwise, calculate: invoice balance goes to invoice, rest to credit
                    if (Object.keys(parsedYearAmounts).length === 0) {
                        // Auto-calculate: invoice balance to invoice year, rest to credit
                        parsedYearAmounts[invoice.year.toString()] = invoiceBalance;
                        const creditAmount = paymentAmount - invoiceBalance;
                        if (creditAmount > 0) {
                            parsedYearAmounts['0'] = creditAmount;
                        }
                    } else {
                        // User manually entered amounts - ensure invoice year is included if not already
                        if (!parsedYearAmounts[invoice.year.toString()]) {
                            // If invoice year not in yearAmounts, add invoice balance to it
                            parsedYearAmounts[invoice.year.toString()] = invoiceBalance;
                        }
                    }
                    
                    // Generate description if not provided
                    let finalDescription = description;
                    if (!finalDescription) {
                        const apartment = await TransactionsController.apartmentsService.getApartmentById(invoice.apartmentId);
                        if (apartment) {
                            finalDescription = `Common Expenses Payment for Apartment Block ${apartment.block} ${apartment.unitNumberOfficial} (${apartment.unitNumberUnofficial})`;
                        } else {
                            finalDescription = invoice.description || `Common Expenses Payment for Apartment ${invoice.apartmentId}`;
                        }
                    }
                    
                    const paymentRequest: any = {
                        amount: paymentAmount,
                        description: finalDescription,
                        date,
                        accountId: parseInt(accountId),
                        categoryId: parseInt(categoryId),
                        apartmentId: invoice.apartmentId,
                        paymentYears: parsedPaymentYears,
                        yearAmounts: parsedYearAmounts,
                        createdBy: userId
                    };
                    
                    const result = await TransactionsController.transactionsService.createCommonExpensePayment({
                        ...paymentRequest,
                        receiptImage: receiptImage
                    });

                    void notifyAfterCommonExpensePayment({
                        transactionId: result.id,
                        apartmentId: invoice.apartmentId,
                        paymentDate: date,
                        description: finalDescription
                    });
                    
                    // Redirect based on submitAction
                    if (req.headers.accept?.includes('application/json')) {
                        if (submitAction === 'create_edit') {
                            return res.json({
                                success: true,
                                result,
                                redirect: `/admin/transactions/${result.id}/edit`
                            });
                        } else {
                            return res.json({ success: true, result });
                        }
                    } else {
                        if (submitAction === 'create_edit') {
                            let createdId: number | null = null;
                            if (result && typeof result === 'object' && 'id' in result) {
                                createdId = result.id;
                            }
                            if (createdId) {
                                return res.redirect(`/admin/transactions/${createdId}/edit`);
                            }
                        }
                        return res.redirect('/admin/transactions');
                    }
                } else {
                    // Regular invoice payment flow (no credit)
                    const transaction = await TransactionsController.transactionsService.createInvoicePayment({
                        invoiceId: invoiceIdNum,
                        amount: paymentAmount,
                        date,
                        accountId: parseInt(accountId),
                        categoryId: invoice.categoryId,
                        description: description || invoice.description,
                        createdBy: userId,
                        receiptImage: receiptImage || null
                    });

                    void notifyOwnerOfInvoicePayment({
                        invoiceId: invoiceIdNum,
                        cashAmount: paymentAmount,
                        walletAmount: 0,
                        paymentDate: date,
                        transactionId: transaction.id
                    });
                    
                    // Redirect based on submitAction
                    if (req.headers.accept?.includes('application/json')) {
                        if (submitAction === 'create_edit') {
                            return res.json({
                                success: true,
                                message: 'Invoice payment recorded successfully',
                                transaction,
                                redirect: `/admin/transactions/${transaction.id}/edit`
                            });
                        } else {
                            return res.json({
                                success: true,
                                message: 'Invoice payment recorded successfully',
                                transaction,
                                redirect: '/admin/transactions'
                            });
                        }
                    } else {
                        if (submitAction === 'create_edit') {
                            return res.redirect(`/admin/transactions/${transaction.id}/edit`);
                        }
                        return res.redirect('/admin/transactions');
                    }
                }
            }

            if (!amount || !categoryId || !date || !accountId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'All required fields must be filled' 
                });
            }

            const category = await TransactionsController.categoriesService.getCategoryById(parseInt(categoryId));
            if (!category) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid category' 
                });
            }

            // Check if description is required based on category
            const isCommonExpenses = category.name.toLowerCase() === 'common expenses';
            if (!isCommonExpenses && !description) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Description is required for this transaction type' 
                });
            }

            const parsedAmount = parseFloat(amount);
            if (parsedAmount <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Amount must be greater than 0' 
                });
            }

            let result: any;

            // Handle different transaction types
            if (category.name.toLowerCase() === 'transfer') {
                const { toAccountId } = req.body;
                if (!toAccountId) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Destination account is required for transfers' 
                    });
                }

                result = await TransactionsController.transactionsService.createTransfer({
                    fromAccountId: parseInt(accountId),
                    toAccountId: parseInt(toAccountId),
                    amount: parsedAmount,
                    categoryId: parseInt(categoryId),
                    description,
                    date,
                    createdBy: userId
                });
            } else if (category.name.toLowerCase() === 'common expenses') {
                const { apartmentId, paymentYears, yearAmounts } = req.body;
                
                if (!apartmentId) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Apartment must be selected for common expenses' 
                    });
                }
                
                if (!paymentYears || (Array.isArray(paymentYears) && paymentYears.length === 0)) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'At least one payment year or credit must be selected for common expenses' 
                    });
                }

                const parsedPaymentYears = Array.isArray(paymentYears) 
                    ? paymentYears.map((year: string) => parseInt(year))
                    : [parseInt(paymentYears)];
                
                // Allow credit-only payments (year 0)
                const hasValidYear = parsedPaymentYears.some(year => year > 0);
                const hasCredit = parsedPaymentYears.includes(0);
                
                if (!hasValidYear && !hasCredit) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'At least one payment year or credit must be selected' 
                    });
                }

                // Parse year amounts if provided
                let parsedYearAmounts: { [year: string]: number } | undefined;
                if (yearAmounts) {
                    try {
                        parsedYearAmounts = JSON.parse(yearAmounts);
                    } catch (e) {
                        console.error('Error parsing yearAmounts:', e);
                    }
                }

                // Generate description if not provided
                let finalDescription = description;
                if (!finalDescription) {
                    const apartment = await TransactionsController.apartmentsService.getApartmentById(parseInt(apartmentId));
                    if (apartment) {
                        finalDescription = `Common Expenses Payment for Apartment Block ${apartment.block} ${apartment.unitNumberOfficial} (${apartment.unitNumberUnofficial})`;
                    } else {
                        finalDescription = `Common Expenses Payment for Apartment ${apartmentId}`;
                    }
                }

                const paymentRequest: any = {
                    amount: parsedAmount,
                    description: finalDescription,
                    date,
                    accountId: parseInt(accountId),
                    categoryId: parseInt(categoryId),
                    apartmentId: parseInt(apartmentId),
                    paymentYears: parsedPaymentYears,
                    createdBy: userId
                };
                
                if (parsedYearAmounts) {
                    paymentRequest.yearAmounts = parsedYearAmounts;
                }
                
                result = await TransactionsController.transactionsService.createCommonExpensePayment({
                    ...paymentRequest,
                    receiptImage: receiptImage
                });

                void notifyAfterCommonExpensePayment({
                    transactionId: result.id,
                    apartmentId: parseInt(apartmentId),
                    paymentDate: date,
                    description: finalDescription
                });
            } else {
                // Regular transaction
                // Prefer an explicit transactionType sent by the client (if valid).
                // Otherwise fall back to the category's configured type. If the
                // category is 'both' and no explicit value was provided, default to 'income'.
                let type: 'income' | 'expense';
                if (transactionType && (transactionType === 'income' || transactionType === 'expense')) {
                    type = transactionType as 'income' | 'expense';
                } else if (category.type === 'both') {
                    type = 'income';
                } else {
                    type = category.type as 'income' | 'expense';
                }
                
                result = await TransactionsController.transactionsService.createTransaction({
                    amount: parsedAmount,
                    type: type as 'income' | 'expense',
                    categoryId: parseInt(categoryId),
                    description,
                    date,
                    accountId: parseInt(accountId),
                    apartmentId: apartmentIds && apartmentIds.length > 0 ? parseInt(apartmentIds[0]) : null,
                    receiptGenerated: false,
                    receiptImage: receiptImage,
                    createdBy: userId
                });
            }

            if (req.headers.accept?.includes('application/json')) {
                res.json({ success: true, result });
            } else {
                // If user clicked "Create & Edit", redirect to edit page for the created transaction
                if (submitAction === 'create_edit') {
                    let createdId: number | null = null;
                    if (result && typeof result === 'object') {
                        if ('id' in result && typeof result.id === 'number') {
                            createdId = result.id;
                        } else if ('fromTransaction' in result && result.fromTransaction && typeof result.fromTransaction.id === 'number') {
                            createdId = result.fromTransaction.id;
                        }
                    }

                    if (createdId) {
                        return res.redirect(`/admin/transactions/${createdId}/edit`);
                    }
                }

                res.redirect('/admin/transactions');
            }
        } catch (error) {
            console.error('Error creating transaction:', error);
            if (req.headers.accept?.includes('application/json')) {
                res.status(500).json({ 
                    success: false, 
                    message: error instanceof Error ? error.message : 'Error creating transaction' 
                });
            } else {
                res.status(500).render('admin/error', { 
                    message: 'Error creating transaction',
                    error: error 
                });
            }
        }
    }

    static async editTransaction(req: Request, res: Response) {
        try {
            const siteTitle = await TransactionsController.siteSettingsService.getSiteTitle();
            const transactionId = parseInt(req.params.id);
            const transaction = await TransactionsController.transactionsService.getTransactionById(transactionId);
            
            if (!transaction) {
                return res.status(404).render('admin/error', { 
                    message: 'Transaction not found' 
                });
            }

            const accounts = await TransactionsController.accountsService.getAllAccountsWithBalance();
            const categories = await TransactionsController.categoriesService.getActiveCategories();
            const apartments = await TransactionsController.apartmentsService.getAllApartments();
            const users = await TransactionsController.usersService.getAllUsers();

            res.render('transactions/edit', {
                title: 'Edit Transaction',
                siteTitle,
                transaction,
                accounts,
                categories,
                apartments,
                users,
                currentPage: 'transactions'
            });
        } catch (error) {
            console.error('Error loading edit transaction page:', error);
            res.status(500).render('admin/error', { 
                message: 'Error loading edit transaction page',
                error: error 
            });
        }
    }

    static async editTransactionPost(req: Request, res: Response) {
        try {
            const transactionId = parseInt(req.params.id);
            const { amount, categoryId, description, date, type, accountId, apartmentId, deleteReceiptImage } = req.body;

            // Get the transaction to check its type
            const existingTransaction = await TransactionsController.transactionsService.getTransactionById(transactionId);
            if (!existingTransaction) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Transaction not found' 
                });
            }
            
            // Handle uploaded receipt image
            let receiptImage = existingTransaction.receiptImage;
            
            // If deleteReceiptImage is set, delete the existing image
            if (deleteReceiptImage === 'true' && existingTransaction.receiptImage) {
                const imagePath = path.join(
                    DATA_PATHS.PUBLIC_DIR,
                    existingTransaction.receiptImage.replace(/^\//, '')
                );
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
                receiptImage = null;
            }
            
            // If a new file is uploaded, replace the old one
            if ((req as any).file) {
                // Delete old image if it exists
                if (existingTransaction.receiptImage) {
                    const oldImagePath = path.join(
                        DATA_PATHS.PUBLIC_DIR,
                        existingTransaction.receiptImage.replace(/^\//, '')
                    );
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                    }
                }
                receiptImage = `/uploads/receipts/${(req as any).file.filename}`;
            }

            // Get category to check if it's common expenses
            const category = await TransactionsController.categoriesService.getCategoryById(parseInt(categoryId));
            const isCommonExpenses = category && category.name.toLowerCase() === 'common expenses';

            // Validate required fields (description not required for common expenses)
            if (!amount || !categoryId || !date || !accountId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'All required fields must be filled' 
                });
            }

            if (!isCommonExpenses && !description) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Description is required for this transaction type' 
                });
            }

            // Determine transaction type
            let transactionType: 'income' | 'expense' = existingTransaction.type;
            if (type) {
                transactionType = type as 'income' | 'expense';
            }

            // Build update data
            const updateData: any = {
                categoryId: parseInt(categoryId),
                description: description ? description.trim() : existingTransaction.description,
                date,
                accountId: parseInt(accountId),
                type: transactionType
            };

            // For common expenses, we can't change amount or apartment (already applied to payments)
            // For other transactions, allow updating amount
            if (!isCommonExpenses) {
                updateData.amount = parseFloat(amount);
            }

            // Update apartment if provided
            if (apartmentId) {
                updateData.apartmentId = parseInt(apartmentId);
            }
            
            // Update receipt image
            updateData.receiptImage = receiptImage;

            const updatedTransaction = await TransactionsController.transactionsService.updateTransaction(transactionId, updateData);

            if (!updatedTransaction) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Transaction not found' 
                });
            }

            if (req.headers.accept?.includes('application/json')) {
                res.json({ success: true, transaction: updatedTransaction });
            } else {
                res.redirect('/admin/transactions');
            }
        } catch (error) {
            console.error('Error updating transaction:', error);
            if (req.headers.accept?.includes('application/json')) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Error updating transaction' 
                });
            } else {
                res.status(500).render('admin/error', { 
                    message: 'Error updating transaction',
                    error: error 
                });
            }
        }
    }

    static async deleteTransaction(req: Request, res: Response) {
        try {
            const transactionId = parseInt(req.params.id);
            const success = await TransactionsController.transactionsService.deleteTransaction(transactionId);

            if (!success) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Transaction not found' 
                });
            }

            res.json({ success: true, message: 'Transaction deleted successfully' });
        } catch (error) {
            console.error('Error deleting transaction:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error deleting transaction' 
            });
        }
    }

    static async getTransactionsByAccount(req: Request, res: Response) {
        try {
            const accountId = parseInt(req.params.accountId);
            const transactions = await TransactionsController.transactionsService.getTransactionsByAccount(accountId);
            res.json(transactions);
        } catch (error) {
            console.error('Error getting transactions by account:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error getting transactions' 
            });
        }
    }

    static async getTransactionSummary(req: Request, res: Response) {
        try {
            const summary = await TransactionsController.transactionsService.getTransactionSummary();
            res.json(summary);
        } catch (error) {
            console.error('Error getting transaction summary:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error getting summary' 
            });
        }
    }

    // Helper method to get filtered transactions based on query parameters
    private static async getFilteredTransactions(req: Request) {
        let fromDate = req.query.fromDate as string | undefined;
        let toDate = req.query.toDate as string | undefined;
        const year = req.query.year as string | undefined;
        const type = req.query.type as string | undefined;

        if (year && year !== 'all' && !fromDate && !toDate) {
            const y = parseInt(year, 10);
            if (!Number.isNaN(y)) {
                fromDate = `${y}-01-01`;
                toDate = `${y}-12-31`;
            }
        }
        const categoryId = req.query.categoryId as string | undefined;
        const accountId = req.query.accountId as string | undefined;
        const keyword = req.query.keyword as string | undefined;
        const amountFrom = req.query.amountFrom as string | undefined;
        const amountTo = req.query.amountTo as string | undefined;

        // Fetch transactions based on date range
        let transactions;
        if (fromDate && toDate) {
            transactions = await TransactionsController.transactionsService.getTransactionsByDateRange(fromDate, toDate);
        } else if (fromDate) {
            // Only fromDate provided - get all transactions from that date onwards
            const today = new Date().toISOString().split('T')[0];
            transactions = await TransactionsController.transactionsService.getTransactionsByDateRange(fromDate, today);
        } else if (toDate) {
            // Only toDate provided - get all transactions up to that date
            const earliestDate = '2000-01-01'; // A reasonable earliest date
            transactions = await TransactionsController.transactionsService.getTransactionsByDateRange(earliestDate, toDate);
        } else {
            transactions = await TransactionsController.transactionsService.getAllTransactions();
        }

        const accounts = await TransactionsController.accountsService.getAllAccounts();
        const categories = await TransactionsController.categoriesService.getAllCategories();
        const apartments = await TransactionsController.apartmentsService.getAllApartments();
        const users = await TransactionsController.usersService.getAllUsers();

        // Enrich transactions with related data
        let enrichedTransactions = transactions.map(transaction => {
            const account = accounts.find(w => w.id === transaction.accountId);
            const category = categories.find(c => c.id === transaction.categoryId);
            const apartment = transaction.apartmentId ? apartments.find(a => a.id === transaction.apartmentId) : null;
            const user: User | null | undefined = users.find((u: User) => u.id === transaction.createdBy) || 
                (transaction.createdBy === 1 ? users.find((u: User) => u.role === 'Super Admin') : null);

            return {
                ...transaction,
                accountName: account ? account.name : 'Unknown Account',
                categoryName: category ? category.name : 'Unknown Category',
                categoryColor: category ? category.color : '#999999',
                apartmentNumber: apartment ? `Block ${apartment.block} ${apartment.unitNumberOfficial} (${apartment.unitNumberUnofficial})` : null,
                apartmentOwnerName: apartment && apartment.ownerName ? apartment.ownerName : null,
                createdByName: user ? user.name : 'Unknown User'
            };
        });

        // Apply additional filters
        if (type && type !== '') {
            if (type === 'transfer') {
                enrichedTransactions = enrichedTransactions.filter(t => isTransferTransaction(t));
            } else if (type === 'wallet_adjustment') {
                enrichedTransactions = enrichedTransactions.filter(t => isWalletAdjustmentTransaction(t));
            } else {
                enrichedTransactions = enrichedTransactions.filter(t => 
                    t.type === type && !isHiddenFromReports(t)
                );
            }
        } else {
            // Exclude transfers and wallet adjustments by default if no type filter
            enrichedTransactions = enrichedTransactions.filter(t => !isHiddenFromReports(t));
        }

        if (categoryId && categoryId !== '') {
            enrichedTransactions = enrichedTransactions.filter(t => t.categoryId === parseInt(categoryId));
        }

        if (accountId && accountId !== '') {
            enrichedTransactions = enrichedTransactions.filter(t => t.accountId === parseInt(accountId));
        }

        if (keyword && keyword !== '') {
            const keywordLower = keyword.toLowerCase();
            enrichedTransactions = enrichedTransactions.filter(t => 
                t.description.toLowerCase().includes(keywordLower) ||
                (t.apartmentNumber && t.apartmentNumber.toLowerCase().includes(keywordLower)) ||
                (t.apartmentOwnerName && t.apartmentOwnerName.toLowerCase().includes(keywordLower))
            );
        }

        if (amountFrom && amountFrom !== '') {
            const minAmount = parseFloat(amountFrom);
            if (!isNaN(minAmount)) {
                enrichedTransactions = enrichedTransactions.filter(t => t.amount >= minAmount);
            }
        }

        if (amountTo && amountTo !== '') {
            const maxAmount = parseFloat(amountTo);
            if (!isNaN(maxAmount)) {
                enrichedTransactions = enrichedTransactions.filter(t => t.amount <= maxAmount);
            }
        }

        return enrichedTransactions;
    }

    static async reportByCategory(req: Request, res: Response) {
        try {
            const siteTitle = await TransactionsController.siteSettingsService.getSiteTitle();
            const currentYear = new Date().getFullYear();
            if (req.query.year === undefined) {
                req.query.year = String(currentYear);
            }
            const selectedYear = req.query.year as string;
            let availableYears = await TransactionsController.transactionsService.getAvailableYears();
            if (!availableYears.includes(currentYear)) {
                availableYears = [currentYear, ...availableYears].sort((a, b) => b - a);
            }

            const transactions = await TransactionsController.getFilteredTransactions(req);
            
            // Group transactions by category
            const groupedByCategory: { [key: string]: any[] } = {};
            transactions.forEach(transaction => {
                const categoryName = transaction.categoryName;
                if (!groupedByCategory[categoryName]) {
                    groupedByCategory[categoryName] = [];
                }
                groupedByCategory[categoryName].push(transaction);
            });

            // Calculate totals per category
            const categoryTotals: { [key: string]: { income: number; expense: number; balance: number; color: string } } = {};
            Object.keys(groupedByCategory).forEach(categoryName => {
                const categoryTransactions = groupedByCategory[categoryName];
                const firstTransaction = categoryTransactions[0];
                const income = categoryTransactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + t.amount, 0);
                const expense = categoryTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + t.amount, 0);
                
                categoryTotals[categoryName] = {
                    income,
                    expense,
                    balance: income - expense,
                    color: firstTransaction.categoryColor
                };
            });

            // Sort categories by name
            const sortedCategories = Object.keys(groupedByCategory).sort();
            
            // Sort transactions within each category by date (newest first)
            sortedCategories.forEach(categoryName => {
                groupedByCategory[categoryName].sort((a: any, b: any) => 
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );
            });

            // Get filter parameters for display
            const fromDate = req.query.fromDate as string | undefined;
            const toDate = req.query.toDate as string | undefined;
            const type = req.query.type as string | undefined;
            const categoryId = req.query.categoryId as string | undefined;
            const accountId = req.query.accountId as string | undefined;
            const keyword = req.query.keyword as string | undefined;

            res.render('transactions/report-by-category', {
                title: 'Transactions Report by Category',
                siteTitle,
                groupedByCategory,
                categoryTotals,
                sortedCategories,
                fromDate: fromDate || '',
                toDate: toDate || '',
                type: type || '',
                categoryId: categoryId || '',
                accountId: accountId || '',
                keyword: keyword || '',
                selectedYear,
                availableYears,
                reportUrl: '/admin/transactions/report/by-category',
                currentPage: 'transactions'
            });
        } catch (error) {
            console.error('Error generating category report:', error);
            res.status(500).render('admin/error', { 
                message: 'Error generating report',
                error: error 
            });
        }
    }

    static async reportChronological(req: Request, res: Response) {
        try {
            const siteTitle = await TransactionsController.siteSettingsService.getSiteTitle();
            const currentYear = new Date().getFullYear();
            if (req.query.year === undefined) {
                req.query.year = String(currentYear);
            }
            const selectedYear = req.query.year as string;
            let availableYears = await TransactionsController.transactionsService.getAvailableYears();
            if (!availableYears.includes(currentYear)) {
                availableYears = [currentYear, ...availableYears].sort((a, b) => b - a);
            }

            const transactions = await TransactionsController.getFilteredTransactions(req);
            
            // Sort transactions chronologically (newest first)
            const sortedTransactions = transactions.sort((a: any, b: any) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            // Get filter parameters for display
            const fromDate = req.query.fromDate as string | undefined;
            const toDate = req.query.toDate as string | undefined;
            const type = req.query.type as string | undefined;
            const categoryId = req.query.categoryId as string | undefined;
            const accountId = req.query.accountId as string | undefined;
            const keyword = req.query.keyword as string | undefined;

            // Calculate summary
            const totalIncome = sortedTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);
            const totalExpenses = sortedTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);
            const balance = totalIncome - totalExpenses;

            res.render('transactions/report-chronological', {
                title: 'Chronological Transactions Report',
                siteTitle,
                transactions: sortedTransactions,
                totalIncome,
                totalExpenses,
                balance,
                transactionCount: sortedTransactions.length,
                fromDate: fromDate || '',
                toDate: toDate || '',
                type: type || '',
                categoryId: categoryId || '',
                accountId: accountId || '',
                keyword: keyword || '',
                selectedYear,
                availableYears,
                reportUrl: '/admin/transactions/report/chronological',
                currentPage: 'transactions'
            });
        } catch (error) {
            console.error('Error generating chronological report:', error);
            res.status(500).render('admin/error', { 
                message: 'Error generating report',
                error: error 
            });
        }
    }

    static async generateReceipt(req: Request, res: Response) {
        try {
            const transactionId = parseInt(req.params.id);
            const transaction = await TransactionsController.transactionsService.getTransactionById(transactionId);
            
            if (!transaction) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Transaction not found' 
                });
            }

            const [siteSettings, yearlyInterestRate] = await Promise.all([
                TransactionsController.siteSettingsService.getAllSettings(),
                TransactionsController.paymentsService.getYearlyInterestRate()
            ]);
            
            // Get category
            const category = await TransactionsController.categoriesService.getCategoryById(transaction.categoryId);
            
            // Get apartment and owner info
            let apartment = null;
            let owner = null;
            let apartmentPayments: any[] = [];
            let allApartmentPayments: any[] = [];
            let unpaidYears: number[] = [];
            let unpaidInvoices: any[] = [];
            let creditInvoices: any[] = [];
            let lastPaidInvoice: any = null;

            let currentPaidInvoices: any[] = [];
            let allCategories: any[] = [];
            
            if (transaction.apartmentId) {
                apartment = await TransactionsController.apartmentsService.getApartmentById(transaction.apartmentId);
                if (apartment) {
                    // Get owner info
                    owner = await TransactionsController.usersService.getUserById(apartment.ownerId);
                    
                    // Get all categories for display
                    allCategories = await TransactionsController.categoriesService.getAllCategories();
                    
                    // Get all invoices for the apartment
                    const InvoicesService = require('../services/invoicesService').InvoicesService;
                    const invoicesService = InvoicesService.getInstance();
                    const apartmentInvoices = await invoicesService.getInvoicesByApartment(apartment.id);
                    
                    // Filter for unpaid and partial invoices (all categories)
                    unpaidInvoices = apartmentInvoices
                        .filter((inv: any) => inv.status === 'unpaid' || inv.status === 'partial')
                        .map((inv: any) => {
                            const invCategory = allCategories.find(c => c.id === inv.categoryId);
                            return {
                                ...inv,
                                categoryName: invCategory ? invCategory.name : 'Unknown',
                                balance: inv.amount - inv.amountPaid
                            };
                        })
                        .sort((a: any, b: any) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
                    
                    // Filter for credits (overpaid invoices where amountPaid > amount)
                    const overpaidInvoices = apartmentInvoices
                        .filter((inv: any) => inv.amountPaid > inv.amount)
                        .map((inv: any) => {
                            const invCategory = allCategories.find(c => c.id === inv.categoryId);
                            return {
                                ...inv,
                                categoryName: invCategory ? invCategory.name : 'Unknown',
                                creditAmount: inv.amountPaid - inv.amount,
                                isUnallocatedCredit: false
                            };
                        });
                    
                    // Get unallocated credits (invoice_transactions with invoice_id = NULL)
                    const InvoiceTransactionsService = require('../services/invoiceTransactionsService').InvoiceTransactionsService;
                    const invoiceTransactionsService = InvoiceTransactionsService.getInstance();
                    const unallocatedCredits = await invoiceTransactionsService.getCreditsByApartmentId(apartment.id);
                    
                    // Map unallocated credits to invoice-like structure for display
                    const unallocatedCreditInvoices = unallocatedCredits.map((credit: any) => ({
                        id: credit.id,
                        apartmentId: credit.apartmentId,
                        categoryId: null,
                        amount: 0,
                        description: 'Unallocated Credit',
                        invoiceDate: credit.createdAt,
                        amountPaid: credit.amount,
                        status: 'paid' as const,
                        categoryName: 'Credit',
                        creditAmount: credit.amount,
                        isUnallocatedCredit: true
                    }));
                    
                    // Combine overpaid invoices and unallocated credits
                    creditInvoices = [...overpaidInvoices, ...unallocatedCreditInvoices]
                        .sort((a: any, b: any) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
                    
                    // Get last paid invoice (most recently paid)
                    const paidInvoices = apartmentInvoices
                        .filter((inv: any) => inv.status === 'paid')
                        .sort((a: any, b: any) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
                    
                    if (paidInvoices.length > 0) {
                        const lastPaid = paidInvoices[0];
                        const invCategory = allCategories.find(c => c.id === lastPaid.categoryId);
                        lastPaidInvoice = {
                            ...lastPaid,
                            categoryName: invCategory ? invCategory.name : 'Unknown'
                        };
                    }
                    
                    // Get invoices paid by THIS transaction
                    // InvoiceTransactionsService is already instantiated above
                    const allocations = await invoiceTransactionsService.getByTransactionId(transaction.id);
                    const paidInvoiceIds = allocations
                        .map((a: any) => a.invoiceId)
                        .filter((id: any): id is number => id !== null);
                        
                    // Fetch full invoice details for paid invoices
                    const currentPaidInvoicesRaw = await Promise.all(
                        paidInvoiceIds.map((id: any) => invoicesService.getInvoiceById(id))
                    );
                    
                    currentPaidInvoices = currentPaidInvoicesRaw
                        .filter((inv: any) => inv !== null)
                        .map((inv: any) => {
                            const invCategory = allCategories.find(c => c.id === inv!.categoryId);
                            const allocation = allocations.find((a: any) => a.invoiceId === inv!.id);
                            return {
                                ...inv,
                                categoryName: invCategory ? invCategory.name : 'Unknown',
                                currentPayment: allocation ? allocation.amount : 0
                            };
                        });
                    
                    // Exclude current paid invoices from unpaid/credit lists to avoid duplicates
                    const currentPaidIds = currentPaidInvoices.map((inv: any) => inv.id);
                    unpaidInvoices = unpaidInvoices.filter((inv: any) => !currentPaidIds.includes(inv.id));
                    creditInvoices = creditInvoices.filter((inv: any) => !currentPaidIds.includes(inv.id));
                    // Get invoices for common expense categories (replaces apartment_payments)
                    if (category && category.name.toLowerCase().includes('common expense')) {
                        // Filter for common expense invoices
                        const commonExpenseInvoices = apartmentInvoices.filter((inv: any) => 
                            inv.categoryId === category.id && inv.year !== null
                        );
                        
                        // Map to payment-like structure for receipt display
                        apartmentPayments = commonExpenseInvoices.map((inv: any) => ({
                            id: inv.id,
                            year: inv.year,
                            totalAmount: inv.amount,
                            amountPaid: inv.amountPaid,
                            status: inv.status,
                            updatedAt: inv.updatedAt
                        }));
                        
                        // Set allApartmentPayments to same as apartmentPayments for receipt view compatibility
                        allApartmentPayments = apartmentPayments;
                        
                        // Find currently unpaid years (for the warning section)
                        unpaidYears = commonExpenseInvoices
                            .filter((inv: any) => inv.status !== 'paid' && inv.year !== null)
                            .map((inv: any) => inv.year!)
                            .sort();
                    }
                }
            } else {
                // For non-apartment transactions, check if a name was provided in query params
                const name = req.query.name as string;
                if (name) {
                    owner = { name: name };
                }
            }
            
            // Calculate receipt number (starting at 517)
            const receiptNumber = 516 + transactionId;

            // Generate URL-friendly filename
            let receiptName = transaction.description || 'Payment';
            if (apartment && owner) {
                receiptName = `Block-${apartment.block}-${apartment.unitNumberOfficial}-${apartment.unitNumberUnofficial}-${owner.name}`;
            } else if (req.query.name) {
                receiptName = req.query.name as string;
            }
            
            // Make URL-friendly: replace spaces with hyphens, remove special chars, lowercase
            const urlFriendlyName = receiptName
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            
            const receiptFilename = `${receiptNumber}-${urlFriendlyName}`;

            res.render('transactions/receipt', {
                title: 'Transaction Receipt',
                transaction,
                category,
                apartment,
                owner,
                siteSettings,
                receiptNumber,
                receiptFilename,
                apartmentPayments,
                allApartmentPayments,
                unpaidYears,
                unpaidInvoices,
                creditInvoices,
                lastPaidInvoice,
                currentPaidInvoices,
                allCategories,
                yearlyInterestRate,
                layout: false // Don't use admin layout for receipt
            });
        } catch (error) {
            console.error('Error generating receipt:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error generating receipt' 
            });
        }
    }

    static async generateReceiptPost(req: Request, res: Response) {
        try {
            const { transactionId, name } = req.body;
            
            if (!transactionId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Transaction ID is required' 
                });
            }

            const transaction = await TransactionsController.transactionsService.getTransactionById(parseInt(transactionId));
            
            if (!transaction) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Transaction not found' 
                });
            }

            // Check if transaction is income type
            if (transaction.type !== 'income') {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Receipts can only be generated for income transactions' 
                });
            }

            // Mark transaction as having receipt generated
            await TransactionsController.transactionsService.updateTransaction(transaction.id, {
                receiptGenerated: true
            });

            // Generate receipt URL with name parameter if provided
            let receiptUrl = `/admin/transactions/${transaction.id}/receipt`;
            if (name) {
                receiptUrl += `?name=${encodeURIComponent(name)}`;
            }

            res.json({
                success: true,
                receiptUrl: receiptUrl,
                message: 'Receipt generated successfully'
            });
        } catch (error) {
            console.error('Error generating receipt:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error generating receipt' 
            });
        }
    }

    static async generateCombinedReceiptPost(req: Request, res: Response) {
        try {
            const { transactionIds } = req.body;
            
            if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Transaction IDs are required' 
                });
            }

            const ownerIds = new Set<number>();
            for (const id of transactionIds) {
                const transaction = await TransactionsController.transactionsService.getTransactionById(parseInt(id));
                if (!transaction) {
                    return res.status(400).json({
                        success: false,
                        message: `Transaction ${id} not found`
                    });
                }
                if (!transaction.apartmentId) {
                    return res.status(400).json({
                        success: false,
                        message: 'All selected transactions must be linked to an apartment with an owner.'
                    });
                }
                const apartment = await TransactionsController.apartmentsService.getApartmentById(transaction.apartmentId);
                if (!apartment) {
                    return res.status(400).json({
                        success: false,
                        message: `Apartment not found for transaction ${id}`
                    });
                }
                ownerIds.add(apartment.ownerId);
            }

            if (ownerIds.size > 1) {
                return res.status(400).json({
                    success: false,
                    message: 'All selected transactions must belong to the same owner.'
                });
            }

            // Mark all transactions as having receipt generated
            for (const id of transactionIds) {
                const transaction = await TransactionsController.transactionsService.getTransactionById(parseInt(id));
                if (transaction && transaction.type === 'income') {
                    await TransactionsController.transactionsService.updateTransaction(transaction.id, {
                        receiptGenerated: true
                    });
                }
            }

            const receiptUrl = `/admin/transactions/combined-receipt?ids=${transactionIds.join(',')}`;

            res.json({
                success: true,
                receiptUrl: receiptUrl,
                message: 'Combined receipt generated successfully'
            });
        } catch (error) {
            console.error('Error generating combined receipt:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error generating combined receipt' 
            });
        }
    }

    static async viewCombinedReceipt(req: Request, res: Response) {
        try {
            const idsStr = req.query.ids as string;
            if (!idsStr) {
                return res.status(400).render('admin/error', { message: 'No transaction IDs provided', error: null });
            }

            const ids = idsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (ids.length === 0) {
                return res.status(400).render('admin/error', { message: 'Invalid transaction IDs', error: null });
            }

            // Fetch all transactions
            const transactions = [];
            for (const id of ids) {
                const tx = await TransactionsController.transactionsService.getTransactionById(id);
                if (tx) transactions.push(tx);
            }

            if (transactions.length === 0) {
                return res.status(404).render('admin/error', { message: 'Transactions not found', error: null });
            }

            // Aggregate transaction data
            const firstTx = transactions[0];
            let totalAmount = 0;
            const descriptions: string[] = [];
            let latestDate = new Date(0);

            transactions.forEach(tx => {
                totalAmount += tx.amount;
                if (tx.description && !descriptions.includes(tx.description)) {
                    descriptions.push(tx.description);
                }
                const txDate = new Date(tx.date);
                if (txDate > latestDate) {
                    latestDate = txDate;
                }
            });

            // Prevent descriptions array from getting too absurdly long on the receipt (which fits max ~1 line)
            let combinedDesc = descriptions.join(' + ');
            if (combinedDesc.length > 100) {
               combinedDesc = combinedDesc.substring(0, 97) + '...';
            }

            const combinedTransaction = {
                id: ids.join('-'),
                amount: totalAmount,
                description: combinedDesc || 'Combined Payment',
                date: latestDate.toISOString(),
                categoryId: firstTx.categoryId,
                apartmentId: firstTx.apartmentId,
                type: 'income',
                accountId: firstTx.accountId,
                createdAt: firstTx.createdAt
            };

            const [siteSettings, yearlyInterestRate] = await Promise.all([
                TransactionsController.siteSettingsService.getAllSettings(),
                TransactionsController.paymentsService.getYearlyInterestRate()
            ]);
            
            // Get category
            const category = await TransactionsController.categoriesService.getCategoryById(firstTx.categoryId);
            
            // Get apartment and owner info (supports multiple apartments for same owner)
            let apartment = null;
            let apartments: any[] = [];
            let owner = null;
            let apartmentPayments: any[] = [];
            let allApartmentPayments: any[] = [];
            let unpaidYears: number[] = [];
            let unpaidInvoices: any[] = [];
            let creditInvoices: any[] = [];
            let lastPaidInvoice: any = null;
            let currentPaidInvoices: any[] = [];
            let allCategories: any[] = [];

            const uniqueApartmentIds = [...new Set(
                transactions
                    .map(tx => tx.apartmentId)
                    .filter((id): id is number => id != null)
            )];

            if (uniqueApartmentIds.length > 0) {
                allCategories = await TransactionsController.categoriesService.getAllCategories();

                const InvoicesService = require('../services/invoicesService').InvoicesService;
                const invoicesService = InvoicesService.getInstance();
                const InvoiceTransactionsService = require('../services/invoiceTransactionsService').InvoiceTransactionsService;
                const invoiceTransactionsService = InvoiceTransactionsService.getInstance();

                let expectedOwnerId: number | null = null;

                for (const apartmentId of uniqueApartmentIds) {
                    const apt = await TransactionsController.apartmentsService.getApartmentById(apartmentId);
                    if (!apt) {
                        continue;
                    }

                    if (expectedOwnerId === null) {
                        expectedOwnerId = apt.ownerId;
                        owner = await TransactionsController.usersService.getUserById(apt.ownerId);
                    } else if (apt.ownerId !== expectedOwnerId) {
                        return res.status(400).render('admin/error', {
                            message: 'All selected transactions must belong to the same owner.',
                            error: null
                        });
                    }

                    apartments.push(apt);
                }

                if (apartments.length === 0) {
                    return res.status(400).render('admin/error', {
                        message: 'No valid apartments found for selected transactions.',
                        error: null
                    });
                }

                apartment = apartments[0];

                const getApartmentLabel = (apt: any) =>
                    `${apt.block}${apt.unitNumberOfficial} (${apt.unitNumberUnofficial})`;

                for (const apt of apartments) {
                    const apartmentLabel = getApartmentLabel(apt);
                    const apartmentInvoices = await invoicesService.getInvoicesByApartment(apt.id);

                    const aptUnpaidInvoices = apartmentInvoices
                        .filter((inv: any) => inv.status === 'unpaid' || inv.status === 'partial')
                        .map((inv: any) => {
                            const invCategory = allCategories.find(c => c.id === inv.categoryId);
                            return {
                                ...inv,
                                categoryName: invCategory ? invCategory.name : 'Unknown',
                                balance: inv.amount - inv.amountPaid,
                                apartmentLabel
                            };
                        });

                    unpaidInvoices = unpaidInvoices.concat(aptUnpaidInvoices);

                    const overpaidInvoices = apartmentInvoices
                        .filter((inv: any) => inv.amountPaid > inv.amount)
                        .map((inv: any) => {
                            const invCategory = allCategories.find(c => c.id === inv.categoryId);
                            return {
                                ...inv,
                                categoryName: invCategory ? invCategory.name : 'Unknown',
                                creditAmount: inv.amountPaid - inv.amount,
                                isUnallocatedCredit: false,
                                apartmentLabel
                            };
                        });

                    const unallocatedCredits = await invoiceTransactionsService.getCreditsByApartmentId(apt.id);
                    const unallocatedCreditInvoices = unallocatedCredits.map((credit: any) => ({
                        id: credit.id,
                        apartmentId: credit.apartmentId,
                        categoryId: null,
                        amount: 0,
                        description: 'Unallocated Credit',
                        invoiceDate: credit.createdAt,
                        amountPaid: credit.amount,
                        status: 'paid' as 'paid',
                        categoryName: 'Credit',
                        creditAmount: credit.amount,
                        isUnallocatedCredit: true,
                        apartmentLabel
                    }));

                    creditInvoices = creditInvoices.concat([...overpaidInvoices, ...unallocatedCreditInvoices]);

                    const paidInvoices = apartmentInvoices
                        .filter((inv: any) => inv.status === 'paid')
                        .sort((a: any, b: any) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());

                    if (paidInvoices.length > 0) {
                        const lastPaid = paidInvoices[0];
                        const invCategory = allCategories.find(c => c.id === lastPaid.categoryId);
                        const candidateLastPaid = {
                            ...lastPaid,
                            categoryName: invCategory ? invCategory.name : 'Unknown',
                            apartmentLabel
                        };

                        if (!lastPaidInvoice || new Date(candidateLastPaid.invoiceDate).getTime() > new Date(lastPaidInvoice.invoiceDate).getTime()) {
                            lastPaidInvoice = candidateLastPaid;
                        }
                    }

                    if (category && category.name.toLowerCase().includes('common expense')) {
                        const commonExpenseInvoices = apartmentInvoices.filter((inv: any) =>
                            inv.categoryId === category.id && inv.year !== null
                        );

                        apartmentPayments = apartmentPayments.concat(commonExpenseInvoices.map((inv: any) => ({
                            id: inv.id,
                            year: inv.year,
                            totalAmount: inv.amount,
                            amountPaid: inv.amountPaid,
                            status: inv.status,
                            updatedAt: inv.updatedAt,
                            apartmentLabel
                        })));

                        unpaidYears = unpaidYears.concat(
                            commonExpenseInvoices
                                .filter((inv: any) => inv.status !== 'paid' && inv.year !== null)
                                .map((inv: any) => inv.year!)
                        );
                    }
                }

                unpaidInvoices.sort((a: any, b: any) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
                creditInvoices.sort((a: any, b: any) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
                unpaidYears = [...new Set(unpaidYears)].sort();
                allApartmentPayments = apartmentPayments;

                // Combine allocations for all transactions
                let allAllocations: any[] = [];
                for (const txId of ids) {
                    const allocations = await invoiceTransactionsService.getByTransactionId(txId);
                    allAllocations = allAllocations.concat(allocations);
                }

                const allocationSums: { [invoiceId: number]: number } = {};
                allAllocations.forEach(a => {
                    if (a.invoiceId !== null) {
                        allocationSums[a.invoiceId] = (allocationSums[a.invoiceId] || 0) + a.amount;
                    }
                });

                const paidInvoiceIds = Object.keys(allocationSums).map(id => parseInt(id));
                const currentPaidInvoicesRaw = await Promise.all(
                    paidInvoiceIds.map(id => invoicesService.getInvoiceById(id))
                );

                currentPaidInvoices = currentPaidInvoicesRaw
                    .filter((inv: any) => inv !== null)
                    .map((inv: any) => {
                        const invCategory = allCategories.find(c => c.id === inv!.categoryId);
                        const invApartment = apartments.find(a => a.id === inv!.apartmentId);
                        return {
                            ...inv,
                            categoryName: invCategory ? invCategory.name : 'Unknown',
                            currentPayment: allocationSums[inv!.id],
                            apartmentLabel: invApartment ? getApartmentLabel(invApartment) : null
                        };
                    });

                const currentPaidIds = currentPaidInvoices.map((inv: any) => inv.id);
                unpaidInvoices = unpaidInvoices.filter((inv: any) => !currentPaidIds.includes(inv.id));
                creditInvoices = creditInvoices.filter((inv: any) => !currentPaidIds.includes(inv.id));
            } else {
                const name = req.query.name as string;
                if (name) {
                    owner = { name: name };
                }
            }
            
            const maxId = Math.max(...ids);
            const receiptNumber = 516 + maxId;

            let receiptName = combinedTransaction.description;
            if (owner) {
                if (apartments.length === 1 && apartment) {
                    receiptName = `Block-${apartment.block}-${apartment.unitNumberOfficial}-${apartment.unitNumberUnofficial}-${owner.name}`;
                } else if (apartments.length > 1) {
                    receiptName = `${owner.name}-Combined`;
                }
            } else if (req.query.name) {
                receiptName = req.query.name as string;
            }
            
            const urlFriendlyName = receiptName
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            
            const receiptFilename = `C${receiptNumber}-${urlFriendlyName}`;

            res.render('transactions/receipt', {
                title: 'Combined Transaction Receipt',
                transaction: combinedTransaction,
                category,
                apartment,
                apartments,
                owner,
                siteSettings,
                receiptNumber,
                receiptFilename,
                apartmentPayments,
                allApartmentPayments,
                unpaidYears,
                unpaidInvoices,
                creditInvoices,
                lastPaidInvoice,
                currentPaidInvoices,
                allCategories,
                yearlyInterestRate,
                layout: false
            });
        } catch (error) {
            console.error('Error generating combined receipt view:', error);
            res.status(500).render('admin/error', { 
                message: 'Error generating combined receipt view',
                error: error
            });
        }
    }
}
