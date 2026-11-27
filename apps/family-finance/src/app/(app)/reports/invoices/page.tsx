import { InvoiceCharts } from "@/components/reports-detail-charts";
import { ReportRangeBar } from "@/components/report-range-bar";
import { prisma } from "@/lib/db";
import { invoiceRemainder, invoiceTotal } from "@/lib/invoice";
import { formatMoney } from "@/lib/money";
import {
  defaultReportMonthKeys,
  monthKeysFromDates,
  monthsForReportRange,
  prismaIssueDateFilter,
} from "@/lib/report-range";
import { resolveReportPageRange, type ReportPageSearch } from "@/lib/report-page";
import { invoiceMonthlyTotals } from "@/lib/reports";
import { requireAdult } from "@/lib/session";

export default async function InvoicesReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportPageSearch>;
}) {
  const { member } = await requireAdult();
  const params = await searchParams;
  const currency = member.household.booksCurrency || member.household.currency;
  const resolved = resolveReportPageRange(params);

  const invoices = await prisma.invoice.findMany({
    where: {
      householdId: member.householdId,
      status: { not: "VOID" },
      ...prismaIssueDateFilter(resolved.start, resolved.end),
    },
    include: {
      customer: true,
      lines: true,
      payments: true,
    },
  });

  let invoiced = 0;
  let collected = 0;
  const outstandingByCustomer = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  const invoiceRows: { issueDate: string; total: number; paid: number }[] = [];
  for (const invoice of invoices) {
    const total = invoiceTotal(invoice.lines, invoice.taxBps);
    const paid = invoice.payments.reduce((sum, row) => sum + row.amount, 0);
    const remainder = invoiceRemainder(invoice.lines, invoice.taxBps, invoice.payments);
    invoiced += total;
    collected += paid;
    statusCounts.set(invoice.status, (statusCounts.get(invoice.status) ?? 0) + 1);
    if (remainder > 0) {
      outstandingByCustomer.set(
        invoice.customer.name,
        (outstandingByCustomer.get(invoice.customer.name) ?? 0) + remainder
      );
    }
    invoiceRows.push({
      issueDate: invoice.issueDate,
      total,
      paid,
    });
  }

  const rangedMonths = monthsForReportRange(resolved.start, resolved.end);
  const monthKeys =
    rangedMonths.length > 0
      ? rangedMonths
      : monthKeysFromDates(invoiceRows.map((row) => row.issueDate));
  const keys = monthKeys.length > 0 ? monthKeys : defaultReportMonthKeys();

  const byCustomer = Array.from(outstandingByCustomer.entries())
    .map(([name, amount]) => ({ name, amount: amount / 100 }))
    .sort((a, b) => b.amount - a.amount);
  const byMonth = invoiceMonthlyTotals(keys, invoiceRows).map((row) => ({
    month: row.month,
    invoiced: row.invoiced / 100,
    collected: row.collected / 100,
  }));
  const byStatus = Array.from(statusCounts.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-sm text-muted">
            Invoiced, collected, and outstanding for the selected issue dates.
          </p>
        </div>
        <ReportRangeBar range={resolved.range} from={resolved.from} to={resolved.to} />
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Invoiced" value={formatMoney(invoiced, currency)} />
        <SummaryCard label="Collected" value={formatMoney(collected, currency)} />
        <SummaryCard
          label="Outstanding"
          value={formatMoney(Math.max(0, invoiced - collected), currency)}
        />
      </section>

      <InvoiceCharts
        currency={currency}
        byCustomer={byCustomer}
        byMonth={byMonth}
        byStatus={byStatus}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
