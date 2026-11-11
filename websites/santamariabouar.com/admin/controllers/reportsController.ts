
import { Request, Response } from 'express';
import { db } from '../../src/config/database';
import { SiteSettingsService } from '../services/siteSettingsService';
import { TransactionsService } from '../services/transactionsService';
import { AccountsService } from '../services/accountsService';
import { TransactionCategoriesService } from '../services/transactionCategoriesService';
import { ApartmentsService } from '../services/apartmentsService';
import { usersService, User } from '../services/usersService';
import { InvoicesService } from '../services/invoicesService';
import { InvoiceTransactionsService } from '../services/invoiceTransactionsService';
import { PaymentsService } from '../services/paymentsService';
import {
  isHiddenFromReports,
  isTransferTransaction,
  isWalletAdjustmentTransaction
} from '../services/transactionReportFilters';
import { notifyOwnerOfInvoicePayment } from '../../src/services/emailService';

// Interfaces
interface CommonExpensesData {
  payment: {
    id: number;
    apartmentId: number;
    year: number;
    totalAmount: number;
    amountPaid: number;
    status: 'paid' | 'partial' | 'unpaid';
    pricePerM2: number;
    startDate?: string;
    apartmentData?: any;
  };
  invoice?: any;
  apartment: any;
  owner: any;
  category?: any;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  outstandingAmount: number;
}

export class ReportsController {
  private static siteSettingsService = SiteSettingsService.getInstance();
  private static transactionsService = TransactionsService.getInstance();
  private static accountsService = AccountsService.getInstance();
  private static categoriesService = TransactionCategoriesService.getInstance();
  private static apartmentsService = ApartmentsService.getInstance();
  private static usersService = usersService;
  private static invoicesService = InvoicesService.getInstance();
  private static invoiceTransactionsService = InvoiceTransactionsService.getInstance();
  private static paymentsService = PaymentsService.getInstance();

  /**
   * Transactions by Category Report
   */
  static async transactionsByCategory(req: Request, res: Response) {
    try {
      const siteTitle = await ReportsController.siteSettingsService.getSiteTitle();
      const currentYear = new Date().getFullYear();
      if (req.query.year === undefined) {
        req.query.year = String(currentYear);
      }
      const selectedYear = req.query.year as string;
      let availableYears = await ReportsController.transactionsService.getAvailableYears();
      if (!availableYears.includes(currentYear)) {
        availableYears = [currentYear, ...availableYears].sort((a, b) => b - a);
      }

      const transactions = await ReportsController.getFilteredTransactions(req);
      
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
          .filter((t: any) => t.type === 'income')
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        const expense = categoryTransactions
          .filter((t: any) => t.type === 'expense')
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        
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
        reportUrl: '/admin/reports/transactions-by-category',
        currentPage: 'reports' // Updated current page
      });
    } catch (error) {
      console.error('Error generating category report:', error);
      res.status(500).render('admin/error', { 
        message: 'Error generating report',
        error: error 
      });
    }
  }

  /**
   * Chronological Transactions Report
   */
  static async transactionsChronological(req: Request, res: Response) {
    try {
      const siteTitle = await ReportsController.siteSettingsService.getSiteTitle();
      const currentYear = new Date().getFullYear();
      if (req.query.year === undefined) {
        req.query.year = String(currentYear);
      }
      const selectedYear = req.query.year as string;
      let availableYears = await ReportsController.transactionsService.getAvailableYears();
      if (!availableYears.includes(currentYear)) {
        availableYears = [currentYear, ...availableYears].sort((a, b) => b - a);
      }

      const allTransactions = await ReportsController.getFilteredTransactions(req);
      
      // Calculate summary INCLUDING transfers (to match accounts page total)
      const totalIncome = allTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalExpenses = allTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      const balance = totalIncome - totalExpenses;

      // Filter OUT transfers and wallet adjustments for display only (keep balance calculation accurate)
      const transactionsForDisplay = allTransactions.filter((t: any) => !isHiddenFromReports(t));
      
      // Sort transactions chronologically (newest first)
      const sortedTransactions = transactionsForDisplay.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // Get filter parameters for display
      const fromDate = req.query.fromDate as string | undefined;
      const toDate = req.query.toDate as string | undefined;
      const type = req.query.type as string | undefined;
      const categoryId = req.query.categoryId as string | undefined;
      const accountId = req.query.accountId as string | undefined;
      const keyword = req.query.keyword as string | undefined;

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
        reportUrl: '/admin/reports/transactions-chronological',
        currentPage: 'reports' // Updated current page
      });
    } catch (error) {
      console.error('Error generating chronological report:', error);
      res.status(500).render('admin/error', { 
        message: 'Error generating report',
        error: error 
      });
    }
  }

  /**
   * Unpaid Common Expenses Report
   */
  public static async unpaidCommonExpenses(req: Request, res: Response): Promise<void> {
    try {
      // Get filter parameters
      // Default to 'partial-unpaid' to show both partial and unpaid payments (all outstanding)
      const filters: any = {
        year: req.query.year ? parseInt(req.query.year as string) : undefined,
        block: req.query.block as string || undefined,
        ownerId: req.query.ownerId ? parseInt(req.query.ownerId as string) : undefined,
        paymentStatus: (req.query.paymentStatus as any) || 'partial-unpaid',
        searchTerm: req.query.search as string || undefined
      };
      
      // Get all data
      const apartments = await ReportsController.apartmentsService.getAllApartments();
      const users = await ReportsController.usersService.getAllUsers();
      const categories = await ReportsController.categoriesService.getAllCategories();
      
      // Get unpaid invoices (status computed on-the-fly from invoice_transactions)
      const invoiceFilters: any = {};
      if (filters.year) invoiceFilters.year = filters.year;
      if (filters.block) invoiceFilters.block = filters.block;
      if (filters.searchTerm) invoiceFilters.searchTerm = filters.searchTerm;
      
      const unpaidInvoices = await ReportsController.invoicesService.getUnpaidInvoices(invoiceFilters);
      
      // Don't filter by category - show all unpaid invoices from all categories
      let filteredInvoices = unpaidInvoices;
      
      // Filter by ownerId if specified
      if (filters.ownerId) {
        const apartmentIdsForOwner = apartments
          .filter(apt => apt.ownerId === filters.ownerId)
          .map(apt => apt.id);
        filteredInvoices = filteredInvoices.filter(inv => apartmentIdsForOwner.includes(inv.apartmentId));
      }
      
      // Ensure all apartments referenced are loaded
      const invoiceApartmentIds = new Set(filteredInvoices.map(inv => inv.apartmentId));
      const allApartmentIds = new Set([...invoiceApartmentIds]);
      const loadedApartmentIds = new Set(apartments.map(a => a.id));
      const missingApartmentIds = Array.from(allApartmentIds).filter(id => !loadedApartmentIds.has(id));
      
      // Fetch missing apartments
      if (missingApartmentIds.length > 0) {
        const missingApartments = await Promise.all(
          missingApartmentIds.map(id => ReportsController.apartmentsService.getApartmentById(id))
        );
        const validMissingApartments = missingApartments.filter(apt => apt !== undefined) as any[];
        apartments.push(...validMissingApartments);
      }
      
      // Build report data from invoices only
      const reportData = ReportsController.buildReportDataFromInvoices(filteredInvoices, apartments, users, categories);
      
      // Filter for unpaid/partial payments only (already filtered in getUnpaidInvoices, but double-check)
      // Exclude credits: items where amountPaid >= amount (fully paid or overpaid)
      // Also exclude items with outstandingAmount <= 0 or negative amounts
      const unpaidData = reportData.filter(item => {
        const invoiceAmount = item.payment.totalAmount || item.invoice.amount || 0;
        const amountPaid = item.payment.amountPaid || item.invoice.amountPaid || 0;
        const outstanding = item.outstandingAmount || (invoiceAmount - amountPaid);
        
        // Exclude credits (overpaid invoices) - where amountPaid >= amount
        if (amountPaid >= invoiceAmount) {
          return false;
        }
        // Exclude negative or zero invoice amounts (invalid invoices)
        if (invoiceAmount <= 0) {
          return false;
        }
        // Exclude negative outstanding amounts (shouldn't happen, but filter just in case)
        if (outstanding <= 0) {
          return false;
        }
      
        // Only include unpaid or partial with positive outstanding amount
        return (item.paymentStatus === 'unpaid' || item.paymentStatus === 'partial') &&
               outstanding > 0;
      });
      
    // Calculate summary
    const summary = ReportsController.calculateUnpaidSummary(unpaidData);
    
    // Group data by block
    // Filter to exclude credits (outstanding <= 0)
    const groupedData = ReportsController.groupUnpaidDataByBlock(unpaidData, 0.01);
    await ReportsController.attachApartmentContacts(groupedData, apartments, users);
    const blockTotals = ReportsController.calculateBlockTotals(groupedData);

    // Filter available years for dropdown
    const availableYears = await ReportsController.invoicesService.getAvailableYears();
    const settings = await ReportsController.siteSettingsService.getAllSettings();
    const yearlyInterestRate = await ReportsController.paymentsService.getYearlyInterestRate();

    // Render report
    res.render('common-expenses/unpaid-report', {

      siteTitle: settings.siteTitle,
      pageTitle: 'Unpaid Common Expenses Report',
      pageSubtitle: `Report generated for ${filters.year ? `Year ${filters.year}` : 'All Years'}`,
      reportDate: new Date().toLocaleDateString(),
      user: (req.session as any).user,
      groupedData,
      blockTotals,
      summary,
      filters,
      availableYears,
      yearlyInterestRate,
      paymentInstructions: {
        janitorName: settings.janitorName || '',
        janitorPhone: settings.janitorPhone || '',
        whishEnabled: Boolean(settings.payments && settings.payments.whishEnabled),
        whishDetails: (settings.payments && settings.payments.whishDetails) || '',
        omtEnabled: Boolean(settings.payments && settings.payments.omtEnabled),
        omtDetails: (settings.payments && settings.payments.omtDetails) || '',
        bankTransferEnabled: Boolean(settings.payments && settings.payments.bankTransferEnabled),
        bankInfo: (settings.payments && settings.payments.bankInfo) || '',
        yearlyInterestRate
      },
      showBreadcrumb: false,
      showPageHeader: false // Report has its own title block
    });
  } catch (error) {
    console.error('Error generating unpaid report:', error);
    res.status(500).render('admin/error', { 
      message: 'Error generating report',
      error: error
    });
  }
}

  /**
   * Credits Report
   * Shows apartments that have unallocated payments stored in invoice_transactions where invoice_id IS NULL
   * AND Credit - Owner transactions that still have amount not yet applied to invoices (via invoice_transactions).
   */
  public static async creditsReport(req: Request, res: Response): Promise<void> {
    try {
      const filters: any = {
        block: req.query.block as string || undefined,
        searchTerm: req.query.search as string || undefined
      };

      const [apartments, users, allCredits, creditOwnerTxns] = await Promise.all([
        ReportsController.apartmentsService.getAllApartments(),
        ReportsController.usersService.getAllUsers(),
        ReportsController.invoiceTransactionsService.getAllCredits(
          filters.block ? { block: filters.block } : undefined
        ),
        ReportsController.transactionsService.getCreditOwnerTransactions(
          filters.block ? { block: filters.block } : undefined
        )
      ]);

      // Apply search filter to unallocated credits
      let credits = allCredits;
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        credits = credits.filter((credit: any) => {
          const apt = apartments.find((a: any) => a.id === credit.apartmentId);
          const owner = users.find((u: any) => u.id === apt?.ownerId);
          return (
            (apt?.block || '').toLowerCase().includes(term) ||
            String(apt?.unitNumberOfficial || '').toLowerCase().includes(term) ||
            (owner?.name || '').toLowerCase().includes(term)
          );
        });
      }

      // Apply search filter to credit-owner transactions
      let filteredCreditOwnerTxns = creditOwnerTxns;
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        filteredCreditOwnerTxns = creditOwnerTxns.filter((txn: any) => {
          const apt = apartments.find((a: any) => a.id === txn.apartmentId);
          const owner = users.find((u: any) => u.id === apt?.ownerId);
          return (
            (apt?.block || '').toLowerCase().includes(term) ||
            String(apt?.unitNumberOfficial || '').toLowerCase().includes(term) ||
            (owner?.name || '').toLowerCase().includes(term) ||
            (txn.description || '').toLowerCase().includes(term)
          );
        });
      }

      const round2 = (n: number) => Math.round(n * 100) / 100;
      const ownerTxnIds = filteredCreditOwnerTxns.map((t: any) => t.id);
      const linkedByTxn = await ReportsController.invoiceTransactionsService.getTotalLinkedAmountsByTransactionIds(ownerTxnIds);
      filteredCreditOwnerTxns.forEach((t: any) => {
        const linked = linkedByTxn.get(t.id) || 0;
        t.allocatableAmount = round2(Math.max(0, t.amount - linked));
      });

      // Hide Credit - Owner rows that are fully applied to invoices (nothing left to allocate)
      const eps = 0.01;
      filteredCreditOwnerTxns = filteredCreditOwnerTxns.filter((t: any) => t.allocatableAmount > eps);

      // Build grouped structure: block -> apartment -> { credits[], creditOwnerTxns[], totals }
      const grouped: any = {};

      // Merge unallocated invoice credits
      credits.forEach((credit: any) => {
        const apt = apartments.find((a: any) => a.id === credit.apartmentId);
        const block = apt?.block || 'Unknown';
        const aptId = credit.apartmentId;

        if (!grouped[block]) grouped[block] = {};
        if (!grouped[block][aptId]) {
          const owner = users.find((u: any) => u.id === apt?.ownerId);
          grouped[block][aptId] = {
            apartment: apt || { id: aptId, block, unitNumberOfficial: `Apt ${aptId}` },
            owner,
            credits: [],
            creditOwnerTxns: [],
            totalCredit: 0,
            totalCreditOwner: 0
          };
        }
        grouped[block][aptId].credits.push(credit);
        grouped[block][aptId].totalCredit += credit.amount;
      });

      // Merge Credit-Owner transactions
      filteredCreditOwnerTxns.forEach((txn: any) => {
        const apt = apartments.find((a: any) => a.id === txn.apartmentId);
        const block = txn.apartmentId ? (apt?.block || 'Unknown') : 'Unassigned';
        const aptId = txn.apartmentId || 'unassigned';

        if (!grouped[block]) grouped[block] = {};
        if (!grouped[block][aptId]) {
          const owner = txn.apartmentId ? users.find((u: any) => u.id === apt?.ownerId) : null;
          grouped[block][aptId] = {
            apartment: apt || { id: aptId, block, unitNumberOfficial: txn.apartmentId ? `Apt ${aptId}` : '—' },
            owner,
            credits: [],
            creditOwnerTxns: [],
            totalCredit: 0,
            totalCreditOwner: 0
          };
        }
        grouped[block][aptId].creditOwnerTxns.push(txn);
        grouped[block][aptId].totalCreditOwner += txn.allocatableAmount;
      });

      // Block totals
      const blockTotals: any = {};
      Object.keys(grouped).forEach(block => {
        let blockTotal = 0;
        let blockCreditOwnerTotal = 0;
        let aptCount = 0;
        Object.values(grouped[block]).forEach((aptData: any) => {
          blockTotal += aptData.totalCredit;
          blockCreditOwnerTotal += aptData.totalCreditOwner;
          aptCount++;
        });
        blockTotals[block] = {
          totalCredit: blockTotal,
          totalCreditOwner: blockCreditOwnerTotal,
          totalCombined: blockTotal + blockCreditOwnerTotal,
          apartmentCount: aptCount
        };
      });

      const totalCredit = credits.reduce((s: number, c: any) => s + c.amount, 0);
      const totalCreditOwner = filteredCreditOwnerTxns.reduce((s: number, t: any) => s + t.allocatableAmount, 0);
      const totalApartments = new Set([
        ...credits.map((c: any) => c.apartmentId),
        ...filteredCreditOwnerTxns.filter((t: any) => t.apartmentId).map((t: any) => t.apartmentId)
      ]).size;
      const totalBlocks = Object.keys(grouped).length;

      const apartmentsForSelect = apartments
        .map((a: any) => {
          const ownerUser = users.find((u: any) => u.id === a.ownerId);
          const ownerName = String(ownerUser?.name || a.ownerName || '').trim();
          const unitPart = `Block ${a.block || '?'} – ${a.unitNumberOfficial ?? a.id}${a.unitNumberUnofficial ? ` (${a.unitNumberUnofficial})` : ''}`;
          const label = ownerName ? `${unitPart} | ${ownerName}` : unitPart;
          return { id: a.id, label };
        })
        .sort((a: any, b: any) => a.label.localeCompare(b.label));

      res.render('common-expenses/credits-report', {
        siteTitle: await ReportsController.siteSettingsService.getSiteTitle(),
        pageTitle: 'Apartment Wallets Report',
        pageSubtitle: 'Unallocated wallet balances and Credit - Owner amounts available to settle invoices',
        reportDate: new Date().toLocaleDateString(),
        user: (req.session as any).user,
        groupedData: grouped,
        blockTotals,
        apartmentsForSelect,
        summary: {
          totalCredit,
          totalCreditOwner,
          totalCombined: totalCredit + totalCreditOwner,
          totalApartments,
          totalBlocks,
          creditsCount: credits.length,
          creditOwnerCount: filteredCreditOwnerTxns.length
        },
        filters,
        showBreadcrumb: false,
        showPageHeader: false
      });
    } catch (error) {
      console.error('Error generating credits report:', error);
      res.status(500).render('admin/error', {
        message: 'Error generating credits report',
        error: error
      });
    }
  }

  /**
   * JSON: invoices for an apartment with outstanding balance (for applying unallocated credits).
   */
  public static async creditsReportApartmentInvoices(req: Request, res: Response): Promise<void> {
    try {
      const apartmentId = parseInt(req.params.apartmentId, 10);
      if (!Number.isFinite(apartmentId) || apartmentId < 1) {
        res.status(400).json({ success: false, message: 'Invalid apartment' });
        return;
      }
      const invoices = await ReportsController.invoicesService.getInvoicesByApartment(apartmentId);
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const list = invoices
        .map(inv => ({
          id: inv.id,
          description: inv.description,
          invoiceDate: inv.invoiceDate,
          year: inv.year,
          amount: inv.amount,
          amountPaid: inv.amountPaid,
          outstanding: round2(Math.max(0, inv.amount - inv.amountPaid)),
          status: inv.status
        }))
        .filter(x => x.outstanding > 0.001);
      res.json({ success: true, invoices: list });
    } catch (error) {
      console.error('creditsReportApartmentInvoices:', error);
      res.status(500).json({ success: false, message: 'Failed to load invoices' });
    }
  }

  /**
   * POST: apply an unallocated invoice_transactions credit row to a common-expense invoice.
   */
  public static async creditsReportAllocateCredit(req: Request, res: Response): Promise<void> {
    try {
      const creditId = parseInt(String(req.body?.creditId), 10);
      const invoiceId = parseInt(String(req.body?.invoiceId), 10);
      const amountRaw = req.body?.amount;
      if (!Number.isFinite(creditId) || !Number.isFinite(invoiceId)) {
        res.status(400).json({ success: false, message: 'creditId and invoiceId are required' });
        return;
      }
      let amount: number | undefined;
      if (amountRaw !== undefined && amountRaw !== null && String(amountRaw).trim() !== '') {
        amount = parseFloat(String(amountRaw));
        if (Number.isNaN(amount) || amount <= 0) {
          res.status(400).json({ success: false, message: 'Invalid amount' });
          return;
        }
      }
      const result = await ReportsController.invoiceTransactionsService.allocateUnallocatedCreditToInvoice(
        creditId,
        invoiceId,
        amount
      );
      if (result.allocated > 0) {
        void notifyOwnerOfInvoicePayment({
          invoiceId,
          cashAmount: 0,
          walletAmount: result.allocated,
          paymentDate: new Date().toISOString().split('T')[0]
        });
      }
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('creditsReportAllocateCredit:', error);
      res.status(400).json({
        success: false,
        message: error?.message || 'Allocation failed'
      });
    }
  }

  /**
   * POST: apply a Credit - Owner transaction (already tied to an apartment) toward an invoice.
   */
  public static async creditsReportAllocateCreditOwner(req: Request, res: Response): Promise<void> {
    try {
      const transactionId = parseInt(String(req.body?.transactionId), 10);
      const invoiceId = parseInt(String(req.body?.invoiceId), 10);
      const amountRaw = req.body?.amount;
      if (!Number.isFinite(transactionId) || !Number.isFinite(invoiceId)) {
        res.status(400).json({ success: false, message: 'transactionId and invoiceId are required' });
        return;
      }
      let amount: number | undefined;
      if (amountRaw !== undefined && amountRaw !== null && String(amountRaw).trim() !== '') {
        amount = parseFloat(String(amountRaw));
        if (Number.isNaN(amount) || amount <= 0) {
          res.status(400).json({ success: false, message: 'Invalid amount' });
          return;
        }
      }
      const result = await ReportsController.invoiceTransactionsService.allocateCreditOwnerTransactionToInvoice(
        transactionId,
        invoiceId,
        amount
      );
      if (result.allocated > 0) {
        void notifyOwnerOfInvoicePayment({
          invoiceId,
          cashAmount: result.allocated,
          walletAmount: 0,
          paymentDate: new Date().toISOString().split('T')[0]
        });
      }
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('creditsReportAllocateCreditOwner:', error);
      res.status(400).json({
        success: false,
        message: error?.message || 'Allocation failed'
      });
    }
  }

  /**
   * POST: assign apartment to a Credit - Owner transaction that has no apartment yet.
   */
  public static async creditsReportAssignOwnerApartment(req: Request, res: Response): Promise<void> {
    try {
      const transactionId = parseInt(String(req.body?.transactionId), 10);
      const apartmentId = parseInt(String(req.body?.apartmentId), 10);
      if (!Number.isFinite(transactionId) || !Number.isFinite(apartmentId)) {
        res.status(400).json({ success: false, message: 'transactionId and apartmentId are required' });
        return;
      }

      const txn = await ReportsController.transactionsService.getTransactionById(transactionId);
      if (!txn) {
        res.status(404).json({ success: false, message: 'Transaction not found' });
        return;
      }

      const categories = await ReportsController.categoriesService.getAllCategories();
      const cat = categories.find(c => c.id === txn.categoryId);
      if (cat?.name !== 'Credit - Owner') {
        res.status(400).json({ success: false, message: 'Only Credit - Owner transactions can be assigned here' });
        return;
      }
      if (txn.apartmentId != null) {
        res.status(400).json({ success: false, message: 'This transaction already has an apartment' });
        return;
      }

      const apt = await ReportsController.apartmentsService.getApartmentById(apartmentId);
      if (!apt) {
        res.status(404).json({ success: false, message: 'Apartment not found' });
        return;
      }

      const updated = await ReportsController.transactionsService.updateTransaction(transactionId, {
        apartmentId
      });
      if (!updated) {
        res.status(500).json({ success: false, message: 'Could not update transaction' });
        return;
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('creditsReportAssignOwnerApartment:', error);
      res.status(500).json({
        success: false,
        message: error?.message || 'Assignment failed'
      });
    }
  }


  // --- Helpers ---


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

    // Fetch transactions based on date range
    let transactions;
    if (fromDate && toDate) {
      transactions = await ReportsController.transactionsService.getTransactionsByDateRange(fromDate, toDate);
    } else if (fromDate) {
      // Only fromDate provided - get all transactions from that date onwards
      const today = new Date().toISOString().split('T')[0];
      transactions = await ReportsController.transactionsService.getTransactionsByDateRange(fromDate, today);
    } else if (toDate) {
      // Only toDate provided - get all transactions up to that date
      const earliestDate = '2000-01-01'; // A reasonable earliest date
      transactions = await ReportsController.transactionsService.getTransactionsByDateRange(earliestDate, toDate);
    } else {
      transactions = await ReportsController.transactionsService.getAllTransactions();
    }

    const accounts = await ReportsController.accountsService.getAllAccounts();
    const categories = await ReportsController.categoriesService.getAllCategories();
    const apartments = await ReportsController.apartmentsService.getAllApartments();
    const users = await ReportsController.usersService.getAllUsers();

      // Enrich transactions with related data
    let enrichedTransactions = transactions.map((transaction: any) => {
      const account = accounts.find(w => w.id === transaction.accountId);
      const category = categories.find(c => c.id === transaction.categoryId);
      const apartment = transaction.apartmentId ? apartments.find((a: any) => a.id === transaction.apartmentId) : null;
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
        enrichedTransactions = enrichedTransactions.filter((t: any) => isTransferTransaction(t));
      } else if (type === 'wallet_adjustment') {
        enrichedTransactions = enrichedTransactions.filter((t: any) => isWalletAdjustmentTransaction(t));
      } else {
        // When a specific type is selected (income/expense), exclude transfers and wallet adjustments
        enrichedTransactions = enrichedTransactions.filter((t: any) => 
          t.type === type && !isHiddenFromReports(t)
        );
      }
    }
    // Note: When no type filter is specified, we now INCLUDE transfers and wallet adjustments
    // in the results. Individual report methods filter them out for display if needed.

    if (categoryId && categoryId !== '') {
      enrichedTransactions = enrichedTransactions.filter((t: any) => t.categoryId === parseInt(categoryId));
    }

    if (accountId && accountId !== '') {
      enrichedTransactions = enrichedTransactions.filter((t: any) => t.accountId === parseInt(accountId));
    }

    if (keyword && keyword !== '') {
      const keywordLower = keyword.toLowerCase();
      enrichedTransactions = enrichedTransactions.filter((t: any) => 
        t.description.toLowerCase().includes(keywordLower) ||
        (t.apartmentNumber && t.apartmentNumber.toLowerCase().includes(keywordLower)) ||
        (t.apartmentOwnerName && t.apartmentOwnerName.toLowerCase().includes(keywordLower))
      );
    }

    return enrichedTransactions;
  }

  /**
   * Build report data from invoices with apartment and owner information
   */
  private static buildReportDataFromInvoices(invoices: any[], apartments: any[], users: any[], categories: any[] = []): CommonExpensesData[] {
    return invoices
      .filter(invoice => {
        // Filter out credits and invalid invoices at the source
        const invoiceAmount = parseFloat(invoice.amount || 0);
        const amountPaid = parseFloat(invoice.amountPaid || 0);
        
        // Exclude invoices with negative or zero amounts
        if (invoiceAmount <= 0) {
          return false;
        }
        
        // Exclude credits (where amountPaid >= amount)
        if (amountPaid >= invoiceAmount) {
          return false;
        }
        
        // Exclude invoices with negative outstanding amounts
        const outstanding = invoiceAmount - amountPaid;
        if (outstanding <= 0) {
          return false;
        }
        
        return true;
      })
      .map(invoice => {
        // Handle type coercion for apartment ID matching (number vs string)
        let apartment = apartments.find(apt => 
          apt.id === invoice.apartmentId || 
          String(apt.id) === String(invoice.apartmentId) ||
          Number(apt.id) === Number(invoice.apartmentId)
        );
        
        const owner = users.find(user => user.id === apartment?.ownerId);
        const category = categories.find(cat => cat.id === invoice.categoryId);
        
        const outstandingAmount = invoice.amount - invoice.amountPaid;
        
        // Calculate status based on amounts (not just invoice.status)
        let paymentStatus: 'paid' | 'partial' | 'unpaid';
        if (invoice.amountPaid >= invoice.amount) {
          paymentStatus = 'paid';
        } else if (invoice.amountPaid > 0) {
          paymentStatus = 'partial';
        } else {
          paymentStatus = 'unpaid';
        }
        
        return {
          payment: {
            // Map invoice fields to payment-like structure for compatibility
            id: invoice.id,
            apartmentId: invoice.apartmentId,
            year: invoice.year,
            totalAmount: invoice.amount,
            amountPaid: invoice.amountPaid,
            status: paymentStatus, // Use calculated status
            pricePerM2: 0, // Not applicable for invoices
            startDate: invoice.invoiceDate
          },
          invoice: invoice,
          apartment,
          owner,
          category, // Add category to report data
          paymentStatus,
          outstandingAmount
        };
      });
  }

  /**
   * Group unpaid data by block, apartment, and year
   */
  private static groupUnpaidDataByBlock(data: CommonExpensesData[], outstandingLessThan: number = 0): any {
    const grouped: any = {};
    
    data.forEach(item => {
      // Skip items with outstanding amounts <= 0 (fully paid or overpaid/credits)
      // If threshold is 0, filter out items with outstandingAmount <= 0
      if (item.outstandingAmount <= outstandingLessThan) {
        return;
      }
      
      // Determine block - use apartment block if available, or from payment's apartmentData (from JOIN), otherwise 'Unknown'
      let block = item.apartment?.block || (item.payment as any).apartmentData?.block;
      if (!block) {
        block = 'Unknown';
      }
      
      // Use payment's apartmentId if apartment record is not found to avoid grouping different apartments together
      const apartmentId = item.apartment?.id || item.payment.apartmentId || 'Unknown';
      const year = item.payment.year;
      
      if (!grouped[block]) {
        grouped[block] = {};
      }
      
      if (!grouped[block][apartmentId]) {
        // Create a minimal apartment object if apartment data is missing
        const apartmentData = item.apartment || {
          id: item.payment.apartmentId,
          block: block,
          unitNumberOfficial: `Apartment ${item.payment.apartmentId}`,
          unitNumberUnofficial: null,
          areaInM2: 0,
          ownerId: null
        };
        
        grouped[block][apartmentId] = {
          apartment: apartmentData,
          owner: item.owner,
          payments: []
        };
      }
      
      grouped[block][apartmentId].payments.push({
        year,
        payment: item.payment,
        outstandingAmount: item.outstandingAmount,
        paymentStatus: item.paymentStatus,
        category: item.category // Include category information
      });
    });
    
    return grouped;
  }

  /**
   * Attach owners and tenants (with phones) to each apartment group for WhatsApp.
   */
  private static async attachApartmentContacts(
    groupedData: any,
    apartments: any[],
    users: any[]
  ): Promise<void> {
    const apartmentIds: number[] = [];
    Object.keys(groupedData).forEach((block) => {
      Object.keys(groupedData[block]).forEach((apartmentId) => {
        const id = Number(apartmentId);
        if (Number.isFinite(id) && id > 0) {
          apartmentIds.push(id);
        }
      });
    });

    const usersByApt = await ReportsController.apartmentsService.listApartmentUsersByApartmentIds(
      apartmentIds
    );

    const toContact = (member: {
      userId: number;
      name: string;
      phone?: string;
      role: 'owner' | 'tenant';
      isPrimary?: boolean;
    }) => ({
      userId: member.userId,
      name: member.name || (member.role === 'tenant' ? 'Tenant' : 'Owner'),
      phone: member.phone || '',
      role: member.role,
      isPrimary: Boolean(member.isPrimary)
    });

    Object.keys(groupedData).forEach((block) => {
      Object.keys(groupedData[block]).forEach((apartmentId) => {
        const group = groupedData[block][apartmentId];
        const apt = group.apartment || {};
        const members = usersByApt.get(Number(apartmentId)) || [];
        let tenants = members.filter((m) => m.role === 'tenant').map(toContact);
        let owners = members.filter((m) => m.role === 'owner').map(toContact);

        if (tenants.length === 0 && owners.length === 0) {
          const renterUser = users.find(
            (u: any) => u.id === apt.renterId || Number(u.id) === Number(apt.renterId)
          );
          if (apt.renterId || apt.renterName || apt.renterPhone || renterUser) {
            tenants.push(
              toContact({
                userId: apt.renterId || renterUser?.id || 0,
                name: renterUser?.name || apt.renterName || 'Tenant',
                phone: renterUser?.phone || apt.renterPhone,
                role: 'tenant',
                isPrimary: false
              })
            );
          }

          const ownerUser =
            group.owner ||
            users.find((u: any) => u.id === apt.ownerId || Number(u.id) === Number(apt.ownerId));
          if (apt.ownerId || ownerUser || apt.ownerName || apt.ownerPhone) {
            owners.push(
              toContact({
                userId: apt.ownerId || ownerUser?.id || 0,
                name: ownerUser?.name || apt.ownerName || 'Owner',
                phone: ownerUser?.phone || apt.ownerPhone,
                role: 'owner',
                isPrimary: true
              })
            );
          }
        }

        group.tenants = tenants;
        group.owners = owners;
      });
    });
  }

  /**
   * Calculate summary statistics for unpaid report
   */
  private static calculateUnpaidSummary(data: CommonExpensesData[]): any {
    const totalOutstanding = data.reduce((sum, item) => sum + item.outstandingAmount, 0);
    const totalApartments = new Set(data.map(item => item.apartment?.id)).size;
    const totalBlocks = new Set(data.map(item => item.apartment?.block)).size;
    const unpaidCount = data.filter(item => item.paymentStatus === 'unpaid').length;
    const partialCount = data.filter(item => item.paymentStatus === 'partial').length;
    
    return {
      totalOutstanding,
      totalApartments,
      totalBlocks,
      unpaidCount,
      partialCount
    };
  }

  /**
   * Filter out apartments with negative total outstanding amounts (credits)
   */
  private static filterApartmentsWithCredits(groupedData: any): any {
    const filteredData: any = {};
    
    Object.keys(groupedData).forEach(block => {
      const blockApartments: any = {};
      
      Object.keys(groupedData[block]).forEach(apartmentId => {
        const apartmentData = groupedData[block][apartmentId];
        
        // Calculate total outstanding amount for this apartment
        const totalOutstanding = apartmentData.payments.reduce((sum: number, payment: any) => 
          sum + payment.outstandingAmount, 0
        );
        
        // Only include apartments with positive outstanding amounts
        if (totalOutstanding > 0) {
          blockApartments[apartmentId] = apartmentData;
        }
      });
      
      // Only include blocks that have apartments
      if (Object.keys(blockApartments).length > 0) {
        filteredData[block] = blockApartments;
      }
    });
    
    return filteredData;
  }

  /**
   * Calculate block-level outstanding totals
   */
  private static calculateBlockTotals(groupedData: any): any {
    const blockTotals: any = {};
    
    Object.keys(groupedData).forEach(block => {
      let blockTotal = 0;
      let apartmentCount = 0;
      
      Object.keys(groupedData[block]).forEach(apartmentId => {
        const apartmentData = groupedData[block][apartmentId];
        apartmentCount++;
        
        apartmentData.payments.forEach((payment: any) => {
          blockTotal += payment.outstandingAmount;
        });
      });
      
      blockTotals[block] = {
        totalOutstanding: blockTotal,
        apartmentCount
      };
    });
    
    return blockTotals;
  }

  /**
   * Build credits data from overpaid invoices
   */
  private static buildCreditsDataFromInvoices(invoices: any[], apartments: any[], users: any[], categories: any[] = []): any[] {
    return invoices.map(invoice => {
      let apartment = apartments.find(apt =>
        apt.id === invoice.apartmentId ||
        String(apt.id) === String(invoice.apartmentId) ||
        Number(apt.id) === Number(invoice.apartmentId)
      );

      const owner = users.find(user => user.id === apartment?.ownerId);
      const category = categories.find(cat => cat.id === invoice.categoryId);

      const creditAmount = invoice.amountPaid - invoice.amount; // How much extra was paid

      return {
        invoice,
        apartment,
        owner,
        category,
        creditAmount
      };
    });
  }

  /**
   * Group credits data by block and apartment
   */
  private static groupCreditsDataByBlock(data: any[]): any {
    const grouped: any = {};

    data.forEach(item => {
      let block = item.apartment?.block || 'Unknown';
      const apartmentId = item.apartment?.id || item.invoice.apartmentId || 'Unknown';

      if (!grouped[block]) grouped[block] = {};

      if (!grouped[block][apartmentId]) {
        const apartmentData = item.apartment || {
          id: item.invoice.apartmentId,
          block,
          unitNumberOfficial: `Apartment ${item.invoice.apartmentId}`,
          unitNumberUnofficial: null,
          areaInM2: 0,
          ownerId: null
        };
        grouped[block][apartmentId] = {
          apartment: apartmentData,
          owner: item.owner,
          payments: []
        };
      }

      grouped[block][apartmentId].payments.push({
        year: item.invoice.year,
        invoice: item.invoice,
        creditAmount: item.creditAmount,
        category: item.category
      });
    });

    return grouped;
  }

  /**
   * Calculate block-level credit totals
   */
  private static calculateCreditBlockTotals(groupedData: any): any {
    const blockTotals: any = {};

    Object.keys(groupedData).forEach(block => {
      let blockTotal = 0;
      let apartmentCount = 0;

      Object.keys(groupedData[block]).forEach(apartmentId => {
        const apartmentData = groupedData[block][apartmentId];
        apartmentCount++;
        apartmentData.payments.forEach((payment: any) => {
          blockTotal += payment.creditAmount;
        });
      });

      blockTotals[block] = {
        totalCredit: blockTotal,
        apartmentCount
      };
    });

    return blockTotals;
  }

}
