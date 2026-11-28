/** Invoice line totals, remainders, customer balance, and receipt copy. Amounts are minor units. */

export type InvoiceLineLike = {
  quantity: number;
  unitAmount: number;
  discountAmount: number;
};

export type InvoicePaymentLike = {
  id?: string;
  amount: number;
  date: string;
  createdAt?: Date | string;
};

export type OpenInvoiceLike = {
  status: string;
  lines: InvoiceLineLike[];
  taxBps: number;
  payments: InvoicePaymentLike[];
};

export function lineTotal(line: InvoiceLineLike): number {
  const gross = line.quantity * line.unitAmount;
  const discount = Math.max(0, Math.min(line.discountAmount, gross));
  return Math.max(0, gross - discount);
}

export function invoiceSubtotal(lines: InvoiceLineLike[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

export function invoiceTax(lines: InvoiceLineLike[], taxBps: number): number {
  return Math.round((invoiceSubtotal(lines) * taxBps) / 10000);
}

export function invoiceTotal(lines: InvoiceLineLike[], taxBps: number): number {
  return invoiceSubtotal(lines) + invoiceTax(lines, taxBps);
}

export function paymentsTotal(payments: InvoicePaymentLike[]): number {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export function invoiceRemainder(
  lines: InvoiceLineLike[],
  taxBps: number,
  payments: InvoicePaymentLike[]
): number {
  return Math.max(0, invoiceTotal(lines, taxBps) - paymentsTotal(payments));
}

/** Stored status from payments and void flag. */
export function deriveInvoiceStatus(
  status: string,
  lines: InvoiceLineLike[],
  taxBps: number,
  payments: InvoicePaymentLike[]
): "UNPAID" | "PARTIAL" | "PAID" | "VOID" {
  if (status === "VOID") {
    return "VOID";
  }
  const total = invoiceTotal(lines, taxBps);
  const paid = paymentsTotal(payments);
  if (paid <= 0) {
    return "UNPAID";
  }
  if (paid >= total) {
    return "PAID";
  }
  return "PARTIAL";
}

/**
 * Customer balance: negative sum of remainders on non-void, not-fully-paid invoices.
 * Returns a signed amount (0 or negative).
 */
export function customerBalance(invoices: OpenInvoiceLike[]): number {
  let owed = 0;
  for (const invoice of invoices) {
    if (invoice.status === "VOID") {
      continue;
    }
    const remainder = invoiceRemainder(invoice.lines, invoice.taxBps, invoice.payments);
    if (remainder > 0) {
      owed += remainder;
    }
  }
  return owed === 0 ? 0 : -owed;
}

export type ReceiptCopy = {
  paidAmount: number;
  invoiceTotal: number;
  stillToPay: number;
  /** True when this payment leaves a remainder. */
  isPartial: boolean;
  summary: string;
};

function paymentOrderKey(payment: InvoicePaymentLike): string {
  const created =
    payment.createdAt instanceof Date
      ? payment.createdAt.toISOString()
      : String(payment.createdAt ?? "");
  return `${payment.date}|${created}|${payment.id ?? ""}`;
}

/**
 * Receipt wording after a specific payment.
 * stillToPay = invoice total − all payments up to and including this one.
 * Partial receipts mention the remainder; paid-in-full receipts do not.
 */
export function receiptCopy(input: {
  lines: InvoiceLineLike[];
  taxBps: number;
  payments: InvoicePaymentLike[];
  paymentId: string;
  currencyLabel?: string;
}): ReceiptCopy | null {
  const total = invoiceTotal(input.lines, input.taxBps);
  const ordered = [...input.payments].sort((a, b) =>
    paymentOrderKey(a).localeCompare(paymentOrderKey(b))
  );
  const index = ordered.findIndex((payment) => payment.id === input.paymentId);
  if (index < 0) {
    return null;
  }
  const payment = ordered[index]!;
  const paidThrough = ordered.slice(0, index + 1).reduce((sum, row) => sum + row.amount, 0);
  const stillToPay = Math.max(0, total - paidThrough);
  const isPartial = stillToPay > 0;
  const currency = input.currencyLabel ? ` ${input.currencyLabel}` : "";
  const fmt = (minor: number) => `${(minor / 100).toFixed(2)}${currency}`;

  const summary = isPartial
    ? `Paid ${fmt(payment.amount)} of ${fmt(total)}. Still to pay ${fmt(stillToPay)}.`
    : `Paid ${fmt(payment.amount)} of ${fmt(total)}. Paid in full.`;

  return {
    paidAmount: payment.amount,
    invoiceTotal: total,
    stillToPay,
    isPartial,
    summary,
  };
}
