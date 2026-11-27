import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { lineTotal } from "@/lib/invoice";

const BLUE = "#006397";
const INK = "#000000";
const MUTED = "#666666";
const LINE = "#eeeeee";
const PANEL = "#f8f9fa";
const WARN_BG = "#fff3cd";
const WARN_BORDER = "#ffc107";
const WARN_TEXT = "#856404";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: INK,
  },
  header: {
    marginBottom: 28,
  },
  brand: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: INK,
    marginBottom: 4,
  },
  docTitle: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: INK,
  },
  titleRule: {
    height: 3,
    width: 72,
    backgroundColor: BLUE,
    marginBottom: 10,
  },
  docDate: {
    fontSize: 12,
    color: INK,
    marginBottom: 28,
  },
  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  partyLabel: {
    fontSize: 10,
    color: "#999999",
    marginBottom: 6,
  },
  partyName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  partyNumber: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  partyRight: {
    alignItems: "flex-end",
  },
  payPanel: {
    backgroundColor: PANEL,
    padding: 16,
    marginBottom: 28,
  },
  payLabel: {
    fontSize: 11,
    color: MUTED,
    marginBottom: 8,
  },
  paySummary: {
    fontSize: 11,
    color: MUTED,
    marginBottom: 10,
  },
  payAmount: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: INK,
    paddingBottom: 8,
    marginBottom: 0,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingVertical: 10,
  },
  th: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  td: {
    fontSize: 10,
  },
  colDesc: { width: "34%" },
  colCat: { width: "16%" },
  colQty: { width: "8%" },
  colUnit: { width: "14%" },
  colDisc: { width: "14%" },
  colAmt: { width: "14%", textAlign: "right" },
  totals: {
    marginTop: 20,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 11,
    color: MUTED,
    width: 120,
    textAlign: "right",
    marginRight: 12,
  },
  totalValue: {
    fontSize: 11,
    width: 100,
    textAlign: "right",
  },
  grandLabel: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    width: 120,
    textAlign: "right",
    marginRight: 12,
  },
  grandValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    width: 100,
    textAlign: "right",
  },
  warn: {
    marginTop: 24,
    padding: 14,
    backgroundColor: WARN_BG,
    borderLeftWidth: 4,
    borderLeftColor: WARN_BORDER,
  },
  warnText: {
    fontSize: 11,
    color: WARN_TEXT,
  },
  notes: {
    marginTop: 24,
    fontSize: 10,
    color: MUTED,
  },
});

export type InvoicePdfLine = {
  description: string;
  categoryName?: string | null;
  quantity: number;
  unitAmount: number;
  discountAmount: number;
};

export type InvoicePdfData = {
  number: string;
  issueDate: string;
  dueDate: string;
  status: string;
  customerName: string;
  brandName: string;
  currency: string;
  taxBps: number;
  notes: string;
  lines: InvoicePdfLine[];
};

export type ReceiptPdfData = InvoicePdfData & {
  paymentDate: string;
  paidAmount: number;
  stillToPay: number;
  summary: string;
};

function money(minor: number, currency: string) {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

function formatDisplayDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    return iso;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function totals(invoice: InvoicePdfData) {
  const subtotal = invoice.lines.reduce(
    (sum, line) =>
      sum +
      lineTotal({
        quantity: line.quantity,
        unitAmount: line.unitAmount,
        discountAmount: line.discountAmount,
      }),
    0
  );
  const tax = Math.round((subtotal * invoice.taxBps) / 10000);
  return { subtotal, tax, total: subtotal + tax };
}

function BrandHeader({ brandName }: { brandName: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.brand}>{brandName}</Text>
    </View>
  );
}

function LinesTable({ invoice }: { invoice: InvoicePdfData }) {
  return (
    <View>
      <View style={styles.tableHeader}>
        <Text style={[styles.th, styles.colDesc]}>Description</Text>
        <Text style={[styles.th, styles.colCat]}>Category</Text>
        <Text style={[styles.th, styles.colQty]}>Qty</Text>
        <Text style={[styles.th, styles.colUnit]}>Unit</Text>
        <Text style={[styles.th, styles.colDisc]}>Discount</Text>
        <Text style={[styles.th, styles.colAmt]}>Amount</Text>
      </View>
      {invoice.lines.map((line, index) => {
        const amount = lineTotal({
          quantity: line.quantity,
          unitAmount: line.unitAmount,
          discountAmount: line.discountAmount,
        });
        return (
          <View key={`${line.description}-${index}`} style={styles.tableRow}>
            <Text style={[styles.td, styles.colDesc]}>{line.description}</Text>
            <Text style={[styles.td, styles.colCat]}>{line.categoryName || "—"}</Text>
            <Text style={[styles.td, styles.colQty]}>{line.quantity}</Text>
            <Text style={[styles.td, styles.colUnit]}>
              {money(line.unitAmount, invoice.currency)}
            </Text>
            <Text style={[styles.td, styles.colDisc]}>
              {line.discountAmount > 0 ? money(line.discountAmount, invoice.currency) : "—"}
            </Text>
            <Text style={[styles.td, styles.colAmt]}>{money(amount, invoice.currency)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function TotalsBlock({
  invoice,
  extra,
}: {
  invoice: InvoicePdfData;
  extra?: { label: string; value: string; bold?: boolean }[];
}) {
  const { subtotal, tax, total } = totals(invoice);
  return (
    <View style={styles.totals}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Subtotal</Text>
        <Text style={styles.totalValue}>{money(subtotal, invoice.currency)}</Text>
      </View>
      {invoice.taxBps > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tax ({(invoice.taxBps / 100).toFixed(2)}%)</Text>
          <Text style={styles.totalValue}>{money(tax, invoice.currency)}</Text>
        </View>
      ) : null}
      <View style={styles.totalRow}>
        <Text style={styles.grandLabel}>Invoice total</Text>
        <Text style={styles.grandValue}>{money(total, invoice.currency)}</Text>
      </View>
      {extra?.map((row) => (
        <View key={row.label} style={styles.totalRow}>
          <Text style={row.bold ? styles.grandLabel : styles.totalLabel}>{row.label}</Text>
          <Text style={row.bold ? styles.grandValue : styles.totalValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function InvoiceDocument({ invoice }: { invoice: InvoicePdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <BrandHeader brandName={invoice.brandName} />
        <Text style={styles.docTitle}>Invoice</Text>
        <View style={styles.titleRule} />
        <Text style={styles.docDate}>{formatDisplayDate(invoice.issueDate)}</Text>

        <View style={styles.parties}>
          <View>
            <Text style={styles.partyLabel}>Bill to</Text>
            <Text style={styles.partyName}>{invoice.customerName}</Text>
            <Text style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>
              Due {formatDisplayDate(invoice.dueDate)}
            </Text>
          </View>
          <View style={styles.partyRight}>
            <Text style={styles.partyLabel}>Invoice #</Text>
            <Text style={styles.partyNumber}>{invoice.number}</Text>
            <Text style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{invoice.status}</Text>
          </View>
        </View>

        <LinesTable invoice={invoice} />
        <TotalsBlock invoice={invoice} />

        {invoice.notes ? <Text style={styles.notes}>Notes: {invoice.notes}</Text> : null}
      </Page>
    </Document>
  );
}

export function ReceiptDocument({ receipt }: { receipt: ReceiptPdfData }) {
  const { total } = totals(receipt);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <BrandHeader brandName={receipt.brandName} />
        <Text style={styles.docTitle}>Receipt</Text>
        <View style={styles.titleRule} />
        <Text style={styles.docDate}>{formatDisplayDate(receipt.paymentDate)}</Text>

        <View style={styles.parties}>
          <View>
            <Text style={styles.partyLabel}>Received from</Text>
            <Text style={styles.partyName}>{receipt.customerName}</Text>
          </View>
          <View style={styles.partyRight}>
            <Text style={styles.partyLabel}>Receipt #</Text>
            <Text style={styles.partyNumber}>{receipt.number}</Text>
            <Text style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>
              Invoice {receipt.status}
            </Text>
          </View>
        </View>

        <View style={styles.payPanel}>
          <Text style={styles.payLabel}>Payment received</Text>
          <Text style={styles.paySummary}>{receipt.summary}</Text>
          <Text style={styles.payAmount}>{money(receipt.paidAmount, receipt.currency)}</Text>
        </View>

        <LinesTable invoice={receipt} />
        <TotalsBlock
          invoice={receipt}
          extra={[
            {
              label: "This payment",
              value: money(receipt.paidAmount, receipt.currency),
              bold: true,
            },
            ...(receipt.stillToPay > 0
              ? [
                  {
                    label: "Still to pay",
                    value: money(receipt.stillToPay, receipt.currency),
                    bold: true,
                  },
                ]
              : []),
          ]}
        />

        {receipt.stillToPay > 0 ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              Paid {money(receipt.paidAmount, receipt.currency)} of{" "}
              {money(total, receipt.currency)}. Still to pay{" "}
              {money(receipt.stillToPay, receipt.currency)}.
            </Text>
          </View>
        ) : null}

        {receipt.notes ? <Text style={styles.notes}>Notes: {receipt.notes}</Text> : null}
      </Page>
    </Document>
  );
}
