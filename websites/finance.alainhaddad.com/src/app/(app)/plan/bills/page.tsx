import {
  archiveBillAction,
  createBillAction,
  markBillPaidAction,
  updateBillAction,
} from "@/app/actions/plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { formatMoney, fromMinorUnits } from "@/lib/money";
import { unpaidBillsThisMonth } from "@/lib/money-service";
import { requireAdult } from "@/lib/session";
import { currentMonth } from "@/lib/utils";

export default async function PlanBillsPage() {
  const { member } = await requireAdult();
  const currency = member.household.currency;
  const month = currentMonth();

  const [bills, unpaidBills, categories] = await Promise.all([
    prisma.bill.findMany({
      where: { householdId: member.householdId, archivedAt: null },
      include: { category: true, payments: { where: { month } } },
      orderBy: { name: "asc" },
    }),
    unpaidBillsThisMonth(member.householdId, month),
    prisma.category.findMany({
      where: { householdId: member.householdId },
      orderBy: { name: "asc" },
    }),
  ]);

  const unpaidBillIds = new Set(unpaidBills.map((row) => row.id));
  const spendCategories = categories.filter((row) => !row.excludeFromSpending);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Bills</h1>
        <p className="text-sm text-muted">Rent, school, internet, and other monthly bills.</p>
      </header>

      <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {bills.length === 0 ? (
          <Empty hint="Add rent, school, internet, or other monthly bills" />
        ) : (
          bills.map((bill) => {
            const unpaid = unpaidBillIds.has(bill.id);
            return (
              <div key={bill.id} className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{bill.name}</p>
                    <p className="text-sm text-muted">
                      {formatMoney(bill.amount, currency)} · due day {bill.dueDay}
                      {bill.category ? ` · ${bill.category.name}` : ""}
                      {bill.endMonth ? ` · ends ${bill.endMonth}` : ""}
                      {unpaid ? " · unpaid this month" : " · paid this month"}
                    </p>
                  </div>
                  {unpaid && (
                    <form action={markBillPaidAction}>
                      <input type="hidden" name="billId" value={bill.id} />
                      <input type="hidden" name="month" value={month} />
                      <Button size="sm" type="submit">
                        Mark paid
                      </Button>
                    </form>
                  )}
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted">Edit</summary>
                  <form action={updateBillAction} className="mt-2 grid gap-2">
                    <input type="hidden" name="billId" value={bill.id} />
                    <div className="space-y-1">
                      <Label htmlFor={`bill-name-${bill.id}`}>Name</Label>
                      <Input
                        id={`bill-name-${bill.id}`}
                        name="name"
                        defaultValue={bill.name}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`bill-amount-${bill.id}`}>Amount</Label>
                      <Input
                        id={`bill-amount-${bill.id}`}
                        name="amount"
                        defaultValue={String(fromMinorUnits(bill.amount))}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`bill-due-${bill.id}`}>Due day of month</Label>
                      <Input
                        id={`bill-due-${bill.id}`}
                        name="dueDay"
                        type="number"
                        min={1}
                        max={31}
                        defaultValue={String(bill.dueDay)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`bill-category-${bill.id}`}>Category</Label>
                      <select
                        id={`bill-category-${bill.id}`}
                        name="categoryId"
                        className="h-11 w-full rounded-xl border border-line bg-card px-3"
                        defaultValue={bill.categoryId ?? ""}
                      >
                        <option value="">Default (Home)</option>
                        {spendCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`bill-end-${bill.id}`}>End month (optional)</Label>
                      <Input
                        id={`bill-end-${bill.id}`}
                        name="endMonth"
                        type="month"
                        defaultValue={bill.endMonth ?? ""}
                      />
                      <p className="text-xs text-muted">Leave blank if the bill has no end date.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" size="sm">
                        Save
                      </Button>
                    </div>
                  </form>
                  <form action={archiveBillAction} className="mt-2">
                    <input type="hidden" name="billId" value={bill.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Archive
                    </Button>
                  </form>
                </details>
              </div>
            );
          })
        )}
        <form action={createBillAction} className="grid max-w-lg gap-2 rounded-2xl border border-dashed border-line p-4 lg:col-span-full">
          <p className="text-sm font-medium">New bill</p>
          <div className="space-y-1">
            <Label htmlFor="new-bill-name">Name</Label>
            <Input id="new-bill-name" name="name" placeholder="Rent" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-bill-amount">Amount</Label>
            <Input id="new-bill-amount" name="amount" placeholder="40.00" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-bill-due">Due day of month</Label>
            <Input
              id="new-bill-due"
              name="dueDay"
              type="number"
              min={1}
              max={31}
              placeholder="10"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-bill-category">Category</Label>
            <select
              id="new-bill-category"
              name="categoryId"
              className="h-11 w-full rounded-xl border border-line bg-card px-3"
              defaultValue=""
            >
              <option value="">Default (Home)</option>
              {spendCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-bill-end">End month (optional)</Label>
            <Input id="new-bill-end" name="endMonth" type="month" />
            <p className="text-xs text-muted">Leave blank if the bill has no end date.</p>
          </div>
          <Button type="submit">Add bill</Button>
        </form>
      </section>
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card/60 p-4 text-sm text-muted lg:col-span-full">
      {hint}
    </div>
  );
}
