import Link from "next/link";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { requireAdult } from "@/lib/session";
import { todayIsoDate } from "@/lib/utils";
import { whatsappRenewalUrl } from "@/lib/whatsapp";

export default async function WorkRenewalsPage() {
  const { member } = await requireAdult();
  const currency = member.household.currency;
  const today = todayIsoDate();

  const customers = await prisma.customer.findMany({
    where: { householdId: member.householdId },
    include: { services: { orderBy: { renewalDate: "asc" } } },
    orderBy: { name: "asc" },
  });

  const renewals = customers
    .flatMap((customer) =>
      customer.services.map((service) => ({ customer, service }))
    )
    .sort((a, b) => a.service.renewalDate.localeCompare(b.service.renewalDate));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Renewals</h1>
        <p className="text-sm text-muted">Upcoming domain, email, and hosting renewals.</p>
      </header>

      <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {renewals.length === 0 ? (
          <Empty hint="Add a customer and a renewal service" />
        ) : (
          renewals.map(({ customer, service }) => {
            const remindFrom = new Date(service.renewalDate);
            remindFrom.setDate(remindFrom.getDate() - service.remindDays);
            const remindIso = remindFrom.toISOString().slice(0, 10);
            const dueSoon = today >= remindIso;
            const wa = whatsappRenewalUrl(
              customer.phone,
              customer.name,
              service.name,
              service.renewalDate,
              service.price,
              currency
            );
            return (
              <div
                key={service.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 shadow-card"
              >
                <div>
                  <p className="font-medium">
                    {customer.name} · {service.name}
                  </p>
                  <p className="text-sm text-muted">
                    {service.kind} · renews {service.renewalDate} ·{" "}
                    {formatMoney(service.price, currency)}
                    {dueSoon ? " · remind now" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <a href={wa} target="_blank" rel="noreferrer">
                      Send WhatsApp
                    </a>
                  </Button>
                  <Button asChild size="sm">
                    <Link
                      href={`/work/invoices?invoiceCustomer=${customer.id}&serviceId=${service.id}#new-invoice`}
                    >
                      Invoice
                    </Link>
                  </Button>
                </div>
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
