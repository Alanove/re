import { archiveDebtAction } from "@/app/actions/plan";
import { repayDebtFormAction } from "@/app/actions/money";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { openDebts } from "@/lib/money-service";
import { requireAdult } from "@/lib/session";

export default async function PlanDebtsPage() {
  const { member } = await requireAdult();
  const currency = member.household.currency;
  const debts = await openDebts(member.householdId);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">People you owe</h1>
        <p className="text-sm text-muted">Outstanding personal debts and pay-backs.</p>
      </header>

      <section className="space-y-3">
        {debts.length === 0 ? (
          <Empty hint="Nothing outstanding" />
        ) : (
          debts.map((debt) => {
            const remaining = debt.amount - debt.repaid;
            return (
              <div key={debt.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{debt.person}</p>
                    <p className="text-sm text-muted">{formatMoney(remaining, currency)} left</p>
                  </div>
                  <form action={repayDebtFormAction} className="flex items-center gap-2">
                    <input type="hidden" name="debtId" value={debt.id} />
                    <input
                      name="amount"
                      inputMode="decimal"
                      required
                      placeholder={(remaining / 100).toFixed(2)}
                      className="h-9 w-24 rounded-xl border border-line bg-white px-2 text-sm tabular"
                      aria-label={`Pay back ${debt.person}`}
                    />
                    <Button size="sm" type="submit">
                      Pay back
                    </Button>
                  </form>
                </div>
                {remaining <= 0 && (
                  <form action={archiveDebtAction} className="mt-2">
                    <input type="hidden" name="debtId" value={debt.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Archive
                    </Button>
                  </form>
                )}
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
    <div className="rounded-2xl border border-dashed border-line bg-white/60 p-4 text-sm text-muted">
      {hint}
    </div>
  );
}
