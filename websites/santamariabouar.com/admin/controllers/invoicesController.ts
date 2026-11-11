import { Request, Response } from 'express';
import { InvoicesService } from '../services/invoicesService';
import { ApartmentsService } from '../services/apartmentsService';
import { TransactionCategoriesService } from '../services/transactionCategoriesService';
import { AccountsService } from '../services/accountsService';
import { TransactionsService } from '../services/transactionsService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { PaymentsService } from '../services/paymentsService';
import { ApartmentWalletService } from '../services/apartmentWalletService';
import { UsersService } from '../services/usersService';
import { InvoicePaymentService, InvoicePaymentError } from '../services/invoicePaymentService';

export class InvoicesController {
    private static invoicesService = InvoicesService.getInstance();
    private static apartmentsService = ApartmentsService.getInstance();
    private static categoriesService = TransactionCategoriesService.getInstance();
    private static accountsService = AccountsService.getInstance();
    private static transactionsService = TransactionsService.getInstance();
    private static siteSettingsService = SiteSettingsService.getInstance();
    private static paymentsService = PaymentsService.getInstance();
    private static walletService = ApartmentWalletService.getInstance();
    private static usersService = new UsersService();

    /**
     * List all invoices with filters
     */
    static async invoices(req: Request, res: Response) {
        try {
            const siteTitle = await InvoicesController.siteSettingsService.getSiteTitle();
            const allInvoices = await InvoicesController.invoicesService.getAllInvoices();
            const apartments = await InvoicesController.apartmentsService.getAllApartments();
            const categories = await InvoicesController.categoriesService.getAllCategories();
            const accounts = await InvoicesController.accountsService.getAllAccounts();

            // Get filter parameters (default to unpaid + partial — outstanding invoices)
            const filters = {
                apartmentId: req.query.apartmentId ? parseInt(req.query.apartmentId as string) : undefined,
                categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined,
                status: req.query.status !== undefined
                    ? ((req.query.status as string) || undefined)
                    : 'partial-unpaid',
                block: req.query.block as string || undefined,
                unitNumber: req.query.unitNumber as string || undefined,
                year: req.query.year ? parseInt(req.query.year as string) : undefined,
                searchTerm: req.query.search as string || undefined
            };

            // Enrich invoices with apartment and category data
            const enrichedInvoices = allInvoices.map(invoice => {
                const apartment = apartments.find(a => a.id === invoice.apartmentId);
                const category = categories.find(c => c.id === invoice.categoryId);
                return {
                    ...invoice,
                    apartment: apartment ? {
                        id: apartment.id,
                        block: apartment.block,
                        unitNumberOfficial: apartment.unitNumberOfficial,
                        unitNumberUnofficial: apartment.unitNumberUnofficial,
                        ownerName: apartment.ownerName,
                        renterName: apartment.renterName,
                        tenants: apartment.tenants || []
                    } : null,
                    category: category ? {
                        id: category.id,
                        name: category.name,
                        color: category.color
                    } : null
                };
            });

            // Apply filters
            let filteredInvoices = enrichedInvoices;
            if (filters.apartmentId) {
                filteredInvoices = filteredInvoices.filter(inv => inv.apartmentId === filters.apartmentId);
            }
            if (filters.categoryId) {
                filteredInvoices = filteredInvoices.filter(inv => inv.categoryId === filters.categoryId);
            }
            if (filters.status) {
                if (filters.status === 'partial-unpaid') {
                    filteredInvoices = filteredInvoices.filter(inv =>
                        inv.status === 'unpaid' || inv.status === 'partial'
                    );
                } else {
                    filteredInvoices = filteredInvoices.filter(inv => inv.status === filters.status);
                }
            }
            if (filters.block) {
                filteredInvoices = filteredInvoices.filter(inv => inv.apartment?.block === filters.block);
            }
            if (filters.unitNumber) {
                filteredInvoices = filteredInvoices.filter(inv => inv.apartment?.unitNumberOfficial === filters.unitNumber);
            }
            if (filters.year) {
                filteredInvoices = filteredInvoices.filter(inv => inv.year === filters.year);
            }
            if (filters.searchTerm) {
                const searchLower = filters.searchTerm.toLowerCase();
                filteredInvoices = filteredInvoices.filter(inv => {
                    // Search in description
                    if (inv.description.toLowerCase().includes(searchLower)) return true;
                    
                    // Search in apartment fields
                    if (inv.apartment) {
                        // Search in block
                        if (inv.apartment.block?.toLowerCase().includes(searchLower)) return true;
                        // Search in unit numbers
                        if (inv.apartment.unitNumberOfficial?.toLowerCase().includes(searchLower)) return true;
                        if (inv.apartment.unitNumberUnofficial?.toLowerCase().includes(searchLower)) return true;
                        // Search in owner name
                        if (inv.apartment.ownerName?.toLowerCase().includes(searchLower)) return true;
                        // Search in tenant / renter names and emails
                        if (inv.apartment.renterName?.toLowerCase().includes(searchLower)) return true;
                        const tenants = inv.apartment.tenants || [];
                        if (tenants.some((t: { name?: string; email?: string }) =>
                            t.name?.toLowerCase().includes(searchLower) ||
                            t.email?.toLowerCase().includes(searchLower)
                        )) return true;
                        // Search in full apartment string representation
                        const apartmentString = `Block ${inv.apartment.block} ${inv.apartment.unitNumberOfficial} ${inv.apartment.unitNumberUnofficial}`.toLowerCase();
                        if (apartmentString.includes(searchLower)) return true;
                    }
                    
                    return false;
                });
            }

            // Calculate summary totals
            const summary = {
                totalAmount: filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0),
                totalPaid: filteredInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0),
                totalBalance: filteredInvoices.reduce((sum, inv) => sum + (inv.amount - inv.amountPaid), 0),
                invoiceCount: filteredInvoices.length
            };

            // Sort by Block then Number
            filteredInvoices.sort((a, b) => {
                // First sort by block
                const blockA = a.apartment?.block || '';
                const blockB = b.apartment?.block || '';
                if (blockA < blockB) return -1;
                if (blockA > blockB) return 1;

                // Then sort by unit number (official)
                const numA = a.apartment?.unitNumberOfficial || '';
                const numB = b.apartment?.unitNumberOfficial || '';
                
                // Try numeric sort if both are numbers
                const nA = parseInt(numA);
                const nB = parseInt(numB);
                if (!isNaN(nA) && !isNaN(nB)) {
                    if (nA !== nB) return nA - nB;
                }
                
                // Fallback to string sort
                if (numA < numB) return -1;
                if (numA > numB) return 1;
                
                return 0;
            });

            const availableBlocks = InvoicesController.apartmentsService.getAvailableBlocks();

            res.render('invoices/invoices', {
                title: 'Invoices',
                siteTitle,
                invoices: filteredInvoices,
                apartments,
                categories,
                accounts,
                filters,
                summary,
                availableBlocks,
                success: req.query.success,
                error: req.query.error,
                currentPage: 'invoices'
            });
        } catch (error) {
            console.error('Error fetching invoices:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Show create invoice form
     */
    static async createInvoice(req: Request, res: Response) {
        try {
            const siteTitle = await InvoicesController.siteSettingsService.getSiteTitle();
            const apartments = await InvoicesController.apartmentsService.getAllApartments();
            const categories = await InvoicesController.categoriesService.getAllCategories();
            const accounts = await InvoicesController.accountsService.getAllAccounts();
            
            // Get users for owner names
            const UsersService = require('../services/usersService').UsersService;
            const usersService = new UsersService();
            const users = await usersService.getAllUsers();

            // Pre-select apartment if provided in query
            const apartmentId = req.query.apartmentId ? parseInt(req.query.apartmentId as string) : undefined;

            res.render('invoices/create', {
                title: 'Create Invoice',
                siteTitle,
                apartments,
                categories,
                accounts,
                users,
                apartmentId,
                currentPage: 'invoices'
            });
        } catch (error) {
            console.error('Error loading create invoice form:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Handle invoice creation
     */
    static async createInvoicePost(req: Request, res: Response) {
        try {
            const { apartmentId, categoryId, amount, description, dueDate, invoiceDate, year, notes } = req.body;
            // Get userId from session (try both adminUser.id and userId for compatibility)
            const userId = (req.session as any).adminUser?.id || (req.session as any).userId || null;

            if (!apartmentId || !categoryId || !amount || !invoiceDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }

            const invoice = await InvoicesController.invoicesService.createInvoice({
                apartmentId: parseInt(apartmentId),
                categoryId: parseInt(categoryId),
                amount: parseFloat(amount),
                description: description || '',
                dueDate: dueDate || null,
                invoiceDate: invoiceDate,
                year: year ? parseInt(year) : null,
                notes: notes || null,
                createdBy: userId
            });

            res.json({
                success: true,
                message: 'Invoice created successfully',
                invoice
            });
        } catch (error) {
            console.error('Error creating invoice:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to create invoice'
            });
        }
    }

    /**
     * Show edit invoice form
     */
    static async editInvoice(req: Request, res: Response) {
        try {
            const invoiceId = parseInt(req.params.id);
            const siteTitle = await InvoicesController.siteSettingsService.getSiteTitle();
            const invoice = await InvoicesController.invoicesService.getInvoiceById(invoiceId);
            const apartments = await InvoicesController.apartmentsService.getAllApartments();
            const categories = await InvoicesController.categoriesService.getAllCategories();
            const accounts = await InvoicesController.accountsService.getAllAccounts();
            
            // Get users for owner names
            const UsersService = require('../services/usersService').UsersService;
            const usersService = new UsersService();
            const users = await usersService.getAllUsers();

            if (!invoice) {
                return res.status(404).send('Invoice not found');
            }

            res.render('invoices/edit', {
                title: 'Edit Invoice',
                siteTitle,
                invoice,
                apartments,
                categories,
                accounts,
                users,
                currentPage: 'invoices'
            });
        } catch (error) {
            console.error('Error loading edit invoice form:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Handle invoice update
     */
    static async updateInvoice(req: Request, res: Response) {
        try {
            const invoiceId = parseInt(req.params.id);
            const { apartmentId, categoryId, amount, description, dueDate, invoiceDate, year, notes } = req.body;

            const updateData: any = {};
            if (apartmentId !== undefined) updateData.apartmentId = parseInt(apartmentId);
            if (categoryId !== undefined) updateData.categoryId = parseInt(categoryId);
            if (amount !== undefined) updateData.amount = parseFloat(amount);
            if (description !== undefined) updateData.description = description;
            if (dueDate !== undefined) updateData.dueDate = dueDate || null;
            if (invoiceDate !== undefined) updateData.invoiceDate = invoiceDate;
            if (year !== undefined) updateData.year = year ? parseInt(year) : null;
            if (notes !== undefined) updateData.notes = notes || null;

            const updatedInvoice = await InvoicesController.invoicesService.updateInvoice(invoiceId, updateData);

            if (!updatedInvoice) {
                return res.status(404).json({
                    success: false,
                    message: 'Invoice not found'
                });
            }

            res.json({
                success: true,
                message: 'Invoice updated successfully',
                invoice: updatedInvoice
            });
        } catch (error) {
            console.error('Error updating invoice:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to update invoice'
            });
        }
    }

    /**
     * Handle invoice deletion
     */
    static async deleteInvoice(req: Request, res: Response) {
        try {
            const invoiceId = parseInt(req.params.id);
            const deleted = await InvoicesController.invoicesService.deleteInvoice(invoiceId);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'Invoice not found'
                });
            }

            res.json({
                success: true,
                message: 'Invoice deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting invoice:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to delete invoice'
            });
        }
    }

    /**
     * Show payment form for invoice
     */
    static async payInvoice(req: Request, res: Response) {
        try {
            const invoiceId = parseInt(req.params.id);
            const siteTitle = await InvoicesController.siteSettingsService.getSiteTitle();
            const invoice = await InvoicesController.invoicesService.getInvoiceById(invoiceId);
            const accounts = await InvoicesController.accountsService.getAllAccountsWithBalance();
            const categories = await InvoicesController.categoriesService.getAllCategories();

            if (!invoice) {
                return res.status(404).send('Invoice not found');
            }

            // Get apartment details
            const apartment = await InvoicesController.apartmentsService.getApartmentById(invoice.apartmentId);
            const category = categories.find(c => c.id === invoice.categoryId);
            const walletBalance = await InvoicesController.walletService.getTotalBalance(invoice.apartmentId);
            const balance = Math.max(0, invoice.amount - invoice.amountPaid);

            res.render('invoices/pay', {
                title: 'Pay Invoice',
                siteTitle,
                invoice,
                apartment,
                category,
                accounts,
                walletBalance,
                balance,
                currentPage: 'invoices'
            });
        } catch (error) {
            console.error('Error loading pay invoice form:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Handle invoice payment (creates transaction)
     */
    static async payInvoicePost(req: Request, res: Response) {
        try {
            const invoiceId = parseInt(req.params.id);
            const { amount, walletAmount, date, accountId, description, receiptImage } = req.body;

            const userId = (req.session as any).user?.id || (req.session as any).adminUser?.id || (req.session as any).userId || null;

            const result = await InvoicePaymentService.getInstance().recordPayment({
                invoiceId,
                cashAmount: parseFloat(amount) || 0,
                walletAmount: parseFloat(walletAmount) || 0,
                date,
                accountId: accountId ? parseInt(accountId) : null,
                description,
                receiptImage: receiptImage || null,
                createdBy: userId
            });

            const { transaction, walletAllocated, cashAmount, paymentDate } = result;
            const receiptUrl = InvoicesController.buildPaymentReceiptUrl(invoiceId, {
                walletAmount: walletAllocated,
                cashAmount,
                date: paymentDate,
                transactionId: transaction?.id
            });

            res.json({
                success: true,
                message: result.message,
                transaction,
                walletAllocated,
                receiptUrl,
                transactionReceiptUrl: transaction ? `/admin/transactions/${transaction.id}/receipt` : null
            });
        } catch (error) {
            if (error instanceof InvoicePaymentError) {
                return res.status(error.status).json({ success: false, message: error.message });
            }
            console.error('Error processing invoice payment:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to process payment'
            });
        }
    }

    private static buildPaymentReceiptUrl(
        invoiceId: number,
        params: { walletAmount: number; cashAmount: number; date: string; transactionId?: number }
    ): string {
        const q = new URLSearchParams();
        if (params.walletAmount > 0) {
            q.set('walletAmount', params.walletAmount.toFixed(2));
        }
        if (params.cashAmount > 0) {
            q.set('cashAmount', params.cashAmount.toFixed(2));
        }
        q.set('date', params.date);
        if (params.transactionId) {
            q.set('transactionId', String(params.transactionId));
        }
        return `/admin/invoices/${invoiceId}/payment-receipt?${q.toString()}`;
    }

    /**
     * Printable receipt for invoice payment (wallet and/or cash).
     * Wallet-only payments have no bank transaction — this receipt is the owner acknowledgment.
     */
    static async paymentReceipt(req: Request, res: Response): Promise<void> {
        try {
            const invoiceId = parseInt(req.params.id, 10);

            const InvoiceTransactionsService = require('../services/invoiceTransactionsService').InvoiceTransactionsService;
            const invoiceTransactionsService = InvoiceTransactionsService.getInstance();
            const breakdown = await invoiceTransactionsService.getInvoicePaymentBreakdown(invoiceId);

            let walletAmount = parseFloat(String(req.query.walletAmount || 0)) || 0;
            let cashAmount = parseFloat(String(req.query.cashAmount || 0)) || 0;
            let paymentDate = String(req.query.date || '').trim();
            let transactionId = req.query.transactionId
                ? parseInt(String(req.query.transactionId), 10)
                : undefined;

            const hasQueryAmounts =
                req.query.walletAmount !== undefined ||
                req.query.cashAmount !== undefined;

            if (!hasQueryAmounts && breakdown.totalPaid > 0) {
                walletAmount = breakdown.walletAmount;
                cashAmount = breakdown.cashAmount;
                paymentDate = paymentDate || breakdown.suggestedDate;
                transactionId = transactionId ?? breakdown.cashTransactionId ?? undefined;
            }

            if (!paymentDate) {
                paymentDate = breakdown.suggestedDate || new Date().toISOString().split('T')[0];
            }

            const totalAmount = Math.round((walletAmount + cashAmount) * 100) / 100;
            if (!Number.isFinite(invoiceId) || totalAmount <= 0) {
                res.status(400).send('Invalid receipt parameters');
                return;
            }

            const invoice = await InvoicesController.invoicesService.getInvoiceById(invoiceId);
            if (!invoice) {
                res.status(404).send('Invoice not found');
                return;
            }

            const [siteSettings, yearlyInterestRate] = await Promise.all([
                InvoicesController.siteSettingsService.getAllSettings(),
                InvoicesController.paymentsService.getYearlyInterestRate()
            ]);
            const category = await InvoicesController.categoriesService.getCategoryById(invoice.categoryId);
            const apartment = await InvoicesController.apartmentsService.getApartmentById(invoice.apartmentId);
            const owner = apartment
                ? await InvoicesController.usersService.getUserById(apartment.ownerId)
                : null;

            const allCategories = await InvoicesController.categoriesService.getAllCategories();

            const apartmentInvoices = await InvoicesController.invoicesService.getInvoicesByApartment(invoice.apartmentId);

            const unpaidInvoices = apartmentInvoices
                .filter((inv: any) => inv.status === 'unpaid' || inv.status === 'partial')
                .filter((inv: any) => inv.id !== invoiceId)
                .map((inv: any) => {
                    const invCategory = allCategories.find((c: any) => c.id === inv.categoryId);
                    return {
                        ...inv,
                        categoryName: invCategory ? invCategory.name : 'Unknown',
                        balance: inv.amount - inv.amountPaid
                    };
                })
                .sort((a: any, b: any) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());

            const unallocatedCredits = await invoiceTransactionsService.getCreditsByApartmentId(invoice.apartmentId);
            const creditInvoices = unallocatedCredits.map((credit: any) => ({
                id: credit.id,
                apartmentId: credit.apartmentId,
                categoryId: null,
                amount: 0,
                description: 'Wallet Balance',
                invoiceDate: credit.createdAt,
                amountPaid: credit.amount,
                status: 'paid' as const,
                categoryName: 'Wallet',
                creditAmount: credit.amount,
                isUnallocatedCredit: true
            }));

            const invCategory = allCategories.find((c: any) => c.id === invoice.categoryId);
            const refreshedInvoice = await InvoicesController.invoicesService.getInvoiceById(invoiceId);
            const currentPaidInvoices = [{
                ...refreshedInvoice,
                categoryName: invCategory ? invCategory.name : 'Unknown',
                currentPayment: totalAmount
            }];

            const descParts: string[] = [];
            if (walletAmount > 0) {
                descParts.push(`$${walletAmount.toFixed(2)} from apartment wallet`);
            }
            if (cashAmount > 0) {
                descParts.push(`$${cashAmount.toFixed(2)} cash payment`);
            }

            const syntheticTransaction = {
                id: transactionId || `inv-${invoiceId}`,
                amount: totalAmount,
                type: 'income' as const,
                categoryId: invoice.categoryId,
                description: invoice.description || `Invoice #${invoiceId} payment (${descParts.join(' + ')})`,
                date: paymentDate,
                accountId: 0,
                apartmentId: invoice.apartmentId,
                createdAt: new Date().toISOString()
            };

            const receiptNumber = `W${invoiceId}`;
            let receiptName = syntheticTransaction.description;
            if (apartment && owner) {
                receiptName = `Block-${apartment.block}-${apartment.unitNumberOfficial}-${apartment.unitNumberUnofficial}-${owner.name}`;
            }
            const urlFriendlyName = receiptName
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            const receiptFilename = `${receiptNumber}-${urlFriendlyName}`;

            res.render('transactions/receipt', {
                title: 'Payment Receipt',
                transaction: syntheticTransaction,
                category,
                apartment,
                owner,
                siteSettings,
                receiptNumber,
                receiptFilename,
                apartmentPayments: [],
                allApartmentPayments: [],
                unpaidYears: [],
                unpaidInvoices,
                creditInvoices,
                lastPaidInvoice: null,
                currentPaidInvoices,
                allCategories,
                isWalletPayment: walletAmount > 0,
                walletPaymentAmount: walletAmount,
                cashPaymentAmount: cashAmount,
                cashTransactionId: transactionId || null,
                yearlyInterestRate,
                layout: false
            });
        } catch (error) {
            console.error('Error generating payment receipt:', error);
            res.status(500).send('Error generating receipt');
        }
    }

    /**
     * JSON: payment breakdown for receipt modal (wallet vs cash).
     */
    static async paymentBreakdown(req: Request, res: Response): Promise<Response | void> {
        try {
            const invoiceId = parseInt(req.params.id, 10);
            if (!Number.isFinite(invoiceId)) {
                return res.status(400).json({ success: false, message: 'Invalid invoice' });
            }

            const invoice = await InvoicesController.invoicesService.getInvoiceById(invoiceId);
            if (!invoice) {
                return res.status(404).json({ success: false, message: 'Invoice not found' });
            }

            const InvoiceTransactionsService = require('../services/invoiceTransactionsService').InvoiceTransactionsService;
            const breakdown = await InvoiceTransactionsService.getInstance().getInvoicePaymentBreakdown(invoiceId);

            res.json({
                success: true,
                invoice: {
                    id: invoice.id,
                    description: invoice.description,
                    amount: invoice.amount,
                    amountPaid: invoice.amountPaid,
                    balance: Math.max(0, invoice.amount - invoice.amountPaid)
                },
                breakdown
            });
        } catch (error) {
            console.error('Error fetching payment breakdown:', error);
            res.status(500).json({ success: false, message: 'Failed to load payment details' });
        }
    }
}

