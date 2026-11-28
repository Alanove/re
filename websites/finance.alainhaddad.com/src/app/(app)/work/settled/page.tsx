import Link from "next/link";
import { deleteInvoiceAction } from "@/app/actions/work";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { invoiceTotal, receiptCopy } from "@/lib/invoice";
import { formatMoney } from "@/lib/money";
import { requireAdult } from "@/lib/session";
import { whatsappReceiptUrl } from "@/lib/whatsapp";

export default async function WorkSettledPage() {
  const { member } = await requireAdult();
  const currency = member.household.currency;

  const invoices = await prisma.invoice.findMany({
    where: {
      householdId: member.householdId,
      status: { in: ["PAID", "VOID"] },
    },
    include: {
      customer: true,
      lines: true,
      payments: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
    },
    orderBy: { issueDate: "desc" },
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Paid and void</h1>
        <p className="text-sm text-muted">Settled invoices and receipt links.</p>
      </header>

      <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {invoices.length === 0 ? (
          <Empty hint="Settled invoices show here" />
        ) : (
          invoices.map((invoice) => {
            const total = invoiceTotal(invoice.lines, invoice.taxBps);
            return (
              <div key={invoice.id} className="rounded-2xl border border-line bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {invoice.number} · {invoice.customer.name}
                    </p>
                    <p className="text-sm text-muted">
                      {invoice.status} · {formatMoney(total, currency)}
                    </p>
                  </div>
                  {invoice.status === "VOID" ? (
                    <form action={deleteInvoiceAction}>
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        Remove
                      </Button>
                    </form>
                  ) : null}
                </div>
                {invoice.payments.length > 0 ? (
                  <div className="mt-3 space-y-2">
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
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <span>
                            {payment.date} · {formatMoney(payment.amount, currency)}
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
              </div>
            );
          })
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
