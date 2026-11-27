import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import {
  payCardCycleAction,
  markBillPaidAction,
  markLoanPaidAction,
} from "@/app/actions/plan";
import { repayDebtFormAction } from "@/app/actions/money";
import { MarkPayslipSheet } from "@/components/mark-payslip-sheet";
import { OwedBreakdown } from "@/components/owed-breakdown";
import { Button } from "@/components/ui/button";
import { formatMoney, fromMinorUnits } from "@/lib/money";
import {
  childSpendingThisMonth,
  forecastWithAdvice,
  householdCashSummary,
  householdPosition,
  safeToSpend,
  unpaidBillsThisMonth,
  unpaidLoansThisMonth,
} from "@/lib/money-service";
import {
  settlementMonthsToShow,
  shouldShowPayslipPrompt,
} from "@/lib/payslip";
import { isAdultRole } from "@/lib/roles";
import { requireMember } from "@/lib/session";
import { cn, currentMonth, todayIsoDate } from "@/lib/utils";
import { prisma } from "@/lib/db";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { member } = await requireMember();
  const params = searchParams ? await searchParams : {};
  // Home shows Cash, Still owe, settle list, and coming up.
  const currency = member.household.booksCurrency || member.household.currency;
  const month = currentMonth();
  const today = todayIsoDate();
  const dayOfMonth = Number(today.slice(8, 10));

  if (!isAdultRole(member.role)) {
    const spent = await childSpendingThisMonth(member.householdId, member.id, month);
    return (
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Your spending this month</p>
            <p className="tabular mt-2 text-5xl font-semibold tracking-tight text-ink">
              {formatMoney(spent, currency)}
            </p>
          </div>
          <form action={signOutAction}>
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </header>
        <p className="text-sm text-muted">Use Add to record an expense. Activity shows your list.</p>
      </div>
    );
  }

  const payslipAppearDays = await prisma.payslipTemplate.findMany({
    where: { householdId: member.householdId },
    select: { appearFromDay: true },
  });
  const settleMonthSet = new Set<string>([month]);
  for (const template of payslipAppearDays) {
    for (const settleMonth of settlementMonthsToShow(
      month,
      dayOfMonth,
      template.appearFromDay
    )) {
      settleMonthSet.add(settleMonth);
    }
  }
  const settleMonths = [...settleMonthSet].sort();

  const summary = await householdCashSummary(member.householdId, month);

  const [
    forecasts,
    services,
    recentIncomes,
    recentExpenses,
    unpaidBillLists,
    unpaidLoanLists,
    spendSafe,
    position,
  ] = await Promise.all([
    prisma.forecast.findMany({
      where: { householdId: member.householdId, archivedAt: null, month: { gte: month } },
      orderBy: { month: "asc" },
      take: 3,
    }),
    prisma.service.findMany({
      where: {
        customer: { householdId: member.householdId },
        renewalDate: { gte: today },
      },
      include: { customer: true },
      orderBy: { renewalDate: "asc" },
      take: 3,
    }),
    prisma.income.findMany({
      where: { householdId: member.householdId },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.expense.findMany({
      where: { householdId: member.householdId },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    Promise.all(
      settleMonths.map((settleMonth) =>
        unpaidBillsThisMonth(member.householdId, settleMonth)
      )
    ),
    Promise.all(
      settleMonths.map((settleMonth) =>
        unpaidLoansThisMonth(member.householdId, settleMonth)
      )
    ),
    safeToSpend(member.householdId, month),
    householdPosition(member.householdId, month),
  ]);

  const unpaidBills = unpaidBillLists.flat();
  const unpaidLoans = unpaidLoanLists.flat();

  const recentActivity = [
    ...recentIncomes.map((row) => {
      const customerLabel = row.customer?.name;
      const base = row.description || row.kind.toLowerCase();
      const label =
        customerLabel && row.description
          ? `${customerLabel} · ${row.description}`
          : customerLabel || base;
      return {
        id: row.id,
        createdAt: row.createdAt,
        date: row.date,
        label,
        amount: row.amount,
        positive: true,
      };
    }),
    ...recentExpenses.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      date: row.date,
      label: row.description || row.category.name,
      amount: row.amount,
      positive: false,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  const comingUp = [
    ...unpaidBills.map((row) => ({
      id: `bill-${row.id}`,
      label: row.name,
      when: row.dueDate,
      amount: row.amount,
      href: "/plan/bills",
    })),
    ...forecasts.map((row) => ({
      id: row.id,
      label: row.name,
      when: row.month,
      amount: row.amount,
      href: "/plan/forecasts",
    })),
    ...services.map((row) => ({
      id: row.id,
      label: `${row.customer.name}: ${row.name}`,
      when: row.renewalDate,
      amount: row.price,
      href: "/work/renewals",
    })),
  ]
    .sort((a, b) => a.when.localeCompare(b.when))
    .slice(0, 5);

  const payslipTemplates = await prisma.payslipTemplate.findMany({
    where: { householdId: member.householdId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      receipts: {
        where: { month: { in: settleMonths } },
        select: { id: true, month: true },
      },
    },
  });

  const fxRates = await prisma.fxRate.findMany({
    where: { householdId: member.householdId },
  });

  const payslipSettle = payslipTemplates.flatMap((template) => {
    if (!shouldShowPayslipPrompt(dayOfMonth, template.appearFromDay)) {
      return [];
    }
    const fx = fxRates.find(
      (row) =>
        row.fromCurrency.toUpperCase() === template.salaryCurrency.toUpperCase() &&
        row.toCurrency.toUpperCase() === currency.toUpperCase()
    );
    const promptMonths = settlementMonthsToShow(
      month,
      dayOfMonth,
      template.appearFromDay
    );
    const paidMonths = new Set(template.receipts.map((row) => row.month));
    return promptMonths
      .filter((promptMonth) => !paidMonths.has(promptMonth))
      .map((promptMonth) => ({
        key: `payslip-${template.id}-${promptMonth}`,
        label: `${template.name} · ${promptMonth}`,
        amount: null as number | null,
        amountLabel: template.salaryCurrency,
        action: (
          <MarkPayslipSheet
            templateId={template.id}
            month={promptMonth}
            salaryCurrency={template.salaryCurrency}
            booksCurrency={currency}
            fxRate={fx?.rate ?? null}
            srspBps={template.srspBps}
            companyBps={template.companyBps}
            lines={template.lines.map((line) => ({
              code: line.code,
              label: line.label,
              section: line.section,
              amount: String(fromMinorUnits(Number(line.amount))),
              startMonth: line.startMonth,
              endMonth: line.endMonth,
              active: line.active,
            }))}
          />
        ),
      }));
  });

  const settleItems = [
    ...payslipSettle,
    ...unpaidBills.map((bill) => ({
      key: `bill-${bill.id}-${bill.month}`,
      label: `${bill.name} · due ${bill.dueDate}`,
      amount: bill.amount as number | null,
      amountLabel: null as string | null,
      action: (
        <form action={markBillPaidAction}>
          <input type="hidden" name="billId" value={bill.id} />
          <input type="hidden" name="month" value={bill.month} />
          <Button size="sm" type="submit">
            Mark paid
          </Button>
        </form>
      ),
    })),
    ...summary.cards
      .filter((card) => card.total > 0)
      .map((card) => ({
        key: `card-${card.id}`,
        label:
          card.dueDate <= today
            ? `${card.cardName} due`
            : `${card.cardName} · due ${card.dueDate}`,
        amount: card.total as number | null,
        amountLabel: null as string | null,
        action: (
          <form action={payCardCycleAction}>
            <input type="hidden" name="cycleId" value={card.id} />
            <Button size="sm" type="submit">
              I paid the card
            </Button>
          </form>
        ),
      })),
    ...summary.debts.map((debt) => {
      const remaining = debt.amount - debt.repaid;
      return {
        key: `debt-${debt.id}`,
        label: debt.person,
        amount: remaining,
        amountLabel: null as string | null,
        action: (
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
        ),
      };
    }),
    ...unpaidLoans.map((loan) => ({
      key: `loan-${loan.id}-${loan.month}`,
      label: `${loan.name} · ${loan.month}`,
      amount: loan.monthlyAmount,
      amountLabel: null as string | null,
      action: (
        <form action={markLoanPaidAction}>
          <input type="hidden" name="loanId" value={loan.id} />
          <input type="hidden" name="month" value={loan.month} />
          <Button size="sm" type="submit">
            Mark paid
          </Button>
        </form>
      ),
    })),
  ];

  const emptyHint =
    settleItems.length === 0 && comingUp.length === 0
      ? summary.cash === 0 && summary.owed === 0
        ? payslipTemplates.length === 0
          ? "Set currencies and add your payslip"
          : "Add your apartment loan"
        : null
      : null;

  const forecastCards = await Promise.all(
    forecasts.slice(0, 1).map(async (row) => forecastWithAdvice(member.householdId, row.id))
  );

  const owedItems = [
    ...summary.cards
      .filter((card) => card.total > 0)
      .map((card) => ({
        key: `card-${card.id}`,
        label: card.cardName,
        detail: `Card · due ${card.dueDate}`,
        amount: card.total,
      })),
    ...summary.debts.map((debt) => ({
      key: `debt-${debt.id}`,
      label: debt.person,
      detail: debt.note || "Borrowed",
      amount: debt.amount - debt.repaid,
    })),
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{member.household.name}</p>
          <p className="mt-1 text-sm text-muted">Cash</p>
          <p className="tabular mt-1 text-5xl font-semibold tracking-tight text-ok">
            {formatMoney(summary.cash, currency)}
          </p>
          <p className="mt-2 text-sm text-muted">
            Safe to spend{" "}
            <span
              className={cn(
                "tabular font-semibold",
                spendSafe.safe < 0 ? "text-short" : "text-ink"
              )}
            >
              {formatMoney(spendSafe.safe, currency)}
            </span>
          </p>
          <p className="text-xs text-muted">
            After unpaid bills, loans, cards, and forecast set-aside this month.
          </p>
          <div className="mt-2 space-y-1">
            <OwedBreakdown owed={summary.owed} currency={currency} items={owedItems} />
            {summary.cards.some((card) => card.total > 0) ? (
              <p className="text-xs text-muted">
                Card spend sits in Still owe until you pay the card.
              </p>
            ) : null}
            <p className="text-sm text-muted">
              Position{" "}
              <span className="tabular font-medium text-ink">
                {formatMoney(position.position, currency)}
              </span>
              <span className="text-xs">
                {" "}
                · cash + savings − cards − debts − loans
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Link href="/settings" className="text-sm text-muted underline">
            Settings
          </Link>
          <form action={signOutAction}>
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      {params.error ? (
        <p className="rounded-2xl border border-line bg-white p-3 text-sm text-short">
          {params.error}
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Recent activity
          </h2>
          <Link href="/activity" className="text-sm font-medium text-ink underline">
            More
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white/60 p-4 text-sm text-muted">
            Nothing yet. Use Add — new expenses show up here right away.
          </p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-card"
              >
                <div>
                  <p className="font-medium">{row.label}</p>
                  <p className="text-sm text-muted">{row.date}</p>
                </div>
                <p
                  className={cn(
                    "tabular text-sm font-semibold",
                    row.positive ? "text-ok" : "text-ink"
                  )}
                >
                  {row.positive ? "+" : "−"}
                  {formatMoney(row.amount, currency)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {settleItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">To settle</h2>
          <div className="space-y-2">
            {settleItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-card"
              >
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="tabular text-sm text-muted">
                    {item.amount === null
                      ? item.amountLabel ?? ""
                      : formatMoney(item.amount, currency)}
                  </p>
                </div>
                {item.action}
              </div>
            ))}
          </div>
        </section>
      )}

      {comingUp.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Coming up</h2>
          <div className="space-y-2">
            {comingUp.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center justify-between rounded-2xl border border-line bg-white p-4 shadow-card"
              >
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted">{item.when}</p>
                </div>
                <p className="tabular text-sm font-medium">
                  {formatMoney(item.amount, currency)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {forecastCards[0] && (
        <section className="rounded-2xl border border-line bg-white p-4 shadow-card">
          <p className="text-sm font-semibold">{forecastCards[0].forecast.name}</p>
          <p className="mt-2 text-sm text-muted">{forecastCards[0].advice.sentence}</p>
        </section>
      )}

      {emptyHint && (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-6 text-center">
          <p className="font-medium">{emptyHint}</p>
          <Link
            href={payslipTemplates.length === 0 ? "/settings/payslip" : "/plan/bills"}
            className="mt-2 inline-block text-sm text-ok underline"
          >
            {payslipTemplates.length === 0 ? "Open Settings" : "Open Plan"}
          </Link>
        </div>
      )}
    </div>
  );
}
