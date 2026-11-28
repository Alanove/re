import { MoneyPlacesManager } from "@/components/money-places-forms";
import { listMoneyPlaceBalances } from "@/lib/money-places";
import { requireAdult } from "@/lib/session";

export default async function SettingsPlacesPage() {
  const { member } = await requireAdult();
  const places = await listMoneyPlaceBalances(member.householdId);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Money places</h1>
        <p className="text-sm text-muted">
          Your own account is the default for money in and out. Add banks, wallets, or cash held
          with someone when you need them.
        </p>
      </header>

      <MoneyPlacesManager
        places={places}
        currency={member.household.displayCurrency || member.household.currency}
      />
    </div>
  );
}
