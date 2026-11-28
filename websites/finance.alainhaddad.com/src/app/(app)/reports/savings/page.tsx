import { SavingsCharts } from "@/components/reports-detail-charts";
import { ReportRangeBar } from "@/components/report-range-bar";
import { prisma } from "@/lib/db";
import { convertMinor } from "@/lib/fx";
import { formatMoney } from "@/lib/money";
import {
  defaultReportMonthKeys,
  monthKeysFromDates,
  monthsForReportRange,
} from "@/lib/report-range";
import { resolveReportPageRange, type ReportPageSearch } from "@/lib/report-page";
import { metalValueBooks, potBalance } from "@/lib/savings";
import { requireAdult } from "@/lib/session";

export default async function SavingsReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportPageSearch>;
}) {
  const { member } = await requireAdult();
  const params = await searchParams;
  const currency = member.household.booksCurrency || member.household.currency;
  const resolved = resolveReportPageRange(params);

  const [accounts, rates] = await Promise.all([
    prisma.savingsAccount.findMany({
      where: { householdId: member.householdId },
      include: { txns: true },
    }),
    prisma.fxRate.findMany({ where: { householdId: member.householdId } }),
  ]);

  const fxQuotes = rates.map((row) => ({
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    rate: row.rate,
  }));

  function toBooks(amount: number, accountCurrency: string) {
    if (accountCurrency.toUpperCase() === currency.toUpperCase()) return amount;
    try {
      return convertMinor(amount, accountCurrency, currency, fxQuotes);
    } catch {
      return 0;
    }
  }

  let potsToday = 0;
  let deposits = 0;
  let withdrawals = 0;
  let cashBalance = 0;
  let metalBalance = 0;
  const byPot: { name: string; amount: number }[] = [];
  const monthFlow = new Map<string, { deposits: number; withdrawals: number }>();

  for (const account of accounts) {
    const balance =
      account.kind === "GOLD" || account.kind === "SILVER"
        ? metalValueBooks(account.quantityMg, account.unitPricePerGram)
        : potBalance(account.txns);
    const books = toBooks(balance, account.currency);
    potsToday += books;
    byPot.push({ name: account.name, amount: books / 100 });
    if (account.kind === "GOLD" || account.kind === "SILVER") {
      metalBalance += books;
    } else {
      cashBalance += books;
    }

    for (const txn of account.txns) {
      if (resolved.start && txn.date < resolved.start) continue;
      if (resolved.end && txn.date >= resolved.end) continue;
      const amountBooks = toBooks(Math.abs(txn.amount), account.currency);
      const month = txn.date.slice(0, 7);
      const bucket = monthFlow.get(month) ?? { deposits: 0, withdrawals: 0 };
      if (txn.kind === "DEPOSIT" || txn.amount > 0) {
        deposits += amountBooks;
        bucket.deposits += amountBooks;
      } else if (txn.kind === "WITHDRAW" || txn.amount < 0) {
        withdrawals += amountBooks;
        bucket.withdrawals += amountBooks;
      }
      monthFlow.set(month, bucket);
    }
  }

  const rangedMonths = monthsForReportRange(resolved.start, resolved.end);
  const monthKeys =
    rangedMonths.length > 0
      ? rangedMonths
      : monthKeysFromDates(Array.from(monthFlow.keys()).map((month) => `${month}-01`));
  const keys = monthKeys.length > 0 ? monthKeys : defaultReportMonthKeys();
  const byMonth = keys.map((month) => {
    const row = monthFlow.get(month) ?? { deposits: 0, withdrawals: 0 };
    return {
      month,
      deposits: row.deposits / 100,
      withdrawals: row.withdrawals / 100,
      net: (row.deposits - row.withdrawals) / 100,
    };
  });

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold">Savings</h1>
          <p className="text-sm text-muted">
            Pot balances today, plus deposits and withdrawals in range.
          </p>
        </div>
        <ReportRangeBar range={resolved.range} from={resolved.from} to={resolved.to} />
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Pots today" value={formatMoney(potsToday, currency)} />
        <SummaryCard label="Deposits" value={formatMoney(deposits, currency)} />
        <SummaryCard label="Withdrawals" value={formatMoney(withdrawals, currency)} />
      </section>

      <SavingsCharts
        currency={currency}
        byPot={byPot.sort((a, b) => b.amount - a.amount)}
        byMonth={byMonth}
        byKind={[
          { name: "Cash / pension", amount: cashBalance / 100 },
          { name: "Metal", amount: metalBalance / 100 },
        ]}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
