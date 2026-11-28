import { ObligationCharts } from "@/components/reports-detail-charts";
import { ReportRangeBar } from "@/components/report-range-bar";
import { billActiveInMonth } from "@/lib/bills";
import { prisma } from "@/lib/db";
import { consolidateHouseholdDebts } from "@/lib/debt-service";
import { formatMoney } from "@/lib/money";
import { openCardCycles, openDebts } from "@/lib/money-service";
import {
  defaultReportMonthKeys,
  monthsForReportRange,
} from "@/lib/report-range";
import { resolveReportPageRange, type ReportPageSearch } from "@/lib/report-page";
import { requireAdult } from "@/lib/session";
import { addMonths, currentMonth } from "@/lib/utils";

export default async function ObligationsReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportPageSearch>;
}) {
  const { member } = await requireAdult();
  const params = await searchParams;
  const currency = member.household.booksCurrency || member.household.currency;
  const resolved = resolveReportPageRange(params);

  const rangedMonths = monthsForReportRange(resolved.start, resolved.end);
  const monthKeys =
    rangedMonths.length > 0 ? rangedMonths : [currentMonth(), ...defaultReportMonthKeys()].slice(0, 3);
  const uniqueMonths = Array.from(new Set(monthKeys)).sort();

  await consolidateHouseholdDebts(member.householdId);
  const entryDate =
    resolved.start || resolved.end
      ? {
          ...(resolved.start ? { gte: resolved.start } : {}),
          ...(resolved.end ? { lte: resolved.end } : {}),
        }
      : undefined;
  const [cards, debts, loans, bills, rangeEntries] = await Promise.all([
    openCardCycles(member.householdId),
    openDebts(member.householdId),
    prisma.loan.findMany({
      where: { householdId: member.householdId, archivedAt: null },
    }),
    prisma.bill.findMany({
      where: { householdId: member.householdId, archivedAt: null },
      include: { payments: true },
    }),
    prisma.debtEntry.findMany({
      where: {
        debt: { householdId: member.householdId },
        ...(entryDate ? { date: entryDate } : {}),
      },
    }),
  ]);

  const borrowedInRange = rangeEntries
    .filter((entry) => entry.kind === "BORROW")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const interestInRange = rangeEntries
    .filter((entry) => entry.kind === "INTEREST")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const settledInRange = rangeEntries
    .filter((entry) => entry.kind === "REPAY")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const owedToday =
    cards.reduce((sum, card) => sum + card.total, 0) +
    debts.reduce((sum, debt) => sum + Math.max(0, debt.amount - debt.repaid), 0);

  const cardsChart = cards.map((card) => ({
    name: card.cardName,
    amount: card.total / 100,
  }));
  const debtsChart = debts.map((debt) => ({
    name: debt.person,
    amount: Math.max(0, debt.amount - debt.repaid) / 100,
  }));

  const asOf = currentMonth();
  const loansChart = loans
    .map((loan) => {
      let monthsLeft = 0;
      let cursor = asOf < loan.startMonth ? loan.startMonth : asOf;
      while (cursor <= loan.endMonth) {
        monthsLeft += 1;
        cursor = addMonths(cursor, 1);
      }
      return {
        name: loan.name,
        amount: (monthsLeft * loan.monthlyAmount) / 100,
      };
    })
    .filter((row) => row.amount > 0);

  let paidBills = 0;
  let unpaidBills = 0;
  for (const month of uniqueMonths) {
    for (const bill of bills) {
      if (!billActiveInMonth(bill, month)) continue;
      if (bill.endMonth && bill.endMonth < month) continue;
      const paid = bill.payments.some((payment) => payment.month === month);
      if (paid) paidBills += bill.amount;
      else unpaidBills += bill.amount;
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold">Obligations</h1>
          <p className="text-sm text-muted">
            Cards and debts as of today; loan runway; bills paid vs unpaid in the selected months.
          </p>
        </div>
        <ReportRangeBar range={resolved.range} from={resolved.from} to={resolved.to} />
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Still owe today" value={formatMoney(owedToday, currency)} />
        <SummaryCard label="Borrowed in range" value={formatMoney(borrowedInRange, currency)} />
        <SummaryCard label="Interest in range" value={formatMoney(interestInRange, currency)} />
        <SummaryCard label="Settled in range" value={formatMoney(settledInRange, currency)} />
        <SummaryCard label="Bills unpaid in range" value={formatMoney(unpaidBills, currency)} />
        <SummaryCard label="Bills paid in range" value={formatMoney(paidBills, currency)} />
      </section>

      <ObligationCharts
        currency={currency}
        cards={cardsChart}
        debts={debtsChart}
        loans={loansChart}
        bills={[
          { name: "Paid", amount: paidBills / 100 },
          { name: "Unpaid", amount: unpaidBills / 100 },
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
