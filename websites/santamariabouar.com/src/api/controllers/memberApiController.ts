import { Request, Response } from 'express';
import { usersService } from '../../../admin/services/usersService';
import { InvoicesService, Invoice } from '../../../admin/services/invoicesService';
import { TransactionsService } from '../../../admin/services/transactionsService';
import { ApartmentWalletService } from '../../../admin/services/apartmentWalletService';
import { InvoiceTransactionsService } from '../../../admin/services/invoiceTransactionsService';
import { TransactionCategoriesService } from '../../../admin/services/transactionCategoriesService';
import { TransactionsController } from '../../../admin/controllers/transactionsController';
import { InvoicesController } from '../../../admin/controllers/invoicesController';
import {
  apartmentLabel,
  assertMemberApartment,
  getMemberApartments,
  loadPaymentInstructionLocals,
  loadPaymentsDueForMember
} from '../../services/memberPortalService';
import { apiTokenService, getJwtSecret } from '../services/apiTokenService';
import { ApiError, requireId, sendData } from '../utils/apiResponse';

const MIN_PASSWORD_LENGTH = 8;

const invoicesService = InvoicesService.getInstance();
const transactionsService = TransactionsService.getInstance();
const walletService = ApartmentWalletService.getInstance();
const invoiceTransactionsService = InvoiceTransactionsService.getInstance();
const categoriesService = TransactionCategoriesService.getInstance();

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function apartmentSummary(apt: any) {
  return {
    id: apt.id,
    label: apartmentLabel(apt),
    block: apt.block,
    unitNumberOfficial: apt.unitNumberOfficial,
    unitNumberUnofficial: apt.unitNumberUnofficial,
    areaInM2: apt.areaInM2,
    status: apt.status,
    isVacant: Boolean(apt.isVacant),
    memberRole: apt.memberRole || 'owner',
    isPrimaryOwner: Boolean(apt.isPrimaryOwner),
    ownerName: apt.ownerName || null,
    renterName: apt.renterName || null,
    officialImage: apt.officialImage ? `/images/apartments/${apt.id}/${apt.officialImage}` : null
  };
}

async function categoryLookup() {
  const categories = await categoriesService.getAllCategories();
  return new Map(categories.map((c) => [c.id, c]));
}

function invoiceView(inv: Invoice, label: string, categories: Map<number, { name: string; color: string }>) {
  const category = categories.get(inv.categoryId);
  return {
    id: inv.id,
    apartmentId: inv.apartmentId,
    apartmentLabel: label,
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
}

async function memberTransactions(apartments: any[]) {
  const items: any[] = [];
  for (const apt of apartments) {
    const label = apartmentLabel(apt);
    const txs = await transactionsService.getFilteredTransactions({ apartmentId: apt.id });
    txs.forEach((tx) => {
      items.push({
        id: String(tx.id),
        transactionId: tx.id,
        apartmentId: apt.id,
        apartmentLabel: label,
        amount: tx.amount,
        type: tx.type,
        date: tx.date,
        description: tx.description,
        hasReceipt: tx.type === 'income' && Boolean(tx.receiptGenerated),
        isWalletPayment: false,
        invoiceId: tx.invoiceId || null
      });
    });

    const walletPayments = await invoiceTransactionsService.getWalletPaymentsByApartmentId(apt.id);
    walletPayments.forEach((wp) => {
      items.push({
        id: `wallet-${wp.id}`,
        transactionId: null,
        apartmentId: apt.id,
        apartmentLabel: label,
        amount: wp.amount,
        type: 'income',
        date: wp.date,
        description: `Wallet payment — ${wp.invoiceDescription || `Invoice #${wp.invoiceId}`}`,
        hasReceipt: true,
        isWalletPayment: true,
        invoiceId: wp.invoiceId
      });
    });
  }
  items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return items;
}

export class MemberApiController {
  static async dashboard(req: Request, res: Response): Promise<void> {
    const user = req.apiUser!;
    const [apartments, paymentsDue, instructions] = await Promise.all([
      getMemberApartments(user.id),
      loadPaymentsDueForMember(user.id),
      loadPaymentInstructionLocals()
    ]);

    let walletTotal: number | null = null;
    if (user.walletEnabled) {
      walletTotal = 0;
      for (const apt of apartments) {
        walletTotal += await walletService.getTotalBalance(apt.id);
      }
      walletTotal = round2(walletTotal);
    }

    const categories = await categoryLookup();
    sendData(res, {
      apartments: apartments.map(apartmentSummary),
      paymentsDue: paymentsDue.map((inv) => invoiceView(inv, inv.apartmentLabel, categories)),
      totalDue: round2(paymentsDue.reduce((sum, inv) => sum + Math.max(0, inv.balance || 0), 0)),
      walletEnabled: Boolean(user.walletEnabled),
      walletTotal,
      paymentInstructions: {
        coordinatorName: instructions.janitorName,
        coordinatorPhone: instructions.janitorPhone,
        settings: instructions.paymentSettings || null,
        yearlyInterestRate: instructions.yearlyInterestRate
      }
    });
  }

  static async apartments(req: Request, res: Response): Promise<void> {
    const apartments = await getMemberApartments(req.apiUser!.id);
    sendData(res, apartments.map(apartmentSummary));
  }

  static async apartmentDetail(req: Request, res: Response): Promise<void> {
    const user = req.apiUser!;
    const apartmentId = requireId(req.params.id, 'apartment');
    const apartment = await assertMemberApartment(user.id, apartmentId);
    if (!apartment) throw new ApiError(404, 'Apartment not found.');

    const memberApartments = await getMemberApartments(user.id);
    const linked = memberApartments.find((apt: any) => apt.id === apartmentId) || apartment;
    const label = apartmentLabel(apartment);

    const [unpaid, transactions, categories] = await Promise.all([
      invoicesService.getUnpaidInvoices({ apartmentId }),
      memberTransactions([apartment]),
      categoryLookup()
    ]);

    let wallet: { balance: number; entries: any[] } | null = null;
    if (user.walletEnabled) {
      const statement = await walletService.getWalletStatement(apartmentId);
      wallet = {
        balance: statement.balance,
        entries: statement.entries
          .map((e) => ({
            id: e.id,
            date: e.date,
            description: e.description,
            amount: e.amount,
            runningBalance: e.runningBalance
          }))
          .reverse()
      };
    }

    sendData(res, {
      apartment: apartmentSummary(linked),
      paymentsDue: unpaid.map((inv) => invoiceView(inv, label, categories)),
      transactions,
      wallet
    });
  }

  static async invoices(req: Request, res: Response): Promise<void> {
    const status = String(req.query.status || 'unpaid');
    const apartments = await getMemberApartments(req.apiUser!.id);
    const categories = await categoryLookup();
    const items: any[] = [];

    for (const apt of apartments) {
      const label = apartmentLabel(apt);
      const list = status === 'all'
        ? await invoicesService.getInvoicesByApartment(apt.id)
        : await invoicesService.getUnpaidInvoices({ apartmentId: apt.id });
      list.forEach((inv) => items.push(invoiceView(inv, label, categories)));
    }

    items.sort((a, b) => String(b.invoiceDate).localeCompare(String(a.invoiceDate)));
    sendData(res, items);
  }

  static async transactions(req: Request, res: Response): Promise<void> {
    const apartments = await getMemberApartments(req.apiUser!.id);
    sendData(res, await memberTransactions(apartments));
  }

  static async wallet(req: Request, res: Response): Promise<void> {
    const user = req.apiUser!;
    if (!user.walletEnabled) {
      sendData(res, { walletEnabled: false, total: 0, wallets: [] });
      return;
    }

    const apartments = await getMemberApartments(user.id);
    const wallets: any[] = [];
    let total = 0;
    for (const apt of apartments) {
      const statement = await walletService.getWalletStatement(apt.id);
      total += statement.balance;
      wallets.push({
        apartmentId: apt.id,
        apartmentLabel: apartmentLabel(apt),
        balance: statement.balance,
        entries: statement.entries
          .map((e) => ({
            id: e.id,
            date: e.date,
            description: e.description,
            amount: e.amount,
            runningBalance: e.runningBalance
          }))
          .reverse()
      });
    }

    sendData(res, { walletEnabled: true, total: round2(total), wallets });
  }

  static async transactionReceipt(req: Request, res: Response): Promise<void> {
    const transactionId = requireId(req.params.id, 'receipt');
    const transaction = await transactionsService.getTransactionById(transactionId);
    if (!transaction || transaction.type !== 'income' || !transaction.receiptGenerated || !transaction.apartmentId) {
      throw new ApiError(404, 'Receipt not found.');
    }
    const apartment = await assertMemberApartment(req.apiUser!.id, transaction.apartmentId);
    if (!apartment) throw new ApiError(404, 'Receipt not found.');

    await TransactionsController.generateReceipt(req, res);
  }

  static async invoiceReceipt(req: Request, res: Response): Promise<void> {
    const invoiceId = requireId(req.params.id, 'receipt');
    const invoice = await invoicesService.getInvoiceById(invoiceId);
    if (!invoice) throw new ApiError(404, 'Receipt not found.');
    const apartment = await assertMemberApartment(req.apiUser!.id, invoice.apartmentId);
    if (!apartment) throw new ApiError(404, 'Receipt not found.');

    await InvoicesController.paymentReceipt(req, res);
  }

  static async changePassword(req: Request, res: Response): Promise<void> {
    const apiUser = req.apiUser!;
    const user = await usersService.getUserById(apiUser.id);
    if (!user) throw new ApiError(401, 'Please sign in.');

    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    const hasPassword = Boolean(user.password);

    if (hasPassword) {
      if (!currentPassword) throw new ApiError(400, 'Please enter your current password.');
      const verified = await usersService.authenticateUser(user.email || user.phone || '', currentPassword);
      if (!verified) throw new ApiError(400, 'Current password is incorrect.');
      if (newPassword === currentPassword) {
        throw new ApiError(400, 'New password must be different from your current password.');
      }
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(400, `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    const updated = await usersService.updateUserPassword(user.id, newPassword);
    if (!updated) throw new ApiError(500, 'Could not update password. Please try again.');

    await apiTokenService.revokeAllForUser(user.id);
    const secret = getJwtSecret();
    const tokens = secret ? await apiTokenService.issueTokens(user.id, user.role, secret, req.body?.deviceName) : null;
    sendData(res, { message: 'Password updated. Other devices have been signed out.', tokens });
  }
}
