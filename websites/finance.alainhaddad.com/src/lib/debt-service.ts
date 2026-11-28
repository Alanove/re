import { prisma } from "@/lib/db";
import { interestAccrualPlan } from "@/lib/debt";
import { currentMonth } from "@/lib/utils";

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
  const debt = await prisma.debt.findUnique({ where: { id: debtId } });
  if (!debt || debt.monthlyInterestBps <= 0 || debt.amount <= 0) {
    return debt;
  }

  const steps = interestAccrualPlan(
    {
      amount: debt.amount,
      monthlyInterestBps: debt.monthlyInterestBps,
      lastInterestMonth: debt.lastInterestMonth,
      date: debt.date,
    },
    asOfMonth
  );

  if (steps.length === 0) {
    return debt;
  }

  let balance = debt.amount;
  let lastMonth = debt.lastInterestMonth;
  await prisma.$transaction(async (tx) => {
    for (const step of steps) {
      lastMonth = step.month;
      if (step.interest <= 0) continue;
      balance = step.balanceAfter;
      await tx.debtRepayment.create({
        data: {
          debtId: debt.id,
          amount: step.interest,
          date: `${step.month}-01`,
          kind: "INTEREST",
        },
      });
    }
    await tx.debt.update({
      where: { id: debt.id },
      data: {
        amount: balance,
        lastInterestMonth: lastMonth,
      },
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
