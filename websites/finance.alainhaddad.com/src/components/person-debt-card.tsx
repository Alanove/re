import {
  addBorrowedFormAction,
  deleteDebtEntryFormAction,
  repayDebtFormAction,
} from "@/app/actions/money";
import { MoneyPlaceSelect, type MoneyPlaceOption } from "@/components/money-place-select";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import type { OpenDebtView } from "@/lib/money-service";

const kindLabel: Record<string, string> = {
  BORROW: "Borrowed",
  REPAY: "Settled",
  INTEREST: "Interest",
};

export function PersonDebtCard({
  debt,
  currency,
  next,
  places,
  defaultPlaceId,
  detailed = false,
}: {
  debt: OpenDebtView;
  currency: string;
  next: string;
  places: MoneyPlaceOption[];
  defaultPlaceId?: string;
  detailed?: boolean;
}) {
  const borrows = debt.entries.filter((entry) => entry.kind === "BORROW");

  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <div className="flex flex-col gap-3">
        <div>
          <p className="font-medium">{debt.person}</p>
          <p className="text-sm text-muted">
            Originally {formatMoney(debt.borrowed, currency)}
            {debt.interest > 0 ? ` · interest ${formatMoney(debt.interest, currency)}` : ""}
            {debt.settled > 0 ? ` · settled ${formatMoney(debt.settled, currency)}` : ""}
          </p>
          <p className="tabular text-sm font-medium">{formatMoney(debt.left, currency)} left</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <form action={addBorrowedFormAction} className="flex flex-col gap-2">
            <input type="hidden" name="person" value={debt.person} />
            <input type="hidden" name="next" value={next} />
            <MoneyPlaceSelect
              places={places}
              defaultPlaceId={defaultPlaceId}
              currency={currency}
              label="Into"
              className="min-w-[10rem]"
            />
            <div className="flex items-center gap-2">
              <input
                name="amount"
                inputMode="decimal"
                required
                placeholder="Add"
                aria-label={`Borrow more from ${debt.person}`}
                className="h-9 w-24 rounded-xl border border-line bg-card px-2 text-sm tabular"
              />
              <Button size="sm" type="submit">
                Add
              </Button>
            </div>
          </form>
          <form action={repayDebtFormAction} className="flex flex-col gap-2">
            <input type="hidden" name="debtId" value={debt.id} />
            <input type="hidden" name="next" value={next} />
            <MoneyPlaceSelect
              places={places}
              defaultPlaceId={defaultPlaceId}
              currency={currency}
              label="From"
              className="min-w-[10rem]"
            />
            <div className="flex items-center gap-2">
              <input
                name="amount"
                inputMode="decimal"
                required
                placeholder={(debt.left / 100).toFixed(2)}
                aria-label={`Settle ${debt.person}`}
                className="h-9 w-24 rounded-xl border border-line bg-card px-2 text-sm tabular"
              />
              <Button size="sm" type="submit" variant="secondary">
                Settle
              </Button>
            </div>
          </form>
        </div>
      </div>
      {detailed && (
        <ul className="mt-3 space-y-2 border-t border-line pt-3">
          {debt.entries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p>
                  {entry.date} · {kindLabel[entry.kind] ?? entry.kind} ·{" "}
                  {formatMoney(entry.amount, currency)}
                </p>
                <p className="text-muted">
                  Balance after {formatMoney(entry.balanceAfter, currency)}
                  {entry.note ? ` · ${entry.note}` : ""}
                </p>
              </div>
              {entry.kind === "BORROW" && (
                <form action={deleteDebtEntryFormAction}>
                  <input type="hidden" name="entryId" value={entry.id} />
                  <input type="hidden" name="next" value={next} />
                  <Button type="submit" size="sm" variant="ghost">
                    Delete
                  </Button>
                </form>
              )}
            </li>
          ))}
          {borrows.length === 0 && (
            <li className="text-sm text-muted">No borrow lines stored yet.</li>
          )}
        </ul>
      )}
    </div>
  );
}
