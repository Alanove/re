import { billActiveInMonth, billDueDate } from "@/lib/bills";
import { prisma } from "@/lib/db";
import { accrueHouseholdDebtInterest } from "@/lib/debt-service";
import { convertMinor } from "@/lib/fx";
import {
  computeHeadline,
  computeLeft,
  computeOwed,
  forecastAdvice,
  monthsUntil,
  type MonthExpense,
  type OpenDebt,
} from "@/lib/money";
import { metalValueBooks, potBalance } from "@/lib/savings";
import { addMonths, currentMonth, previousFullMonths } from "@/lib/utils";

function mapExpense(row: {
  amount: number;
  funding: string;
  isCardPayoff: boolean;
  loanPaymentId: string | null;
}): MonthExpense {
  return {
    amount: row.amount,
    funding: row.funding as MonthExpense["funding"],
    isCardPayoff: row.isCardPayoff,
    isLoanPayment: Boolean(row.loanPaymentId),
  };
}

export async function monthSnapshot(householdId: string, month: string) {
  const start = `${month}-01`;
  const end = `${addMonths(month, 1)}-01`;

  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({
      where: { householdId, date: { gte: start, lt: end } },
    }),
    prisma.expense.findMany({
      where: { householdId, date: { gte: start, lt: end } },
    }),
  ]);

  return {
    incomes: incomes.map((row) => ({ amount: row.amount })),
    expenses: expenses.map(mapExpense),
  };
}

/** All-time ledger snapshot (running cash, not month-scoped). */
export async function allTimeSnapshot(householdId: string) {
  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({ where: { householdId } }),
    prisma.expense.findMany({ where: { householdId } }),
  ]);

  return {
    incomes: incomes.map((row) => ({ amount: row.amount })),
    expenses: expenses.map(mapExpense),
  };
}

/** Current cash in the main ledger (never display below 0). */
export async function getHouseholdCash(householdId: string): Promise<number> {
  const snapshot = await allTimeSnapshot(householdId);
  return Math.max(0, computeLeft(snapshot));
}

export async function openCardCycles(householdId: string) {
  const cycles = await prisma.cardCycle.findMany({
    where: {
      settledAt: null,
      creditCard: { householdId, archivedAt: null },
    },
    include: {
      expenses: {
        where: { isCardPayoff: false },
      },
      creditCard: true,
    },
  });

  return cycles.map((cycle) => ({
    id: cycle.id,
    creditCardId: cycle.creditCardId,
    cardName: cycle.creditCard.name,
    payoffDay: cycle.creditCard.payoffDay,
    dueDate: cycle.dueDate,
    total: cycle.expenses.reduce((sum, expense) => sum + expense.amount, 0),
  }));
}

export async function openDebts(householdId: string): Promise<
  Array<
    OpenDebt & {
      id: string;
      person: string;
      note: string;
      date: string;
      principal: number;
      feeFixed: number;
      monthlyInterestBps: number;
    }
  >
> {
  await accrueHouseholdDebtInterest(householdId);

  const debts = await prisma.debt.findMany({
    where: { householdId, amount: { gt: 0 } },
    include: { repayments: true },
  });

  return debts
    .map((debt) => {
      const repaid = debt.repayments
        .filter((row) => row.kind !== "INTEREST")
        .reduce((sum, row) => sum + row.amount, 0);
      const interest = debt.repayments
        .filter((row) => row.kind === "INTEREST")
        .reduce((sum, row) => sum + row.amount, 0);
      // Prefer ledger math so legacy repayments (before amount was reduced) still clear.
      const remaining = Math.max(0, debt.principal + interest - repaid);
      return {
        id: debt.id,
        person: debt.person,
        note: debt.note,
        date: debt.date,
        principal: debt.principal,
        feeFixed: debt.feeFixed,
        monthlyInterestBps: debt.monthlyInterestBps,
        amount: debt.principal + interest,
        repaid,
        remaining,
      };
    })
    .filter((debt) => debt.remaining > 0)
    .map(({ remaining, ...debt }) => {
      void remaining;
      return debt;
    });
}

export async function unpaidLoansThisMonth(householdId: string, month: string) {
  const loans = await prisma.loan.findMany({
    where: {
      householdId,
      archivedAt: null,
      startMonth: { lte: month },
      endMonth: { gte: month },
    },
    include: {
      payments: {
        where: { month },
      },
    },
  });

  return loans
    .filter((loan) => loan.payments.length === 0)
    .map((loan) => ({
      id: loan.id,
      name: loan.name,
      monthlyAmount: loan.monthlyAmount,
      month,
    }));
}

export async function unpaidBillsThisMonth(householdId: string, month: string) {
  const bills = await prisma.bill.findMany({
    where: {
      householdId,
      archivedAt: null,
      OR: [{ endMonth: null }, { endMonth: { gte: month } }],
    },
    include: {
      payments: { where: { month } },
      category: true,
    },
    orderBy: { name: "asc" },
  });

  return bills
    .filter((bill) => billActiveInMonth(bill, month) && bill.payments.length === 0)
    .map((bill) => ({
      id: bill.id,
      name: bill.name,
      amount: bill.amount,
      dueDay: bill.dueDay,
      dueDate: billDueDate(month, bill.dueDay),
      categoryId: bill.categoryId,
      categoryName: bill.category?.name ?? null,
      month,
    }));
}

/** Monthly set-aside across active (non-archived) forecasts still ahead. */
export async function forecastSetAsideThisMonth(
  householdId: string,
  asOfMonth = currentMonth()
): Promise<number> {
  const forecasts = await prisma.forecast.findMany({
    where: {
      householdId,
      archivedAt: null,
      month: { gte: asOfMonth },
    },
  });
  let total = 0;
  for (const forecast of forecasts) {
    const monthsLeft = Math.max(1, monthsUntil(asOfMonth, forecast.month));
    total += Math.ceil(forecast.amount / monthsLeft);
  }
  return total;
}

/**
 * Cash you can still spend this month after known commitments.
 * Does not replace Left; it is cash minus unpaid loans, open cards, unpaid bills, and forecast set-aside.
 */
export async function safeToSpend(householdId: string, month = currentMonth()): Promise<{
  cash: number;
  commitments: number;
  safe: number;
  unpaidLoans: number;
  openCards: number;
  unpaidBills: number;
  forecastSetAside: number;
}> {
  const [summary, bills, setAside] = await Promise.all([
    householdCashSummary(householdId, month),
    unpaidBillsThisMonth(householdId, month),
    forecastSetAsideThisMonth(householdId, month),
  ]);
  const unpaidLoans = summary.loans.reduce((sum, loan) => sum + loan.monthlyAmount, 0);
  const openCards = summary.cards.reduce((sum, card) => sum + card.total, 0);
  const unpaidBills = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const commitments = unpaidLoans + openCards + unpaidBills + setAside;
  return {
    cash: summary.cash,
    commitments,
    safe: summary.cash - commitments,
    unpaidLoans,
    openCards,
    unpaidBills,
    forecastSetAside: setAside,
  };
}

/** Display-only household position: cash + savings − cards − debts − remaining loan principal. */
export async function householdPosition(householdId: string, month = currentMonth()) {
  const [summary, loans, accounts, rates, household] = await Promise.all([
    householdCashSummary(householdId, month),
    prisma.loan.findMany({
      where: {
        householdId,
        archivedAt: null,
        endMonth: { gte: month },
      },
      include: { payments: true },
    }),
    prisma.savingsAccount.findMany({
      where: { householdId },
      include: { txns: true },
    }),
    prisma.fxRate.findMany({ where: { householdId } }),
    prisma.household.findUniqueOrThrow({ where: { id: householdId } }),
  ]);

  const books = household.booksCurrency || household.currency;
  const fxQuotes = rates.map((row) => ({
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    rate: row.rate,
  }));

  let savingsBooks = 0;
  for (const account of accounts) {
    const balance =
      account.kind === "GOLD" || account.kind === "SILVER"
        ? metalValueBooks(account.quantityMg, account.unitPricePerGram)
        : potBalance(account.txns);
    if (account.currency.toUpperCase() === books.toUpperCase()) {
      savingsBooks += balance;
      continue;
    }
    try {
      savingsBooks += convertMinor(balance, account.currency, books, fxQuotes);
    } catch {
      // Skip pots we cannot convert.
    }
  }

  let loanPrincipalLeft = 0;
  for (const loan of loans) {
    const paid = new Set(loan.payments.map((row) => row.month));
    let next = loan.startMonth < month ? month : loan.startMonth;
    while (next <= loan.endMonth && paid.has(next)) {
      next = addMonths(next, 1);
    }
    if (next > loan.endMonth) continue;
    const monthsLeft = monthsUntil(next, loan.endMonth) + 1;
    loanPrincipalLeft += monthsLeft * loan.monthlyAmount;
  }

  const debtRemaining = summary.debts.reduce(
    (sum, debt) => sum + Math.max(0, debt.amount - debt.repaid),
    0
  );
  const cardOpen = summary.cards.reduce((sum, card) => sum + card.total, 0);
  const position = summary.cash + savingsBooks - cardOpen - debtRemaining - loanPrincipalLeft;

  return {
    cash: summary.cash,
    savingsBooks,
    cardOpen,
    debtRemaining,
    loanPrincipalLeft,
    position,
    booksCurrency: books,
  };
}

export async function householdMonthSummary(householdId: string, month = currentMonth()) {
  const [snapshot, cards, debts, loans] = await Promise.all([
    monthSnapshot(householdId, month),
    openCardCycles(householdId),
    openDebts(householdId),
    unpaidLoansThisMonth(householdId, month),
  ]);

  const left = computeLeft(snapshot);
  const owed = computeOwed(
    cards.map((card) => ({ total: card.total })),
    debts
  );
  const headline = computeHeadline(left, owed);

  return {
    month,
    left,
    owed,
    headline,
    cards,
    debts,
    loans,
  };
}

/** Home ledger: all-time Cash + open Owed (cards + debts). */
export async function householdCashSummary(householdId: string, month = currentMonth()) {
  const [snapshot, cards, debts, loans] = await Promise.all([
    allTimeSnapshot(householdId),
    openCardCycles(householdId),
    openDebts(householdId),
    unpaidLoansThisMonth(householdId, month),
  ]);

  const cashRaw = computeLeft(snapshot);
  const cash = Math.max(0, cashRaw);
  const owed = computeOwed(
    cards.map((card) => ({ total: card.total })),
    debts
  );

  return {
    month,
    cash,
    cashRaw,
    owed,
    cards,
    debts,
    loans,
  };
}

export async function usualLeftover(householdId: string, asOfMonth = currentMonth()) {
  const months = previousFullMonths(asOfMonth, 3);
  const values: number[] = [];
  for (const month of months) {
    const snapshot = await monthSnapshot(householdId, month);
    values.push(computeLeft(snapshot));
  }
  return values;
}

export async function forecastWithAdvice(householdId: string, forecastId: string) {
  const forecast = await prisma.forecast.findFirst({
    where: { id: forecastId, householdId, archivedAt: null },
    include: { savingsAccount: true },
  });
  if (!forecast) {
    return null;
  }
  const asOfMonth = currentMonth();
  const [recentLeft, unpaidBills] = await Promise.all([
    usualLeftover(householdId, asOfMonth),
    unpaidBillsThisMonth(householdId, asOfMonth),
  ]);
  const billsTotal = unpaidBills.reduce((sum, bill) => sum + bill.amount, 0);
  // Leave room for unpaid bills this month so set-aside advice is not optimistic.
  const adjustedLeft = recentLeft.map((value) => value - billsTotal);
  let savedToward = 0;
  if (forecast.savingsAccountId) {
    const deposits = await prisma.savingsTxn.findMany({
      where: {
        accountId: forecast.savingsAccountId,
        kind: "DEPOSIT",
        amount: { gt: 0 },
      },
    });
    savedToward = deposits.reduce((sum, row) => sum + row.amount, 0);
  }
  const remaining = Math.max(0, forecast.amount - savedToward);
  return {
    forecast,
    savedToward,
    remaining,
    advice: forecastAdvice({
      name: forecast.name,
      amount: remaining > 0 ? remaining : forecast.amount,
      month: forecast.month,
      asOfMonth,
      recentLeft: adjustedLeft,
    }),
  };
}

export async function childSpendingThisMonth(householdId: string, memberId: string, month = currentMonth()) {
  const start = `${month}-01`;
  const end = `${addMonths(month, 1)}-01`;
  const expenses = await prisma.expense.findMany({
    where: {
      householdId,
      memberId,
      date: { gte: start, lt: end },
    },
  });
  return expenses.reduce((sum, row) => sum + row.amount, 0);
}
