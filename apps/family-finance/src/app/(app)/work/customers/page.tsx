import {
  createCustomerAction,
  createServiceAction,
  deleteCustomerAction,
  updateCustomerAction,
} from "@/app/actions/work";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { customerBalance } from "@/lib/invoice";
import { formatMoney } from "@/lib/money";
import { requireAdult } from "@/lib/session";

export default async function WorkCustomersPage() {
  const { member } = await requireAdult();
  const currency = member.household.currency;

  const [customers, invoices] = await Promise.all([
    prisma.customer.findMany({
      where: { householdId: member.householdId },
      include: {
        services: { orderBy: { renewalDate: "asc" } },
        _count: { select: { invoices: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.invoice.findMany({
      where: { householdId: member.householdId },
      include: {
        lines: true,
        payments: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-muted">People and companies you invoice, with their services.</p>
      </header>

      <section className="space-y-3">
        {customers.map((customer) => {
          const balance = customerBalance(
            invoices
              .filter((invoice) => invoice.customerId === customer.id)
              .map((invoice) => ({
                status: invoice.status,
                taxBps: invoice.taxBps,
                lines: invoice.lines,
                payments: invoice.payments,
              }))
          );
          const canRemove = customer._count.invoices === 0;
          return (
            <div key={customer.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-sm text-muted">
                    {[customer.phone, customer.email].filter(Boolean).join(" · ") ||
                      "No contact yet"}
                  </p>
                  {customer.note ? (
                    <p className="mt-1 text-sm text-muted">{customer.note}</p>
                  ) : null}
                </div>
                <p className={`text-sm font-medium ${balance < 0 ? "text-short" : "text-muted"}`}>
                  Balance {formatMoney(balance, currency)}
                </p>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {customer.services.map((service) => (
                  <li key={service.id}>
                    {service.name} · {service.renewalDate} ·{" "}
                    {formatMoney(service.price, currency)}
                  </li>
                ))}
              </ul>

              <details className="mt-3 border-t border-line pt-3 text-sm">
                <summary className="cursor-pointer text-muted">Edit customer</summary>
                <form action={updateCustomerAction} className="mt-2 grid gap-2">
                  <input type="hidden" name="customerId" value={customer.id} />
                  <div className="space-y-1">
                    <Label htmlFor={`customer-name-${customer.id}`}>Name</Label>
                    <Input
                      id={`customer-name-${customer.id}`}
                      name="name"
                      defaultValue={customer.name}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`customer-phone-${customer.id}`}>
                      WhatsApp phone
                    </Label>
                    <Input
                      id={`customer-phone-${customer.id}`}
                      name="phone"
                      defaultValue={customer.phone}
                      placeholder="With country code"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`customer-email-${customer.id}`}>Email</Label>
                    <Input
                      id={`customer-email-${customer.id}`}
                      name="email"
                      type="email"
                      defaultValue={customer.email}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`customer-note-${customer.id}`}>Note</Label>
                    <Input
                      id={`customer-note-${customer.id}`}
                      name="note"
                      defaultValue={customer.note}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                  </div>
                </form>
                {canRemove ? (
                  <form action={deleteCustomerAction} className="mt-2">
                    <input type="hidden" name="customerId" value={customer.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Remove customer
                    </Button>
                  </form>
                ) : (
                  <p className="mt-2 text-xs text-muted">
                    Has invoices — remove is blocked so billing history stays intact.
                  </p>
                )}
              </details>

              <form action={createServiceAction} className="mt-3 grid gap-2 border-t border-line pt-3">
                <input type="hidden" name="customerId" value={customer.id} />
                <Label>Add service</Label>
                <Input name="name" placeholder="Hosting" required />
                <div className="grid grid-cols-2 gap-2">
                  <select name="kind" className="h-11 rounded-xl border border-line bg-white px-3">
                    <option value="DOMAIN">Domain</option>
                    <option value="EMAIL">Email</option>
                    <option value="HOSTING">Hosting</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <Input name="price" placeholder="Price" required />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input name="renewalDate" type="date" required />
                  <Input name="remindDays" type="number" defaultValue={14} />
                </div>
                <Button type="submit" size="sm">
                  Add service
                </Button>
              </form>
            </div>
          );
        })}
        <form action={createCustomerAction} className="grid gap-2 rounded-2xl border border-dashed border-line p-4">
          <Label>New customer</Label>
          <Input name="name" placeholder="Name" required />
          <Input name="phone" placeholder="WhatsApp phone with country code" />
          <Input name="email" placeholder="Email" />
          <Input name="note" placeholder="Note" />
          <Button type="submit">Add customer</Button>
        </form>
      </section>
    </div>
  );
}
