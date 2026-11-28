import { ReportRangeBar } from "@/components/report-range-bar";
import { ReportsCharts } from "@/components/reports-charts";
import { prisma } from "@/lib/db";
import { convertMinor } from "@/lib/fx";
import { invoiceRemainder, invoiceTotal } from "@/lib/invoice";
import { formatMoney } from "@/lib/money";
import { openCardCycles, openDebts } from "@/lib/money-service";
import {
  resolveReportPageRange,
  type ReportPageSearch,
} from "@/lib/report-page";
import {
  defaultReportMonthKeys,
  monthKeysFromDates,
  monthsForReportRange,
  prismaIssueDateFilter,
} from "@/lib/report-range";
import {
  fundingSplit,
  isChartSpending,
  leftoverByMonth,
  rangeTotals,
  sumBy,
  type ReportExpense,
  type ReportIncome,
} from "@/lib/reports";
import { metalValueBooks, potBalance } from "@/lib/savings";
import { requireAdult } from "@/lib/session";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportPageSearch>;
}) {
  const { member } = await requireAdult();
  const params = await searchParams;
  const resolved = resolveReportPageRange(params);
  const currency = member.household.booksCurrency || member.household.currency;
  const dateFilter = resolved.dateFilter;
  const issueDateFilter = prismaIssueDateFilter(resolved.start, resolved.end);
  const prevFilter = resolved.prev
    ? { date: { gte: resolved.prev.start, lt: resolved.prev.end } }
    : null;

  const [
    incomes,
    expenses,
    prevIncomes,
    prevExpenses,
    invoices,
    accounts,
    rates,
    cards,
    debts,
  ] = await Promise.all([
    prisma.income.findMany({
      where: { householdId: member.householdId, ...dateFilter },
    }),
    prisma.expense.findMany({
      where: { householdId: member.householdId, ...dateFilter },
      include: { category: true, business: true, member: true },
    }),
    prevFilter
      ? prisma.income.findMany({
          where: { householdId: member.householdId, ...prevFilter },
        })
      : Promise.resolve([]),
    prevFilter
      ? prisma.expense.findMany({
          where: { householdId: member.householdId, ...prevFilter },
          include: { category: true },
        })
      : Promise.resolve([]),
    prisma.invoice.findMany({
      where: {
        householdId: member.householdId,
        status: { not: "VOID" },
        ...issueDateFilter,
      },
      include: {
        customer: true,
        lines: true,
        payments: true,
      },
    }),
    prisma.savingsAccount.findMany({
      where: { householdId: member.householdId },
      include: {
        txns: {
          where: {
            kind: "DEPOSIT",
            amount: { gt: 0 },
            ...dateFilter,
          },
        },
      },
    }),
    prisma.fxRate.findMany({ where: { householdId: member.householdId } }),
    openCardCycles(member.householdId),
    openDebts(member.householdId),
  ]);

  const reportIncomes: ReportIncome[] = incomes.map((row) => ({
    amount: row.amount,
    kind: row.kind,
    date: row.date,
  }));
  const reportExpenses: ReportExpense[] = expenses.map((row) => ({
    amount: row.amount,
    funding: row.funding as ReportExpense["funding"],
    isCardPayoff: row.isCardPayoff,
    isLoanPayment: Boolean(row.loanPaymentId),
    excludeFromSpending: row.category.excludeFromSpending,
    categoryName: row.category.name,
    categoryKind: row.category.kind,
    categoryId: row.categoryId,
    memberId: row.memberId,
    memberName: row.member.displayName,
    businessName: row.business?.name ?? null,
    date: row.date,
  }));

  const rangedMonths = monthsForReportRange(resolved.start, resolved.end);
  const monthKeys =
    rangedMonths.length > 0
      ? rangedMonths
      : monthKeysFromDates([
          ...reportIncomes.map((row) => row.date),
          ...reportExpenses.map((row) => row.date),
        ]);
  const chartMonths = monthKeys.length > 0 ? monthKeys : defaultReportMonthKeys();

  const current = rangeTotals(reportIncomes, reportExpenses);
  const previous = rangeTotals(
    prevIncomes.map((row) => ({ amount: row.amount, kind: row.kind, date: row.date })),
    prevExpenses.map((row) => ({
      amount: row.amount,
      funding: row.funding as ReportExpense["funding"],
      isCardPayoff: row.isCardPayoff,
      isLoanPayment: Boolean(row.loanPaymentId),
      excludeFromSpending: row.category.excludeFromSpending,
      categoryName: row.category.name,
      categoryKind: row.category.kind,
      categoryId: row.categoryId,
      memberId: "",
      memberName: "",
      businessName: null,
      date: row.date,
    }))
  );

  const byMonth = leftoverByMonth(chartMonths, reportIncomes, reportExpenses).map((row) => ({
    month: row.month,
    leftover: row.leftover / 100,
    income: row.income / 100,
    pocket: row.pocket / 100,
  }));

  const incomeSplit = [
    {
      kind: "Salary",
      filter: "salary",
      amount:
        reportIncomes
          .filter((row) => row.kind === "SALARY")
          .reduce((sum, row) => sum + row.amount, 0) / 100,
    },
    {
      kind: "Freelance",
      filter: "freelance",
      amount:
        reportIncomes
          .filter((row) => row.kind === "FREELANCE")
          .reduce((sum, row) => sum + row.amount, 0) / 100,
    },
    {
      kind: "Other",
      filter: "other",
      amount:
        reportIncomes
          .filter((row) => row.kind === "OTHER")
          .reduce((sum, row) => sum + row.amount, 0) / 100,
    },
  ];

  const split = fundingSplit(reportExpenses);
  const fundingRows = [
    { name: "Pocket", amount: split.pocket / 100, filter: "all" },
    { name: "Card", amount: split.card / 100, filter: "card" },
    { name: "Borrowed", amount: split.borrowed / 100, filter: "all" },
  ];

  const chartSpend = reportExpenses.filter(isChartSpending);
  const familySpend = chartSpend.filter(
    (row) => row.categoryKind !== "BUSINESS" && !row.businessName
  );
  const businessSpend = chartSpend.filter(
    (row) => row.categoryKind === "BUSINESS" || Boolean(row.businessName)
  );

  const familyByCategory = sumBy(
    familySpend,
    (row) => row.categoryName,
    (row) => row.amount
  ).map((row) => ({
    name: row.name,
    amount: row.amount / 100,
    categoryId:
      familySpend.find((expense) => expense.categoryName === row.name)?.categoryId ?? "",
  }));

  const businessByCategory = sumBy(
    businessSpend,
    (row) => row.categoryName,
    (row) => row.amount
  ).map((row) => ({
    name: row.name,
    amount: row.amount / 100,
    categoryId:
      businessSpend.find((expense) => expense.categoryName === row.name)?.categoryId ?? "",
  }));

  const businessByBusiness = sumBy(
    businessSpend,
    (row) => row.businessName ?? "Unassigned",
    (row) => row.amount
  ).map((row) => ({ name: row.name, amount: row.amount / 100 }));

  const byMember = sumBy(
    chartSpend,
    (row) => row.memberName,
    (row) => row.amount
  ).map((row) => ({
    name: row.name,
    amount: row.amount / 100,
    memberId: chartSpend.find((expense) => expense.memberName === row.name)?.memberId ?? "",
  }));

  let invoiced = 0;
  let collected = 0;
  const outstandingByCustomer = new Map<string, number>();
  for (const invoice of invoices) {
    const total = invoiceTotal(invoice.lines, invoice.taxBps);
    const paid = invoice.payments.reduce((sum, row) => sum + row.amount, 0);
    const remainder = invoiceRemainder(invoice.lines, invoice.taxBps, invoice.payments);
    invoiced += total;
    collected += paid;
    if (remainder > 0) {
      outstandingByCustomer.set(
        invoice.customer.name,
        (outstandingByCustomer.get(invoice.customer.name) ?? 0) + remainder
      );
    }
  }
  const outstandingRows = Array.from(outstandingByCustomer.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const fxQuotes = rates.map((row) => ({
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    rate: row.rate,
  }));
  const allAccounts = await prisma.savingsAccount.findMany({
    where: { householdId: member.householdId },
    include: { txns: true },
  });
  let savingsTotal = 0;
  for (const account of allAccounts) {
    const balance =
      account.kind === "GOLD" || account.kind === "SILVER"
        ? metalValueBooks(account.quantityMg, account.unitPricePerGram)
        : potBalance(account.txns);
    if (account.currency.toUpperCase() === currency.toUpperCase()) {
      savingsTotal += balance;
    } else {
      try {
        savingsTotal += convertMinor(balance, account.currency, currency, fxQuotes);
      } catch {
        // skip
      }
    }
  }
  const depositsInRange = accounts.reduce(
    (sum, account) => sum + account.txns.reduce((inner, txn) => inner + txn.amount, 0),
    0
  );

  const owedToday =
    cards.reduce((sum, card) => sum + card.total, 0) +
    debts.reduce((sum, debt) => sum + Math.max(0, debt.amount - debt.repaid), 0);

  const rangeQuery = resolved.activityQuery;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted">
            Leftover matches Home. Tap a bar to open Activity with that filter.
          </p>
        </div>
        <ReportRangeBar range={resolved.range} from={resolved.from} to={resolved.to} />
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Income"
          value={formatMoney(current.income, currency)}
          previous={
            prevFilter ? formatMoney(previous.income, currency) : null
          }
        />
        <SummaryCard
          label="Pocket spending"
          value={formatMoney(current.pocket, currency)}
          previous={
            prevFilter ? formatMoney(previous.pocket, currency) : null
          }
        />
        <SummaryCard
          label="Leftover"
          value={formatMoney(current.leftover, currency)}
          previous={
            prevFilter ? formatMoney(previous.leftover, currency) : null
          }
          emphasize
        />
      </section>

      <ReportsCharts
        currency={currency}
        leftoverByMonth={byMonth}
        incomeSplit={incomeSplit}
        fundingSplit={fundingRows}
        familyByCategory={familyByCategory}
        businessByCategory={businessByCategory}
        businessByBusiness={businessByBusiness}
        byMember={byMember}
        rangeQuery={rangeQuery}
      />

      <section className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Invoices</h2>
        <p className="text-sm">
          Invoiced {formatMoney(invoiced, currency)} · collected{" "}
          {formatMoney(collected, currency)} · outstanding{" "}
          {formatMoney(Math.max(0, invoiced - collected), currency)}
        </p>
        {outstandingRows.length > 0 ? (
          <ul className="space-y-1 text-sm text-muted">
            {outstandingRows.slice(0, 8).map((row) => (
              <li key={row.name}>
                {row.name} · {formatMoney(row.amount, currency)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No open invoice balances in this range.</p>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Savings</h2>
        <p className="text-sm">
          Pots today {formatMoney(savingsTotal, currency)} · deposits in range{" "}
          {formatMoney(depositsInRange, currency)}
        </p>
        <p className="text-sm text-muted">
          Still owe today {formatMoney(owedToday, currency)} (cards + people, current
          balances).
        </p>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  previous,
  emphasize,
}: {
  label: string;
  value: string;
  previous: string | null;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className={`tabular mt-1 text-2xl font-semibold ${emphasize ? "text-ok-text" : "text-ink"}`}>
        {value}
      </p>
      {previous ? <p className="mt-1 text-xs text-muted">Prev window {previous}</p> : null}
    </div>
  );
}
