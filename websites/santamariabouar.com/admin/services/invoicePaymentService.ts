import { InvoicesService } from './invoicesService';
import { TransactionsService, Transaction } from './transactionsService';
import { ApartmentWalletService } from './apartmentWalletService';
import { notifyOwnerOfInvoicePayment } from '../../src/services/emailService';

export class InvoicePaymentError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'InvoicePaymentError';
  }
}

export interface RecordInvoicePaymentInput {
  invoiceId: number;
  cashAmount: number;
  walletAmount: number;
  date?: string | null;
  accountId?: number | null;
  description?: string | null;
  receiptImage?: string | null;
  createdBy: number | null;
}

export interface RecordInvoicePaymentResult {
  transaction: Transaction | null;
  walletAllocated: number;
  cashAmount: number;
  paymentDate: string;
  message: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Pays an invoice from the apartment wallet and/or a cash transaction,
 * then notifies the owner.
 */
export class InvoicePaymentService {
  private static instance: InvoicePaymentService;
  private invoicesService = InvoicesService.getInstance();
  private transactionsService = TransactionsService.getInstance();
  private walletService = ApartmentWalletService.getInstance();

  public static getInstance(): InvoicePaymentService {
    if (!InvoicePaymentService.instance) {
      InvoicePaymentService.instance = new InvoicePaymentService();
    }
    return InvoicePaymentService.instance;
  }

  public async recordPayment(input: RecordInvoicePaymentInput): Promise<RecordInvoicePaymentResult> {
    const cashAmount = Number.isFinite(input.cashAmount) ? input.cashAmount : 0;
    const walletAmt = Number.isFinite(input.walletAmount) ? input.walletAmount : 0;
    const date = String(input.date || '').trim();

    if (cashAmount <= 0 && walletAmt <= 0) {
      throw new InvoicePaymentError(400, 'Enter an amount from wallet and/or cash payment');
    }
    if (cashAmount > 0 && !input.accountId) {
      throw new InvoicePaymentError(400, 'Account is required for cash payment');
    }
    if (cashAmount > 0 && !date) {
      throw new InvoicePaymentError(400, 'Payment date is required for cash payment');
    }
    if (walletAmt > 0 && !date) {
      throw new InvoicePaymentError(400, 'Payment date is required (used on the receipt)');
    }

    const invoice = await this.invoicesService.getInvoiceById(input.invoiceId);
    if (!invoice) {
      throw new InvoicePaymentError(404, 'Invoice not found');
    }

    const outstanding = round2(Math.max(0, invoice.amount - invoice.amountPaid));
    const totalPayment = round2(cashAmount + walletAmt);
    if (totalPayment <= 0) {
      throw new InvoicePaymentError(400, 'Payment total must be greater than zero');
    }
    if (totalPayment > outstanding + 0.009) {
      throw new InvoicePaymentError(
        400,
        `Payment total ($${totalPayment.toFixed(2)}) exceeds invoice balance ($${outstanding.toFixed(2)})`
      );
    }

    let walletAllocated = 0;
    if (walletAmt > 0) {
      const result = await this.walletService.allocateWalletToInvoice(invoice.apartmentId, input.invoiceId, walletAmt);
      walletAllocated = result.allocated;
    }

    let transaction: Transaction | null = null;
    if (cashAmount > 0) {
      transaction = await this.transactionsService.createInvoicePayment({
        invoiceId: input.invoiceId,
        amount: cashAmount,
        date,
        accountId: Number(input.accountId),
        categoryId: invoice.categoryId,
        description: input.description || invoice.description,
        createdBy: input.createdBy,
        receiptImage: input.receiptImage || null
      });
    }

    const parts: string[] = [];
    if (walletAllocated > 0) parts.push(`$${walletAllocated.toFixed(2)} from wallet`);
    if (cashAmount > 0) parts.push(`$${cashAmount.toFixed(2)} cash`);

    const paymentDate = date || new Date().toISOString().split('T')[0];
    if (walletAllocated > 0 || cashAmount > 0) {
      void notifyOwnerOfInvoicePayment({
        invoiceId: input.invoiceId,
        cashAmount,
        walletAmount: walletAllocated,
        paymentDate,
        transactionId: transaction?.id
      });
    }

    return {
      transaction,
      walletAllocated,
      cashAmount,
      paymentDate,
      message: `Payment recorded (${parts.join(' + ')})`
    };
  }
}
