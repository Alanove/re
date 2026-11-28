import {
  archiveLoanAction,
  createLoanAction,
  markLoanPaidAction,
  updateLoanAction,
} from "@/app/actions/plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { formatMoney, fromMinorUnits, monthsUntil } from "@/lib/money";
import { requireAdult } from "@/lib/session";
import { addMonths, currentMonth } from "@/lib/utils";

export default async function PlanLoansPage() {
  const { member } = await requireAdult();
  const currency = member.household.currency;
  const month = currentMonth();

  const loans = await prisma.loan.findMany({
    where: { householdId: member.householdId, archivedAt: null },
    include: { payments: true },
    orderBy: { startMonth: "asc" },
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Loans</h1>
        <p className="text-sm text-muted">Apartment and other monthly loan payments.</p>
      </header>

      <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {loans.length === 0 ? (
          <Empty hint="Add your apartment loan" />
        ) : (
          loans.map((loan) => {
            const paidMonths = new Set(loan.payments.map((row) => row.month));
            let nextDue = loan.startMonth < month ? month : loan.startMonth;
            while (nextDue <= loan.endMonth && paidMonths.has(nextDue)) {
              nextDue = addMonths(nextDue, 1);
            }
            const monthsLeft =
              nextDue > loan.endMonth ? 0 : monthsUntil(nextDue, loan.endMonth) + 1;
            const remaining = monthsLeft * loan.monthlyAmount;
            return (
              <div key={loan.id} className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{loan.name}</p>
                    <p className="text-sm text-muted">
                      {formatMoney(loan.monthlyAmount, currency)} / month · next {nextDue} ·{" "}
                      {monthsLeft} months left · {formatMoney(remaining, currency)} remaining
                    </p>
                  </div>
                  {monthsLeft > 0 && nextDue === month && (
                    <form action={markLoanPaidAction}>
                      <input type="hidden" name="loanId" value={loan.id} />
                      <input type="hidden" name="month" value={month} />
                      <Button size="sm" type="submit">
                        Mark paid
                      </Button>
                    </form>
                  )}
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted">Edit</summary>
                  <form action={updateLoanAction} className="mt-2 grid gap-2">
                    <input type="hidden" name="loanId" value={loan.id} />
                    <Input name="name" defaultValue={loan.name} required />
                    <Input
                      name="monthlyAmount"
                      defaultValue={String(fromMinorUnits(loan.monthlyAmount))}
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input name="startMonth" type="month" defaultValue={loan.startMonth} required />
                      <Input name="endMonth" type="month" defaultValue={loan.endMonth} required />
                    </div>
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                  </form>
                  <form action={archiveLoanAction} className="mt-2">
                    <input type="hidden" name="loanId" value={loan.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Archive
                    </Button>
                  </form>
                </details>
              </div>
            );
          })
        )}
        <form action={createLoanAction} className="grid max-w-lg gap-2 rounded-2xl border border-dashed border-line p-4 lg:col-span-full">
          <Label>New loan</Label>
          <Input name="name" placeholder="Apartment" required />
          <Input name="monthlyAmount" placeholder="Monthly amount" required />
          <div className="grid grid-cols-2 gap-2">
            <Input name="startMonth" type="month" required />
            <Input name="endMonth" type="month" required />
          </div>
          <Button type="submit">Add loan</Button>
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
