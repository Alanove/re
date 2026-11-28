import { PersonDebtCard } from "@/components/person-debt-card";
import { listMoneyPlaceBalances } from "@/lib/money-places";
import { openDebts } from "@/lib/money-service";
import { requireAdult } from "@/lib/session";

export default async function PlanDebtsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { member } = await requireAdult();
  const params = searchParams ? await searchParams : {};
  const currency = member.household.booksCurrency || member.household.currency;
  const [debts, moneyPlaces] = await Promise.all([
    openDebts(member.householdId),
    listMoneyPlaceBalances(member.householdId),
  ]);
  const defaultPlaceId =
    moneyPlaces.find((place) => place.memberId === member.id)?.id ?? moneyPlaces[0]?.id;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">People you owe</h1>
        <p className="text-sm text-muted">
          One balance per person. Add when you borrow more, settle when you pay them back.
        </p>
      </header>

      {params.error ? (
        <p className="rounded-2xl border border-line bg-card p-3 text-sm text-short-text">
          {params.error}
        </p>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-2">
        {debts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card/60 p-4 text-sm text-muted">
            Nothing outstanding
          </div>
        ) : (
          debts.map((debt) => (
            <PersonDebtCard
              key={debt.id}
              debt={debt}
              currency={currency}
              next="/plan/debts"
              places={moneyPlaces}
              defaultPlaceId={defaultPlaceId}
              detailed
            />
          ))
        )}
      </section>
    </div>
  );
}
