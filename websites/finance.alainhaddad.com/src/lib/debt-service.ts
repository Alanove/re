import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  canRemoveDebtMove,
  debtLedgerTotals,
  debtPersonKey,
  interestAccrualPlan,
  netReceived,
  rewriteDebtBalances,
  type DebtMove,
} from "@/lib/debt";
import { currentMonth } from "@/lib/utils";

type Tx = Prisma.TransactionClient;

const consolidateLocks = new Map<string, Promise<void>>();

function moveFromEntry(entry: {
  id: string;
  kind: string;
  amount: number;
  date: string;
  createdAt: Date;
}): DebtMove {
  return {
    id: entry.id,
    kind: entry.kind,
    amount: entry.amount,
    date: entry.date,
    createdAt: entry.createdAt.toISOString(),
  };
}

async function persistBalances(tx: Tx, debtId: string) {
  const entries = await tx.debtEntry.findMany({ where: { debtId } });
  const rewritten = rewriteDebtBalances(entries.map(moveFromEntry));
  for (const row of rewritten) {
    await tx.debtEntry.update({
      where: { id: row.id },
      data: { balanceAfter: row.balanceAfter },
    });
  }
  const totals = debtLedgerTotals(entries.map(moveFromEntry));
  if (entries.length === 0) {
    await tx.debt.delete({ where: { id: debtId } });
    return totals;
  }
  await tx.debt.update({
    where: { id: debtId },
    data: { amount: totals.left, principal: totals.borrowed },
  });
  return totals;
}

/** Remove one stored move and rewrite the later balances. Does not delete the activity row. */
export async function dropDebtEntry(tx: Tx, entryId: string) {
  const entry = await tx.debtEntry.findUnique({ where: { id: entryId } });
  if (!entry) {
    throw new Error("That debt line was not found.");
  }
  const entries = await tx.debtEntry.findMany({ where: { debtId: entry.debtId } });
  const check = canRemoveDebtMove(entries.map(moveFromEntry), entryId);
  if (!check.ok) {
    throw new Error(check.error);
  }
  await tx.debtEntry.delete({ where: { id: entryId } });
  await persistBalances(tx, entry.debtId);
}

export async function entryForIncome(householdId: string, incomeId: string) {
  return prisma.debtEntry.findFirst({
    where: { incomeId, debt: { householdId } },
  });
}

export async function entryForExpense(householdId: string, expenseId: string) {
  return prisma.debtEntry.findFirst({
    where: { expenseId, debt: { householdId } },
  });
}

async function findDebtByPerson(tx: Tx, householdId: string, person: string) {
  const debts = await tx.debt.findMany({ where: { householdId } });
  const key = debtPersonKey(person);
  return debts.find((debt) => debtPersonKey(debt.person) === key) ?? null;
}

/**
 * Fold same-person debts into one balance and backfill a DebtEntry for every
 * legacy borrow, repayment, and interest row. Safe to run more than once.
 */
export function consolidateHouseholdDebts(householdId: string): Promise<void> {
  const pending = consolidateLocks.get(householdId);
  if (pending) return pending;
  const run = consolidateHouseholdDebtsBody(householdId).finally(() => {
    consolidateLocks.delete(householdId);
  });
  consolidateLocks.set(householdId, run);
  return run;
}

async function consolidateHouseholdDebtsBody(householdId: string) {
  const debts = await prisma.debt.findMany({
    where: { householdId },
    include: { repayments: true, entries: true },
    orderBy: { createdAt: "asc" },
  });
  if (debts.length === 0) return;

  const missing = debts.filter((debt) => debt.entries.length === 0);
  if (missing.length > 0) {
    const [incomes, expenses, linked] = await Promise.all([
      prisma.income.findMany({ where: { householdId } }),
      prisma.expense.findMany({ where: { householdId } }),
      prisma.debtEntry.findMany({
        where: { debt: { householdId } },
        select: { incomeId: true, expenseId: true },
      }),
    ]);
    const usedIncome = new Set(linked.map((row) => row.incomeId).filter(Boolean) as string[]);
    const usedExpense = new Set(linked.map((row) => row.expenseId).filter(Boolean) as string[]);

    for (const debt of missing) {
      const borrowed = debt.principal > 0 ? debt.principal : Math.max(0, debt.amount);
      const personKey = debt.person.trim().toLowerCase();
      const spend = expenses.find((row) => row.debtId === debt.id && !usedExpense.has(row.id));
      let incomeId: string | null = null;
      let expenseId: string | null = null;
      if (spend) {
        expenseId = spend.id;
        usedExpense.add(spend.id);
      } else if (borrowed > 0) {
        const cash = netReceived(borrowed, debt.feeFixed);
        const income = incomes.find(
          (row) =>
            !usedIncome.has(row.id) &&
            row.date === debt.date &&
            (row.amount === cash || row.amount === borrowed) &&
            row.description.toLowerCase().includes(personKey)
        );
        if (income) {
          incomeId = income.id;
          usedIncome.add(income.id);
        }
      }

      const created: Array<{ id: string; kind: string; amount: number; date: string; createdAt: Date }> =
        [];
      if (borrowed > 0 || expenseId) {
        const amount = borrowed > 0 ? borrowed : (spend?.amount ?? 0);
        if (amount > 0) {
          const row = await prisma.debtEntry.create({
            data: {
              debtId: debt.id,
              kind: "BORROW",
              amount,
              balanceAfter: 0,
              date: debt.date,
              note: debt.note,
              incomeId,
              expenseId,
              createdAt: debt.createdAt,
            },
          });
          created.push(row);
        }
      }

      const repayments = [...debt.repayments].sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
      for (const repayment of repayments) {
        const kind = repayment.kind === "INTEREST" ? "INTEREST" : "REPAY";
        let repayExpenseId: string | null = null;
        if (kind === "REPAY") {
          const match = expenses.find(
            (row) =>
              !usedExpense.has(row.id) &&
              row.funding === "OWN" &&
              row.date === repayment.date &&
              row.amount === repayment.amount &&
              row.description.toLowerCase().includes(personKey)
          );
          if (match) {
            repayExpenseId = match.id;
            usedExpense.add(match.id);
          }
        }
        const row = await prisma.debtEntry.create({
          data: {
            debtId: debt.id,
            kind,
            amount: repayment.amount,
            balanceAfter: 0,
            date: repayment.date,
            note: "",
            expenseId: repayExpenseId,
            createdAt: repayment.createdAt,
          },
        });
        created.push(row);
      }

      if (created.length > 0) {
        await prisma.$transaction(async (tx) => {
          await persistBalances(tx, debt.id);
          const interestMonths = created
            .filter((row) => row.kind === "INTEREST")
            .map((row) => row.date.slice(0, 7));
          const lastInterest = interestMonths.sort().at(-1);
          if (lastInterest && (!debt.lastInterestMonth || debt.lastInterestMonth < lastInterest)) {
            await tx.debt.update({
              where: { id: debt.id },
              data: { lastInterestMonth: lastInterest },
            });
          }
        });
      }
    }
  }

  const fresh = await prisma.debt.findMany({
    where: { householdId },
    include: { entries: true },
    orderBy: { createdAt: "asc" },
  });
  const groups = new Map<string, typeof fresh>();
  for (const debt of fresh) {
    const key = debtPersonKey(debt.person);
    const group = groups.get(key) ?? [];
    group.push(debt);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const keeper = group[0]!;
    const rest = group.slice(1);
    const rate =
      keeper.monthlyInterestBps > 0
        ? keeper.monthlyInterestBps
        : (rest.find((debt) => debt.monthlyInterestBps > 0)?.monthlyInterestBps ?? 0);
    const lastInterest = [keeper, ...rest]
      .map((debt) => debt.lastInterestMonth)
      .filter((month): month is string => Boolean(month))
      .sort()
      .at(-1);
    const earliest = [keeper, ...rest].sort((a, b) => a.date.localeCompare(b.date))[0]!;

    await prisma.$transaction(async (tx) => {
      await tx.debtEntry.updateMany({
        where: { debtId: { in: rest.map((debt) => debt.id) } },
        data: { debtId: keeper.id },
      });
      await tx.expense.updateMany({
        where: { debtId: { in: rest.map((debt) => debt.id) } },
        data: { debtId: keeper.id },
      });
      await tx.debt.deleteMany({ where: { id: { in: rest.map((debt) => debt.id) } } });
      await tx.debt.update({
        where: { id: keeper.id },
        data: {
          monthlyInterestBps: rate,
          lastInterestMonth: lastInterest ?? keeper.lastInterestMonth,
          date: earliest.date,
        },
      });
      await persistBalances(tx, keeper.id);
    });
  }

  const synced = await prisma.debt.findMany({
    where: { householdId },
    include: { entries: true },
  });
  for (const debt of synced) {
    if (debt.entries.length === 0) continue;
    const rewritten = rewriteDebtBalances(debt.entries.map(moveFromEntry));
    const drifted = rewritten.some((row) => {
      const current = debt.entries.find((entry) => entry.id === row.id);
      return !current || current.balanceAfter !== row.balanceAfter;
    });
    const totals = debtLedgerTotals(debt.entries.map(moveFromEntry));
    if (!drifted && debt.amount === totals.left && debt.principal === totals.borrowed) continue;
    await prisma.$transaction(async (tx) => {
      await persistBalances(tx, debt.id);
    });
  }
}

/** Accrue revolving monthly interest on all open household debts up to asOfMonth. */
export async function accrueHouseholdDebtInterest(
  householdId: string,
  asOfMonth = currentMonth()
) {
  const debts = await prisma.debt.findMany({
    where: { householdId, amount: { gt: 0 }, monthlyInterestBps: { gt: 0 } },
  });

  for (const debt of debts) {
    await accrueDebtInterest(debt.id, asOfMonth);
  }
}

export async function accrueDebtInterest(debtId: string, asOfMonth = currentMonth()) {
  const debt = await prisma.debt.findUnique({
    where: { id: debtId },
    include: { entries: true },
  });
  if (!debt || debt.monthlyInterestBps <= 0) return debt;

  const totals = debt.entries.length
    ? debtLedgerTotals(debt.entries.map(moveFromEntry))
    : { borrowed: debt.principal, settled: 0, interest: 0, left: debt.amount };
  if (totals.left <= 0) return debt;

  const steps = interestAccrualPlan(
    {
      amount: totals.left,
      monthlyInterestBps: debt.monthlyInterestBps,
      lastInterestMonth: debt.lastInterestMonth,
      date: debt.date,
    },
    asOfMonth
  );
  if (steps.length === 0) return debt;

  let lastMonth = debt.lastInterestMonth;
  await prisma.$transaction(async (tx) => {
    for (const step of steps) {
      lastMonth = step.month;
      if (step.interest <= 0) continue;
      await tx.debtEntry.create({
        data: {
          debtId: debt.id,
          kind: "INTEREST",
          amount: step.interest,
          balanceAfter: 0,
          date: `${step.month}-01`,
          note: "",
        },
      });
    }
    await persistBalances(tx, debt.id);
    await tx.debt.update({
      where: { id: debt.id },
      data: { lastInterestMonth: lastMonth },
    });
  });

  return prisma.debt.findUnique({ where: { id: debtId } });
}

export async function ensureDebtRepaymentCategory(householdId: string) {
  return prisma.category.upsert({
    where: { householdId_name: { householdId, name: "Debt repayment" } },
    create: {
      householdId,
      name: "Debt repayment",
      kind: "FAMILY",
      requiresBusiness: false,
    },
    update: {},
  });
}

export async function recordPersonBorrow(input: {
  householdId: string;
  memberId: string;
  person: string;
  principal: number;
  feeFixed: number;
  monthlyInterestBps: number;
  date: string;
  note: string;
  moneyPlaceId: string;
  expenseId?: string;
}) {
  await consolidateHouseholdDebts(input.householdId);
  const person = input.person.trim();
  if (!person) return { ok: false as const, error: "Name who you borrowed from." };
  if (input.feeFixed >= input.principal && !input.expenseId) {
    return { ok: false as const, error: "Fee must be less than the borrowed amount." };
  }

  await prisma.$transaction(async (tx) => {
    let debt = await findDebtByPerson(tx, input.householdId, person);
    if (!debt) {
      debt = await tx.debt.create({
        data: {
          householdId: input.householdId,
          memberId: input.memberId,
          person,
          principal: 0,
          amount: 0,
          feeFixed: input.feeFixed,
          monthlyInterestBps: input.monthlyInterestBps,
          date: input.date,
          note: input.note,
        },
      });
    }

    let incomeId: string | null = null;
    if (!input.expenseId) {
      const received = netReceived(input.principal, input.feeFixed);
      const income = await tx.income.create({
        data: {
          householdId: input.householdId,
          memberId: input.memberId,
          moneyPlaceId: input.moneyPlaceId,
          kind: "OTHER",
          amount: received,
          date: input.date,
          description:
            input.note ||
            `Borrowed from ${person}` +
              (input.feeFixed > 0 ? ` (fee ${(input.feeFixed / 100).toFixed(2)})` : ""),
        },
      });
      incomeId = income.id;
    } else {
      await tx.expense.update({
        where: { id: input.expenseId },
        data: { debtId: debt.id },
      });
    }

    await tx.debtEntry.create({
      data: {
        debtId: debt.id,
        kind: "BORROW",
        amount: input.principal,
        balanceAfter: 0,
        date: input.date,
        note: input.note,
        incomeId,
        expenseId: input.expenseId ?? null,
      },
    });
    await persistBalances(tx, debt.id);
  });

  return { ok: true as const };
}

export async function recordPersonRepay(input: {
  householdId: string;
  memberId: string;
  debtId: string;
  amount: number;
  date: string;
  moneyPlaceId: string;
  categoryId: string;
}) {
  await consolidateHouseholdDebts(input.householdId);
  const debt = await prisma.debt.findFirst({
    where: { id: input.debtId, householdId: input.householdId },
    include: { entries: true },
  });
  if (!debt) return { ok: false as const, error: "Debt not found." };
  const totals = debtLedgerTotals(debt.entries.map(moveFromEntry));
  if (input.amount > totals.left) {
    return { ok: false as const, error: "That is more than is still owed." };
  }

  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        householdId: input.householdId,
        memberId: input.memberId,
        moneyPlaceId: input.moneyPlaceId,
        categoryId: input.categoryId,
        amount: input.amount,
        date: input.date,
        description: `Repay ${debt.person}`,
        funding: "OWN",
        isCardPayoff: false,
      },
    });
    await tx.debtEntry.create({
      data: {
        debtId: debt.id,
        kind: "REPAY",
        amount: input.amount,
        balanceAfter: 0,
        date: input.date,
        note: "",
        expenseId: expense.id,
      },
    });
    await persistBalances(tx, debt.id);
  });

  return { ok: true as const };
}

export async function deleteDebtEntryForHousehold(householdId: string, entryId: string) {
  await consolidateHouseholdDebts(householdId);
  const entry = await prisma.debtEntry.findFirst({
    where: { id: entryId, debt: { householdId } },
    include: {
      income: { include: { payslipReceipt: { select: { id: true } }, invoicePayment: true } },
      expense: true,
    },
  });
  if (!entry) return { ok: false as const, error: "That debt line was not found." };
  if (entry.income?.payslipReceipt) {
    return { ok: false as const, error: "Payslip income can’t be deleted here." };
  }
  if (entry.income?.invoicePayment) {
    return { ok: false as const, error: "This income came from an invoice payment." };
  }
  if (entry.expense?.isCardPayoff || entry.expense?.loanPaymentId || entry.expense?.billPaymentId) {
    return { ok: false as const, error: "That payment can’t be deleted here." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await dropDebtEntry(tx, entry.id);
      if (entry.incomeId) {
        await tx.income.delete({ where: { id: entry.incomeId } });
      }
      if (entry.expenseId) {
        await tx.expense.delete({ where: { id: entry.expenseId } });
      }
    });
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not delete that debt line.",
    };
  }
  return { ok: true as const };
}
