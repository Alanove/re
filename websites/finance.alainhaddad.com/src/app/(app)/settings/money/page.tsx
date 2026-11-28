import { CurrencySettingsForm, FxRateForm } from "@/components/savings-forms";
import { prisma } from "@/lib/db";
import { requireAdult } from "@/lib/session";

export default async function SettingsMoneyPage() {
  const { member } = await requireAdult();
  const books = member.household.booksCurrency || member.household.currency;

  const rates = await prisma.fxRate.findMany({
    where: { householdId: member.householdId },
  });

  const lbpUsd =
    rates.find((row) => row.fromCurrency === "LBP" && row.toCurrency === "USD") ??
    rates[0] ??
    null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Money settings</h1>
        <p className="text-sm text-muted">Books currency and exchange rates.</p>
      </header>

      <section className="space-y-3">
        <CurrencySettingsForm
          booksCurrency={member.household.booksCurrency}
          displayCurrency={member.household.displayCurrency}
          entryCurrency={member.household.entryCurrency}
        />
        <FxRateForm
          fromCurrency={lbpUsd?.fromCurrency ?? "LBP"}
          toCurrency={lbpUsd?.toCurrency ?? books}
          rate={lbpUsd?.rate ?? "89500"}
        />
      </section>
    </div>
  );
}
