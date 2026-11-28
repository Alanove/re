import {
  archiveForecastAction,
  createForecastAction,
  updateForecastAction,
} from "@/app/actions/plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { formatMoney, forecastAdvice, fromMinorUnits } from "@/lib/money";
import { usualLeftover } from "@/lib/money-service";
import { requireAdult } from "@/lib/session";
import { currentMonth } from "@/lib/utils";

export default async function PlanForecastsPage() {
  const { member } = await requireAdult();
  const currency = member.household.currency;
  const month = currentMonth();

  const [forecasts, savingsAccounts, recentLeft] = await Promise.all([
    prisma.forecast.findMany({
      where: { householdId: member.householdId, archivedAt: null },
      include: { savingsAccount: true },
      orderBy: { month: "asc" },
    }),
    prisma.savingsAccount.findMany({
      where: { householdId: member.householdId },
      orderBy: { name: "asc" },
    }),
    usualLeftover(member.householdId, month),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Future costs</h1>
        <p className="text-sm text-muted">Upcoming costs to set money aside for.</p>
      </header>

      <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {forecasts.length === 0 ? (
          <Empty hint="Add a future cost to save toward" />
        ) : (
          forecasts.map((forecast) => {
            const advice = forecastAdvice({
              name: forecast.name,
              amount: forecast.amount,
              month: forecast.month,
              asOfMonth: month,
              recentLeft,
            });
            return (
              <div key={forecast.id} className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card">
                <p className="font-medium">
                  {forecast.name} · {formatMoney(forecast.amount, currency)} · {forecast.month}
                </p>
                {forecast.savingsAccount && (
                  <p className="text-sm text-muted">
                    Funds {forecast.savingsAccount.name}
                  </p>
                )}
                <p className="text-sm text-muted">{advice.sentence}</p>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted">Edit</summary>
                  <form action={updateForecastAction} className="mt-2 grid gap-2">
                    <input type="hidden" name="forecastId" value={forecast.id} />
                    <Input name="name" defaultValue={forecast.name} required />
                    <Input
                      name="amount"
                      defaultValue={String(fromMinorUnits(forecast.amount))}
                      required
                    />
                    <Input name="month" type="month" defaultValue={forecast.month} required />
                    <select
                      name="savingsAccountId"
                      className="h-11 rounded-xl border border-line bg-card px-3"
                      defaultValue={forecast.savingsAccountId ?? ""}
                    >
                      <option value="">No savings pot</option>
                      {savingsAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                  </form>
                  <form action={archiveForecastAction} className="mt-2">
                    <input type="hidden" name="forecastId" value={forecast.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Archive
                    </Button>
                  </form>
                </details>
              </div>
            );
          })
        )}
        <form action={createForecastAction} className="grid max-w-lg gap-2 rounded-2xl border border-dashed border-line p-4 lg:col-span-full">
          <Label>New forecast</Label>
          <Input name="name" placeholder="Kid's birthday" required />
          <Input name="amount" placeholder="Amount" required />
          <Input name="month" type="month" required />
          <select name="savingsAccountId" className="h-11 rounded-xl border border-line bg-card px-3" defaultValue="">
            <option value="">Savings pot (optional)</option>
            {savingsAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <Button type="submit">Add forecast</Button>
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
