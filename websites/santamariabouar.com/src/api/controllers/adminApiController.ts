import { Request, Response } from 'express';
import { usersService } from '../../../admin/services/usersService';
import { apartmentsService } from '../../../admin/services/apartmentsService';
import { InvoicesService } from '../../../admin/services/invoicesService';
import { TransactionsService, TransactionListFilters } from '../../../admin/services/transactionsService';
import { ApartmentWalletService } from '../../../admin/services/apartmentWalletService';
import { InvoiceTransactionsService } from '../../../admin/services/invoiceTransactionsService';
import { TransactionCategoriesService } from '../../../admin/services/transactionCategoriesService';
import { AccountsService } from '../../../admin/services/accountsService';
import { InvoicePaymentService, InvoicePaymentError } from '../../../admin/services/invoicePaymentService';
import { TransactionsController } from '../../../admin/controllers/transactionsController';
import { InvoicesController } from '../../../admin/controllers/invoicesController';
import { accessRequestService } from '../../services/accessRequestService';
import { accessApprovalService, AccessApprovalError } from '../../services/accessApprovalService';
import { notifyApartmentOfWalletTransaction } from '../../services/emailService';
import { apartmentLabel } from '../../services/memberPortalService';
import {
  ApiError,
  isIsoDate,
  paginate,
  parseId,
  parsePagination,
  requireId,
  sendData
} from '../utils/apiResponse';

const invoicesService = InvoicesService.getInstance();
const transactionsService = TransactionsService.getInstance();
const walletService = ApartmentWalletService.getInstance();
const invoiceTransactionsService = InvoiceTransactionsService.getInstance();
const categoriesService = TransactionCategoriesService.getInstance();
const accountsService = AccountsService.getInstance();
const invoicePaymentService = InvoicePaymentService.getInstance();

const COMMON_EXPENSES_CATEGORY = 'common expenses';
const TRANSFER_CATEGORY = 'transfer';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function compareApartments(
  a: { block?: string; unitNumberOfficial?: string },
  b: { block?: string; unitNumberOfficial?: string }
): number {
  const byBlock = (a.block || '').localeCompare(b.block || '');
  if (byBlock !== 0) return byBlock;
  return String(a.unitNumberOfficial || '').localeCompare(String(b.unitNumberOfficial || ''), undefined, {
    numeric: true
  });
}

function matchesApartmentSearch(apt: any, term: string): boolean {
  if (!term) return true;
  const haystack = [
    apt.block,
    apt.unitNumberOfficial,
    apt.unitNumberUnofficial,
    apt.ownerName,
    apt.renterName,
    `block ${apt.block} ${apt.unitNumberOfficial}`
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

function parseAmount(value: unknown, label = 'Amount'): number {
  const amount = round2(parseFloat(String(value ?? '')));
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, `${label} must be greater than 0`);
  return amount;
}

function requireDate(value: unknown): string {
  if (!isIsoDate(value)) throw new ApiError(400, 'Date is required (YYYY-MM-DD)');
  return value;
}

async function requireApartment(apartmentId: number) {
  const apartment = await apartmentsService.getApartmentById(apartmentId);
  if (!apartment) throw new ApiError(404, 'Apartment not found');
  return apartment;
}

export class AdminApiController {
  static async dashboard(_req: Request, res: Response): Promise<void> {
    const [requests, unpaid, walletSummary, transactionSummary] = await Promise.all([
      accessRequestService.getAllRequests(),
      invoicesService.getUnpaidInvoices(),
      walletService.getGlobalSummary(),
      transactionsService.getTransactionSummary()
    ]);

    sendData(res, {
      pendingAccessRequests: requests.length,
      unpaidInvoices: {
        count: unpaid.length,
        totalBalance: round2(unpaid.reduce((sum, inv) => sum + Math.max(0, inv.amount - inv.amountPaid), 0))
      },
      wallets: walletSummary,
      transactions: transactionSummary
    });
  }

  // ---------- Lookups ----------

  static async accounts(_req: Request, res: Response): Promise<void> {
    const accounts = await accountsService.getAllAccountsWithBalance();
    sendData(
      res,
      accounts
        .filter((a) => a.isActive)
        .map((a) => ({ id: a.id, name: a.name, currency: a.currency, balance: round2(a.balance) }))
    );
  }

  static async categories(_req: Request, res: Response): Promise<void> {
    const categories = await categoriesService.getActiveCategories();
    sendData(
      res,
      categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        color: c.color,
        supportedOnMobile: c.name.toLowerCase() !== COMMON_EXPENSES_CATEGORY
      }))
    );
  }

  static async apartments(req: Request, res: Response): Promise<void> {
    const term = String(req.query.search || '').toLowerCase().trim();
    const apartments = (await apartmentsService.getAllApartments())
      .filter((apt) => matchesApartmentSearch(apt, term))
      .sort(compareApartments)
      .slice(0, 50);
    sendData(
      res,
      apartments.map((apt) => ({
        id: apt.id,
        label: apartmentLabel(apt),
        ownerId: apt.ownerId || null,
        ownerName: apt.ownerName || null
      }))
    );
  }

  // ---------- Transactions ----------

  static async transactions(req: Request, res: Response): Promise<void> {
    const filters: TransactionListFilters = { keyword: String(req.query.keyword || '').trim() };
    if (isIsoDate(req.query.fromDate)) filters.fromDate = req.query.fromDate;
    if (isIsoDate(req.query.toDate)) filters.toDate = req.query.toDate;
    const apartmentId = parseId(req.query.apartmentId);
    if (apartmentId) filters.apartmentId = apartmentId;

    const [transactions, accounts, categories, apartments] = await Promise.all([
      transactionsService.getFilteredTransactions(filters),
      accountsService.getAllAccounts(),
      categoriesService.getAllCategories(),
      apartmentsService.getAllApartments()
    ]);
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const apartmentById = new Map(apartments.map((a) => [a.id, a]));

    const { page, pageSize } = parsePagination(req.query);
    const result = paginate(transactions, page, pageSize);
    sendData(res, {
      ...result,
      items: result.items.map((tx) => {
        const apt = tx.apartmentId ? apartmentById.get(tx.apartmentId) : null;
        const category = categoryById.get(tx.categoryId);
        return {
          id: tx.id,
          amount: tx.amount,
          type: tx.type,
          date: tx.date,
          description: tx.description,
          accountId: tx.accountId,
          accountName: accountById.get(tx.accountId)?.name || null,
          categoryId: tx.categoryId,
          categoryName: category?.name || null,
          categoryColor: category?.color || null,
          apartmentId: tx.apartmentId || null,
          apartmentLabel: apt ? apartmentLabel(apt) : null,
          invoiceId: tx.invoiceId || null,
          hasReceipt: tx.type === 'income' && Boolean(tx.receiptGenerated)
        };
      })
    });
  }

  static async transactionReceipt(req: Request, res: Response): Promise<void> {
    const transactionId = requireId(req.params.id, 'receipt');
    const transaction = await transactionsService.getTransactionById(transactionId);
    if (!transaction || transaction.type !== 'income' || !transaction.receiptGenerated) {
      throw new ApiError(404, 'Receipt not found.');
    }
    await TransactionsController.generateReceipt(req, res);
  }

  static async invoiceReceipt(req: Request, res: Response): Promise<void> {
    const invoiceId = requireId(req.params.id, 'receipt');
    const invoice = await invoicesService.getInvoiceById(invoiceId);
    if (!invoice) throw new ApiError(404, 'Receipt not found.');
    await InvoicesController.paymentReceipt(req, res);
  }

  static async createTransaction(req: Request, res: Response): Promise<void> {
    const body = req.body || {};
    const categoryId = requireId(body.categoryId, 'category');
    const accountId = requireId(body.accountId, 'account');
    const amount = parseAmount(body.amount);
    const date = requireDate(body.date);
    const description = String(body.description || '').trim();
    const createdBy = req.apiUser!.id;

    const category = await categoriesService.getCategoryById(categoryId);
    if (!category) throw new ApiError(400, 'Invalid category');
    const categoryName = category.name.toLowerCase();

    if (categoryName === COMMON_EXPENSES_CATEGORY) {
      throw new ApiError(400, 'Record common expense payments from the invoice screen (Pay invoice).');
    }
    if (!description) throw new ApiError(400, 'Description is required for this transaction type');

    if (categoryName === TRANSFER_CATEGORY) {
      const toAccountId = requireId(body.toAccountId, 'destination account');
      if (toAccountId === accountId) throw new ApiError(400, 'Choose two different accounts for a transfer');
      const result = await transactionsService.createTransfer({
        fromAccountId: accountId,
        toAccountId,
        amount,
        categoryId,
        description,
        date,
        createdBy
      });
      sendData(res, { id: result.fromTransaction.id, transfer: result }, 201);
      return;
    }

    let type: 'income' | 'expense';
    if (body.type === 'income' || body.type === 'expense') {
      type = body.type;
    } else if (category.type === 'both') {
      type = 'income';
    } else {
      type = category.type;
    }

    let apartmentId: number | null = null;
    if (body.apartmentId !== undefined && body.apartmentId !== null && body.apartmentId !== '') {
      apartmentId = requireId(body.apartmentId, 'apartment');
      await requireApartment(apartmentId);
    }

    const transaction = await transactionsService.createTransaction({
      amount,
      type,
      categoryId,
      description,
      date,
      accountId,
      apartmentId,
      receiptGenerated: false,
      receiptImage: null,
      createdBy
    });
    sendData(res, transaction, 201);
  }

  // ---------- Invoices ----------

  static async invoices(req: Request, res: Response): Promise<void> {
    const status = String(req.query.status ?? 'partial-unpaid');
    const apartmentId = parseId(req.query.apartmentId);
    const year = parseId(req.query.year);
    const term = String(req.query.search || '').toLowerCase().trim();

    const [allInvoices, apartments, categories] = await Promise.all([
      invoicesService.getAllInvoices(),
      apartmentsService.getAllApartments(),
      categoriesService.getAllCategories()
    ]);
    const apartmentById = new Map(apartments.map((a) => [a.id, a]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const filtered = allInvoices
      .filter((inv) => {
        if (status === 'partial-unpaid') return inv.status === 'unpaid' || inv.status === 'partial';
        if (status && status !== 'all') return inv.status === status;
        return true;
      })
      .filter((inv) => !apartmentId || inv.apartmentId === apartmentId)
      .filter((inv) => !year || inv.year === year)
      .filter((inv) => {
        if (!term) return true;
        if ((inv.description || '').toLowerCase().includes(term)) return true;
        const apt = apartmentById.get(inv.apartmentId);
        return apt ? matchesApartmentSearch(apt, term) : false;
      })
      .sort((a, b) => {
        const aptA = apartmentById.get(a.apartmentId);
        const aptB = apartmentById.get(b.apartmentId);
        const byApt = aptA && aptB ? compareApartments(aptA, aptB) : 0;
        return byApt !== 0 ? byApt : String(b.invoiceDate).localeCompare(String(a.invoiceDate));
      });

    const summary = {
      count: filtered.length,
      totalAmount: round2(filtered.reduce((s, inv) => s + inv.amount, 0)),
      totalPaid: round2(filtered.reduce((s, inv) => s + inv.amountPaid, 0)),
      totalBalance: round2(filtered.reduce((s, inv) => s + (inv.amount - inv.amountPaid), 0))
    };

    const { page, pageSize } = parsePagination(req.query);
    const result = paginate(filtered, page, pageSize);
    sendData(res, {
      ...result,
      summary,
      items: result.items.map((inv) => {
        const apt = apartmentById.get(inv.apartmentId);
        const category = categoryById.get(inv.categoryId);
        return {
          id: inv.id,
          apartmentId: inv.apartmentId,
          apartmentLabel: apt ? apartmentLabel(apt) : `Apartment #${inv.apartmentId}`,
          ownerName: apt?.ownerName || null,
          description: inv.description,
          amount: inv.amount,
          amountPaid: inv.amountPaid,
          balance: round2(Math.max(0, inv.amount - inv.amountPaid)),
          status: inv.status,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          year: inv.year,
          categoryName: category?.name || null,
          categoryColor: category?.color || null
        };
      })
    });
  }

  static async invoiceDetail(req: Request, res: Response): Promise<void> {
    const invoiceId = requireId(req.params.id, 'invoice');
    const invoice = await invoicesService.getInvoiceById(invoiceId);
    if (!invoice) throw new ApiError(404, 'Invoice not found');

    const [apartment, category, breakdown, walletBalance] = await Promise.all([
      apartmentsService.getApartmentById(invoice.apartmentId),
      categoriesService.getCategoryById(invoice.categoryId),
      invoiceTransactionsService.getInvoicePaymentBreakdown(invoiceId),
      walletService.getTotalBalance(invoice.apartmentId)
    ]);

    sendData(res, {
      id: invoice.id,
      apartmentId: invoice.apartmentId,
      apartmentLabel: apartment ? apartmentLabel(apartment) : `Apartment #${invoice.apartmentId}`,
      ownerName: apartment?.ownerName || null,
      description: invoice.description,
      amount: invoice.amount,
      amountPaid: invoice.amountPaid,
      balance: round2(Math.max(0, invoice.amount - invoice.amountPaid)),
      status: invoice.status,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      year: invoice.year,
      notes: invoice.notes,
      categoryId: invoice.categoryId,
      categoryName: category?.name || null,
      walletBalance: round2(walletBalance),
      breakdown
    });
  }

  static async createInvoice(req: Request, res: Response): Promise<void> {
    const body = req.body || {};
    const apartmentId = requireId(body.apartmentId, 'apartment');
    const categoryId = requireId(body.categoryId, 'category');
    const amount = parseAmount(body.amount);
    const invoiceDate = requireDate(body.invoiceDate);
    const dueDate = body.dueDate ? requireDate(body.dueDate) : null;
    const year = body.year ? parseId(body.year) : null;

    await requireApartment(apartmentId);
    if (!(await categoriesService.getCategoryById(categoryId))) throw new ApiError(400, 'Invalid category');

    const invoice = await invoicesService.createInvoice({
      apartmentId,
      categoryId,
      amount,
      description: String(body.description || '').trim(),
      dueDate,
      invoiceDate,
      year,
      notes: body.notes ? String(body.notes) : null,
      createdBy: req.apiUser!.id
    });
    sendData(res, invoice, 201);
  }

  static async payInvoice(req: Request, res: Response): Promise<void> {
    const invoiceId = requireId(req.params.id, 'invoice');
    const body = req.body || {};
    try {
      const result = await invoicePaymentService.recordPayment({
        invoiceId,
        cashAmount: parseFloat(String(body.cashAmount ?? 0)) || 0,
        walletAmount: parseFloat(String(body.walletAmount ?? 0)) || 0,
        date: isIsoDate(body.date) ? body.date : null,
        accountId: parseId(body.accountId),
        description: body.description ? String(body.description) : null,
        createdBy: req.apiUser!.id
      });
      sendData(res, {
        message: result.message,
        transactionId: result.transaction?.id || null,
        walletAllocated: result.walletAllocated,
        cashAmount: result.cashAmount,
        paymentDate: result.paymentDate
      });
    } catch (error) {
      if (error instanceof InvoicePaymentError) throw new ApiError(error.status, error.message);
      throw error;
    }
  }

  // ---------- Wallets ----------

  static async wallets(req: Request, res: Response): Promise<void> {
    const term = String(req.query.search || '').toLowerCase().trim();
    const withBalance = req.query.withBalance === '1';
    const [apartments, balances, summary] = await Promise.all([
      apartmentsService.getAllApartments(),
      walletService.getBalancesByApartmentId(),
      walletService.getGlobalSummary()
    ]);

    const rows = apartments
      .map((apt) => ({
        apartmentId: apt.id,
        label: apartmentLabel(apt),
        ownerName: apt.ownerName || null,
        balance: round2(balances.get(apt.id) || 0),
        apt
      }))
      .filter((row) => matchesApartmentSearch(row.apt, term))
      .filter((row) => !withBalance || row.balance > 0.001)
      .sort((a, b) => compareApartments(a.apt, b.apt))
      .map(({ apt: _apt, ...row }) => row);

    const { page, pageSize } = parsePagination(req.query, 50, 200);
    sendData(res, { ...paginate(rows, page, pageSize), summary });
  }

  static async walletDetail(req: Request, res: Response): Promise<void> {
    const apartmentId = requireId(req.params.apartmentId, 'apartment');
    const apartment = await requireApartment(apartmentId);
    const statement = await walletService.getWalletStatement(apartmentId);

    sendData(res, {
      apartmentId,
      label: apartmentLabel(apartment),
      ownerName: apartment.ownerName || null,
      balance: statement.balance,
      totalAdded: statement.totalAdded,
      totalSubtracted: statement.totalSubtracted,
      entries: statement.entries
        .map((e) => ({
          id: e.id,
          date: e.date,
          description: e.description,
          amount: e.amount,
          accountName: e.accountName,
          runningBalance: e.runningBalance,
          source: e.source
        }))
        .reverse()
    });
  }

  static async walletAdd(req: Request, res: Response): Promise<void> {
    await AdminApiController.walletEntry(req, res, 'deposit');
  }

  static async walletSubtract(req: Request, res: Response): Promise<void> {
    await AdminApiController.walletEntry(req, res, 'deduction');
  }

  private static async walletEntry(req: Request, res: Response, kind: 'deposit' | 'deduction'): Promise<void> {
    const apartmentId = requireId(req.params.apartmentId, 'apartment');
    const body = req.body || {};
    const amount = parseAmount(body.amount);
    const accountId = requireId(body.accountId, 'account');
    const date = requireDate(body.date);
    const description = String(body.description || '').trim();
    if (kind === 'deduction' && !description) throw new ApiError(400, 'Description is required');

    const apartment = await requireApartment(apartmentId);
    const params = {
      apartmentId,
      amount,
      accountId,
      date,
      description: description || `Wallet top-up – Block ${apartment.block} ${apartment.unitNumberOfficial}`,
      createdBy: req.apiUser!.id
    };

    let result: { transactionId: number };
    try {
      result = kind === 'deposit'
        ? await walletService.addWalletEntryWithTransaction(params)
        : await walletService.subtractWalletEntryWithTransaction(params);
    } catch (error) {
      throw new ApiError(400, error instanceof Error ? error.message : 'Wallet update failed');
    }

    void notifyApartmentOfWalletTransaction({ apartmentId, kind, amount, date, description: params.description });

    sendData(
      res,
      {
        message: kind === 'deposit' ? 'Wallet balance recorded as transaction' : 'Wallet deduction recorded as transaction',
        transactionId: result.transactionId,
        balance: round2(await walletService.getTotalBalance(apartmentId))
      },
      201
    );
  }

  // ---------- Access requests ----------

  static async accessRequests(_req: Request, res: Response): Promise<void> {
    const requests = await accessRequestService.getAllRequests();
    sendData(res, requests);
  }

  static async accessRequestDetail(req: Request, res: Response): Promise<void> {
    const requestId = requireId(req.params.id, 'request');
    const request = await accessRequestService.getRequestById(requestId);
    if (!request) throw new ApiError(404, 'Request not found');

    const members = (await usersService.getAllUsers())
      .filter((u) => u.role === 'Member')
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
      .map((u) => ({ id: u.id, name: u.name, email: u.email || null, phone: u.phone || null }));

    const emailLower = request.email.toLowerCase();
    const matchingMember = members.find((m) => (m.email || '').toLowerCase() === emailLower) || null;
    const suggestedMemberIds = [
      ...new Set(
        request.apartments
          .filter((a) => a.role !== 'tenant')
          .map((a) => a.ownerId)
          .filter((id): id is number => Boolean(id))
      )
    ];

    sendData(res, { request, members, matchingMemberId: matchingMember?.id || null, suggestedMemberIds });
  }

  static async approveAccessRequest(req: Request, res: Response): Promise<void> {
    const requestId = requireId(req.params.id, 'request');
    const body = req.body || {};
    const apartmentIds: number[] = Array.isArray(body.apartmentIds)
      ? body.apartmentIds.map((v: unknown) => parseInt(String(v), 10)).filter((n: number) => Number.isFinite(n))
      : [];

    try {
      const result = await accessApprovalService.approve({
        requestId,
        linkMode: body.linkMode === 'create' ? 'create' : 'existing',
        userId: parseId(body.userId),
        fullName: String(body.fullName || ''),
        email: String(body.email || ''),
        phone: String(body.phone || ''),
        apartmentIds,
        apartmentRoles: (body.apartmentRoles || {}) as Record<string, string>,
        apartmentActions: (body.apartmentActions || {}) as Record<string, string>,
        adminId: req.apiUser!.id
      });
      sendData(res, {
        message: result.message,
        userId: result.userId,
        emailSent: result.emailSent,
        tempPassword: result.emailSent ? null : result.tempPassword
      });
    } catch (error) {
      if (error instanceof AccessApprovalError) throw new ApiError(error.notFound ? 404 : 400, error.message);
      if (error instanceof Error && /already exists/i.test(error.message)) throw new ApiError(409, error.message);
      throw error;
    }
  }

  static async rejectAccessRequest(req: Request, res: Response): Promise<void> {
    const requestId = requireId(req.params.id, 'request');
    try {
      await accessApprovalService.reject(requestId);
    } catch (error) {
      if (error instanceof AccessApprovalError) throw new ApiError(404, error.message);
      throw error;
    }
    sendData(res, { message: 'Request rejected and removed.' });
  }
}
