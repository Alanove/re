import Link from "next/link";
import { ReportsCharts } from "@/components/reports-charts";
import { prisma } from "@/lib/db";
import { convertMinor } from "@/lib/fx";
import { invoiceRemainder, invoiceTotal } from "@/lib/invoice";
import { formatMoney } from "@/lib/money";
import { openCardCycles, openDebts } from "@/lib/money-service";
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
import { addMonths, currentMonth, cn } from "@/lib/utils";

type Range = "3" | "12" | "all";

function monthsForRange(range: Range): string[] {
  const end = currentMonth();
  if (range === "all") {
    return [];
  }
  const count = range === "3" ? 3 : 12;
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    months.push(addMonths(end, -i));
  }
  return months;
}

function previousWindow(months: string[]): { start: string; endExclusive: string } | null {
  if (months.length === 0) return null;
  const count = months.length;
  const first = months[0];
  const prevStart = addMonths(first, -count);
  return { start: `${prevStart}-01`, endExclusive: `${first}-01` };
}

function lastDayOfMonth(month: string): string {
  const next = addMonths(month, 1);
  const [year, monthNumber] = next.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthNumber - 1, 0));
  return last.toISOString().slice(0, 10);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { member } = await requireAdult();
  const params = await searchParams;
  const range = (["3", "12", "all"].includes(params.range ?? "")
    ? params.range
    : "3") as Range;
  const months = monthsForRange(range);
  const currency = member.household.booksCurrency || member.household.currency;
  const dateFilter =
    months.length === 0
      ? {}
      : {
          date: {
            gte: `${months[0]}-01`,
            lt: `${addMonths(months[months.length - 1], 1)}-01`,
          },
        };

  const prev = previousWindow(months);
  const prevFilter = prev
    ? { date: { gte: prev.start, lt: prev.endExclusive } }
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
        ...(months.length === 0
          ? {}
          : {
              issueDate: {
                gte: `${months[0]}-01`,
                lt: `${addMonths(months[months.length - 1], 1)}-01`,
              },
            }),
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
          where:
            months.length === 0
              ? { kind: "DEPOSIT", amount: { gt: 0 } }
              : {
                  kind: "DEPOSIT",
                  amount: { gt: 0 },
                  date: {
                    gte: `${months[0]}-01`,
                    lt: `${addMonths(months[months.length - 1], 1)}-01`,
                  },
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

  const monthKeys =
    months.length > 0
      ? months
      : Array.from(
          new Set([
            ...reportIncomes.map((row) => row.date.slice(0, 7)),
            ...reportExpenses.map((row) => row.date.slice(0, 7)),
          ])
        ).sort();

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

  const byMonth = leftoverByMonth(monthKeys, reportIncomes, reportExpenses).map((row) => ({
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

  const rangeQuery =
    months.length === 0
      ? "range=this_year"
      : months.length === 1
        ? `range=custom&from=${months[0]}-01&to=${lastDayOfMonth(months[0])}`
        : `range=custom&from=${months[0]}-01&to=${lastDayOfMonth(months[months.length - 1])}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted">
          Leftover matches Home. Tap a bar to open Activity with that filter.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["3", "3 months"],
            ["12", "12 months"],
            ["all", "All"],
          ] as const
        ).map(([id, label]) => (
          <Link
            key={id}
            href={`/reports?range=${id}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              range === id ? "bg-ink text-white" : "border border-line bg-white text-ink"
            )}
          >
            {label}
          </Link>
        ))}
      </div>

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

      <section className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
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

      <section className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
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
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className={`tabular mt-1 text-2xl font-semibold ${emphasize ? "text-ok" : "text-ink"}`}>
        {value}
      </p>
      {previous ? <p className="mt-1 text-xs text-muted">Prev window {previous}</p> : null}
    </div>
  );
}
