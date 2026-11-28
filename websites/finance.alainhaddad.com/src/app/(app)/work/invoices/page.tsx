import Link from "next/link";
import { voidInvoiceAction } from "@/app/actions/work";
import { InvoiceBuilder, RecordPaymentForm } from "@/components/invoice-builder";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import {
  invoiceRemainder,
  invoiceTotal,
  lineTotal,
  receiptCopy,
} from "@/lib/invoice";
import { formatMoney } from "@/lib/money";
import { seedBillableCategories } from "@/lib/seed-billable";
import { requireAdult } from "@/lib/session";
import { whatsappInvoiceUrl, whatsappReceiptUrl } from "@/lib/whatsapp";

export default async function WorkInvoicesPage({
  searchParams,
}: {
  searchParams?: Promise<{ invoiceCustomer?: string; serviceId?: string }>;
}) {
  const { member } = await requireAdult();
  await seedBillableCategories(member.householdId);

  const currency = member.household.currency;
  const params = searchParams ? await searchParams : {};

  const [customers, invoices, businesses, billableCategories] = await Promise.all([
    prisma.customer.findMany({
      where: { householdId: member.householdId },
      include: { services: { orderBy: { renewalDate: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.invoice.findMany({
      where: { householdId: member.householdId },
      include: {
        customer: true,
        lines: { include: { category: true }, orderBy: { sortOrder: "asc" } },
        payments: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
      },
      orderBy: { issueDate: "desc" },
    }),
    prisma.business.findMany({
      where: { householdId: member.householdId },
      orderBy: { name: "asc" },
    }),
    prisma.billableCategory.findMany({
      where: { householdId: member.householdId },
      orderBy: { name: "asc" },
    }),
  ]);

  const renewals = customers.flatMap((customer) =>
    customer.services.map((service) => ({ customer, service }))
  );

  const openInvoices = invoices.filter((invoice) =>
    ["UNPAID", "PARTIAL"].includes(invoice.status)
  );

  const presetService =
    params.serviceId
      ? renewals.find(({ service }) => service.id === params.serviceId)?.service
      : null;
  const presetCategory =
    presetService &&
    billableCategories.find(
      (row) =>
        row.name.toLowerCase() === presetService.kind.toLowerCase() ||
        (presetService.kind === "EMAIL" && row.name.toLowerCase().includes("email")) ||
        (presetService.kind === "DOMAIN" && row.name.toLowerCase() === "domain") ||
        (presetService.kind === "HOSTING" && row.name.toLowerCase() === "hosting")
    );

  const builderInitialLines = presetService
    ? [
        {
          description: presetService.name,
          categoryId: presetCategory?.id ?? null,
          quantity: 1,
          unitAmount: presetService.price,
          discountAmount: 0,
        },
      ]
    : undefined;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="text-sm text-muted">Create invoices and collect open balances.</p>
      </header>

      <section id="new-invoice" className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">New invoice</h2>
        <InvoiceBuilder
          customers={customers.map((customer) => ({ id: customer.id, name: customer.name }))}
          businesses={businesses}
          categories={billableCategories}
          currency={currency}
          initialCustomerId={params.invoiceCustomer}
          initialLines={builderInitialLines}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Open invoices</h2>
        {openInvoices.length === 0 ? (
          <Empty hint="Create an invoice from a renewal or from scratch" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {openInvoices.map((invoice) => {
            const total = invoiceTotal(invoice.lines, invoice.taxBps);
            const remainder = invoiceRemainder(invoice.lines, invoice.taxBps, invoice.payments);
            const canEdit = invoice.payments.length === 0;
            const wa = whatsappInvoiceUrl({
              phone: invoice.customer.phone,
              customerName: invoice.customer.name,
              invoiceNumber: invoice.number,
              totalMinor: total,
              currency,
              lines: invoice.lines.map((line) => ({
                description: line.description,
                quantity: line.quantity,
                lineTotal: lineTotal(line),
              })),
            });
            return (
              <div key={invoice.id} className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {invoice.number} · {invoice.customer.name}
                    </p>
                    <p className="text-sm text-muted">
                      {invoice.status} · {invoice.issueDate} · total{" "}
                      {formatMoney(total, currency)} · still owed{" "}
                      {formatMoney(remainder, currency)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <a href={wa} target="_blank" rel="noreferrer">
                        Send invoice
                      </a>
                    </Button>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/work/invoices/${invoice.id}/pdf`} target="_blank">
                        PDF
                      </Link>
                    </Button>
                    {canEdit ? (
                      <form action={voidInvoiceAction}>
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <Button size="sm" type="submit" variant="ghost">
                          Void
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>

                <ul className="space-y-1 text-sm text-muted">
                  {invoice.lines.map((line) => (
                    <li key={line.id}>
                      {line.description}
                      {line.category ? ` · ${line.category.name}` : ""} · qty {line.quantity} ·{" "}
                      {formatMoney(lineTotal(line), currency)}
                      {line.discountAmount > 0
                        ? ` (−${formatMoney(line.discountAmount, currency)})`
                        : ""}
                    </li>
                  ))}
                </ul>

                {invoice.payments.length > 0 ? (
                  <div className="space-y-2 border-t border-line pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Payments
                    </p>
                    {invoice.payments.map((payment) => {
                      const copy = receiptCopy({
                        lines: invoice.lines,
                        taxBps: invoice.taxBps,
                        payments: invoice.payments,
                        paymentId: payment.id,
                        currencyLabel: currency,
                      });
                      const receiptWa = copy
                        ? whatsappReceiptUrl({
                            phone: invoice.customer.phone,
                            customerName: invoice.customer.name,
                            invoiceNumber: invoice.number,
                            paidMinor: copy.paidAmount,
                            totalMinor: copy.invoiceTotal,
                            stillToPayMinor: copy.stillToPay,
                            currency,
                            summary: copy.summary,
                          })
                        : null;
                      return (
                        <div
                          key={payment.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface/70 px-3 py-2 text-sm"
                        >
                          <span>
                            {payment.date} · {formatMoney(payment.amount, currency)}
                            {copy?.isPartial ? " · partial" : " · settled"}
                          </span>
                          <div className="flex gap-2">
                            {receiptWa ? (
                              <Button asChild size="sm" variant="secondary">
                                <a href={receiptWa} target="_blank" rel="noreferrer">
                                  Send receipt
                                </a>
                              </Button>
                            ) : null}
                            <Button asChild size="sm" variant="secondary">
                              <Link href={`/work/payments/${payment.id}/receipt`} target="_blank">
                                Receipt PDF
                              </Link>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <RecordPaymentForm
                  invoiceId={invoice.id}
                  remainderMinor={remainder}
                  currency={currency}
                />

                {canEdit ? (
                  <details className="rounded-xl border border-line p-3">
                    <summary className="cursor-pointer text-sm font-medium">Edit lines</summary>
                    <div className="mt-3">
                      <InvoiceBuilder
                        mode="edit"
                        invoiceId={invoice.id}
                        customers={[{ id: invoice.customerId, name: invoice.customer.name }]}
                        businesses={businesses}
                        categories={billableCategories}
                        currency={currency}
                        initialCustomerId={invoice.customerId}
                        initialBusinessId={invoice.businessId ?? ""}
                        initialIssueDate={invoice.issueDate}
                        initialDueDate={invoice.dueDate}
                        initialNotes={invoice.notes}
                        initialLines={invoice.lines.map((line) => ({
                          description: line.description,
                          categoryId: line.categoryId,
                          quantity: line.quantity,
                          unitAmount: line.unitAmount,
                          discountAmount: line.discountAmount,
                        }))}
                      />
                    </div>
                  </details>
                ) : null}
              </div>
            );
          })}
          </div>
        )}
      </section>
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card/60 p-4 text-sm text-muted">
      {hint}
    </div>
  );
}
