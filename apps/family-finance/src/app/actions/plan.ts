"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { billActiveInMonth } from "@/lib/bills";
import { prisma } from "@/lib/db";
import { toMinorUnits } from "@/lib/money";
import { getHouseholdCash } from "@/lib/money-service";
import { requireAdult } from "@/lib/session";
import { currentMonth, todayIsoDate } from "@/lib/utils";

const amountSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  try {
    const minor = toMinorUnits(value);
    if (minor <= 0) {
      ctx.addIssue({ code: "custom", message: "Amount must be positive" });
      return z.NEVER;
    }
    return minor;
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid amount" });
    return z.NEVER;
  }
});

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

function revalidatePlan() {
  revalidatePath("/plan", "layout");
  revalidatePath("/");
  revalidatePath("/activity");
  revalidatePath("/reports");
}

export async function createLoanAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const schema = z.object({
    name: z.string().trim().min(1).max(80),
    monthlyAmount: amountSchema,
    startMonth: monthSchema,
    endMonth: monthSchema,
  });
  const parsed = schema.safeParse({
    name: formData.get("name"),
    monthlyAmount: formData.get("monthlyAmount"),
    startMonth: formData.get("startMonth"),
    endMonth: formData.get("endMonth"),
  });
  if (!parsed.success || parsed.data.endMonth < parsed.data.startMonth) {
    return;
  }

  await prisma.loan.create({
    data: {
      householdId: member.householdId,
      name: parsed.data.name,
      monthlyAmount: parsed.data.monthlyAmount,
      startMonth: parsed.data.startMonth,
      endMonth: parsed.data.endMonth,
    },
  });
  revalidatePlan();
  return;
}

export async function markLoanPaidAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const loanId = String(formData.get("loanId") ?? "");
  const month = String(formData.get("month") ?? currentMonth());
  if (!loanId || !monthSchema.safeParse(month).success) {
    return;
  }

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, householdId: member.householdId, archivedAt: null },
  });
  if (!loan) {
    return;
  }

  const existing = await prisma.loanPayment.findUnique({
    where: { loanId_month: { loanId, month } },
  });
  if (existing) {
    return;
  }

  const category =
    (await prisma.category.findFirst({
      where: { householdId: member.householdId, name: "Home" },
    })) ??
    (await prisma.category.findFirst({
      where: { householdId: member.householdId, kind: "FAMILY" },
    }));
  if (!category) {
    return;
  }

  const cash = await getHouseholdCash(member.householdId);
  if (loan.monthlyAmount > cash) {
    redirect(
      `/?error=${encodeURIComponent("Not enough cash for this loan payment. Add income or borrow first.")}`
    );
  }

  await prisma.$transaction(async (tx) => {
    const payment = await tx.loanPayment.create({
      data: { loanId, month },
    });
    await tx.expense.create({
      data: {
        householdId: member.householdId,
        memberId: member.id,
        categoryId: category.id,
        amount: loan.monthlyAmount,
        date: `${month}-01`,
        description: `${loan.name} installment`,
        funding: "OWN",
        loanPaymentId: payment.id,
        isCardPayoff: false,
      },
    });
  });

  revalidatePlan();
  return;
}

export async function createCreditCardAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const schema = z.object({
    name: z.string().trim().min(1).max(80),
    payoffDay: z.coerce.number().int().min(1).max(31),
  });
  const parsed = schema.safeParse({
    name: formData.get("name"),
    payoffDay: formData.get("payoffDay"),
  });
  if (!parsed.success) {
    return;
  }

  await prisma.creditCard.create({
    data: {
      householdId: member.householdId,
      name: parsed.data.name,
      payoffDay: parsed.data.payoffDay,
    },
  });
  revalidatePlan();
  return;
}

export async function payCardCycleAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const cycleId = String(formData.get("cycleId") ?? "");
  if (!cycleId) {
    return;
  }

  const cycle = await prisma.cardCycle.findFirst({
    where: {
      id: cycleId,
      settledAt: null,
      creditCard: { householdId: member.householdId },
    },
    include: {
      expenses: { where: { isCardPayoff: false } },
      creditCard: true,
    },
  });
  if (!cycle) {
    return;
  }

  const total = cycle.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  if (total <= 0) {
    return;
  }

  const cash = await getHouseholdCash(member.householdId);
  if (total > cash) {
    redirect(`/?error=${encodeURIComponent("Not enough cash to pay the card. Add income or borrow first.")}`);
  }

  const category =
    (await prisma.category.findFirst({
      where: { householdId: member.householdId, name: "Home" },
    })) ??
    (await prisma.category.findFirst({
      where: { householdId: member.householdId },
    }));
  if (!category) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.cardCycle.update({
      where: { id: cycle.id },
      data: { settledAt: new Date(), settledAmount: total },
    });
    await tx.expense.create({
      data: {
        householdId: member.householdId,
        memberId: member.id,
        categoryId: category.id,
        amount: total,
        date: todayIsoDate(),
        description: `${cycle.creditCard.name} payoff`,
        funding: "OWN",
        creditCardId: cycle.creditCardId,
        cardCycleId: cycle.id,
        isCardPayoff: true,
      },
    });
  });

  revalidatePlan();
  return;
}

export async function createForecastAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const schema = z.object({
    name: z.string().trim().min(1).max(80),
    amount: amountSchema,
    month: monthSchema,
    savingsAccountId: z.string().trim().optional(),
  });
  const savingsRaw = String(formData.get("savingsAccountId") ?? "").trim();
  const parsed = schema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    month: formData.get("month"),
    savingsAccountId: savingsRaw || undefined,
  });
  if (!parsed.success) {
    return;
  }

  let savingsAccountId: string | null = null;
  if (parsed.data.savingsAccountId) {
    const account = await prisma.savingsAccount.findFirst({
      where: { id: parsed.data.savingsAccountId, householdId: member.householdId },
    });
    if (!account) {
      return;
    }
    savingsAccountId = account.id;
  }

  await prisma.forecast.create({
    data: {
      householdId: member.householdId,
      name: parsed.data.name,
      amount: parsed.data.amount,
      month: parsed.data.month,
      savingsAccountId,
    },
  });
  revalidatePlan();
  return;
}

export async function createBillAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const schema = z.object({
    name: z.string().trim().min(1).max(80),
    amount: amountSchema,
    dueDay: z.coerce.number().int().min(1).max(31),
    categoryId: z.string().trim().optional(),
    endMonth: z.union([monthSchema, z.literal("")]).optional(),
  });
  const categoryRaw = String(formData.get("categoryId") ?? "").trim();
  const endRaw = String(formData.get("endMonth") ?? "").trim();
  const parsed = schema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    dueDay: formData.get("dueDay"),
    categoryId: categoryRaw || undefined,
    endMonth: endRaw,
  });
  if (!parsed.success) {
    return;
  }

  let categoryId: string | null = null;
  if (parsed.data.categoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: parsed.data.categoryId,
        householdId: member.householdId,
        excludeFromSpending: false,
      },
    });
    if (!category) {
      return;
    }
    categoryId = category.id;
  }

  await prisma.bill.create({
    data: {
      householdId: member.householdId,
      name: parsed.data.name,
      amount: parsed.data.amount,
      dueDay: parsed.data.dueDay,
      categoryId,
      endMonth: parsed.data.endMonth || null,
    },
  });
  revalidatePlan();
}

export async function markBillPaidAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const billId = String(formData.get("billId") ?? "");
  const month = String(formData.get("month") ?? currentMonth());
  if (!billId || !monthSchema.safeParse(month).success) {
    return;
  }

  const bill = await prisma.bill.findFirst({
    where: { id: billId, householdId: member.householdId, archivedAt: null },
  });
  if (!bill || !billActiveInMonth(bill, month)) {
    return;
  }

  const existing = await prisma.billPayment.findUnique({
    where: { billId_month: { billId, month } },
  });
  if (existing) {
    return;
  }

  const category =
    (bill.categoryId
      ? await prisma.category.findFirst({
          where: { id: bill.categoryId, householdId: member.householdId },
        })
      : null) ??
    (await prisma.category.findFirst({
      where: { householdId: member.householdId, name: "Home" },
    })) ??
    (await prisma.category.findFirst({
      where: { householdId: member.householdId, kind: "FAMILY" },
    }));
  if (!category) {
    return;
  }

  const cash = await getHouseholdCash(member.householdId);
  if (bill.amount > cash) {
    redirect(
      `/?error=${encodeURIComponent("Not enough cash for this bill. Add income or borrow first.")}`
    );
  }

  const day = Math.min(
    bill.dueDay,
    new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()
  );
  const date = `${month}-${String(day).padStart(2, "0")}`;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.billPayment.create({
      data: { billId, month },
    });
    await tx.expense.create({
      data: {
        householdId: member.householdId,
        memberId: member.id,
        categoryId: category.id,
        amount: bill.amount,
        date,
        description: bill.name,
        funding: "OWN",
        billPaymentId: payment.id,
        isCardPayoff: false,
      },
    });
  });

  revalidatePlan();
}

export async function updateLoanAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const schema = z.object({
    loanId: z.string().min(1),
    name: z.string().trim().min(1).max(80),
    monthlyAmount: amountSchema,
    startMonth: monthSchema,
    endMonth: monthSchema,
  });
  const parsed = schema.safeParse({
    loanId: formData.get("loanId"),
    name: formData.get("name"),
    monthlyAmount: formData.get("monthlyAmount"),
    startMonth: formData.get("startMonth"),
    endMonth: formData.get("endMonth"),
  });
  if (!parsed.success || parsed.data.endMonth < parsed.data.startMonth) {
    return;
  }
  await prisma.loan.updateMany({
    where: { id: parsed.data.loanId, householdId: member.householdId, archivedAt: null },
    data: {
      name: parsed.data.name,
      monthlyAmount: parsed.data.monthlyAmount,
      startMonth: parsed.data.startMonth,
      endMonth: parsed.data.endMonth,
    },
  });
  revalidatePlan();
}

export async function archiveLoanAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const loanId = String(formData.get("loanId") ?? "");
  if (!loanId) return;
  await prisma.loan.updateMany({
    where: { id: loanId, householdId: member.householdId },
    data: { archivedAt: new Date() },
  });
  revalidatePlan();
}

export async function updateCreditCardAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const schema = z.object({
    cardId: z.string().min(1),
    name: z.string().trim().min(1).max(80),
    payoffDay: z.coerce.number().int().min(1).max(31),
  });
  const parsed = schema.safeParse({
    cardId: formData.get("cardId"),
    name: formData.get("name"),
    payoffDay: formData.get("payoffDay"),
  });
  if (!parsed.success) return;
  await prisma.creditCard.updateMany({
    where: { id: parsed.data.cardId, householdId: member.householdId, archivedAt: null },
    data: { name: parsed.data.name, payoffDay: parsed.data.payoffDay },
  });
  revalidatePlan();
}

export async function archiveCreditCardAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const cardId = String(formData.get("cardId") ?? "");
  if (!cardId) return;
  const open = await prisma.cardCycle.findFirst({
    where: {
      settledAt: null,
      creditCardId: cardId,
      creditCard: { householdId: member.householdId },
      expenses: { some: { isCardPayoff: false } },
    },
  });
  if (open) {
    redirect(`/?error=${encodeURIComponent("Pay off the open card cycle before archiving.")}`);
  }
  await prisma.creditCard.updateMany({
    where: { id: cardId, householdId: member.householdId },
    data: { archivedAt: new Date() },
  });
  revalidatePlan();
}

export async function updateForecastAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const schema = z.object({
    forecastId: z.string().min(1),
    name: z.string().trim().min(1).max(80),
    amount: amountSchema,
    month: monthSchema,
    savingsAccountId: z.string().trim().optional(),
  });
  const savingsRaw = String(formData.get("savingsAccountId") ?? "").trim();
  const parsed = schema.safeParse({
    forecastId: formData.get("forecastId"),
    name: formData.get("name"),
    amount: formData.get("amount"),
    month: formData.get("month"),
    savingsAccountId: savingsRaw || undefined,
  });
  if (!parsed.success) return;

  let savingsAccountId: string | null = null;
  if (parsed.data.savingsAccountId) {
    const account = await prisma.savingsAccount.findFirst({
      where: { id: parsed.data.savingsAccountId, householdId: member.householdId },
    });
    if (!account) return;
    savingsAccountId = account.id;
  }

  await prisma.forecast.updateMany({
    where: { id: parsed.data.forecastId, householdId: member.householdId, archivedAt: null },
    data: {
      name: parsed.data.name,
      amount: parsed.data.amount,
      month: parsed.data.month,
      savingsAccountId,
    },
  });
  revalidatePlan();
}

export async function archiveForecastAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const forecastId = String(formData.get("forecastId") ?? "");
  if (!forecastId) return;
  await prisma.forecast.updateMany({
    where: { id: forecastId, householdId: member.householdId },
    data: { archivedAt: new Date() },
  });
  revalidatePlan();
}

export async function updateBillAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const schema = z.object({
    billId: z.string().min(1),
    name: z.string().trim().min(1).max(80),
    amount: amountSchema,
    dueDay: z.coerce.number().int().min(1).max(31),
    categoryId: z.string().trim().optional(),
    endMonth: z.union([monthSchema, z.literal("")]).optional(),
  });
  const categoryRaw = String(formData.get("categoryId") ?? "").trim();
  const endRaw = String(formData.get("endMonth") ?? "").trim();
  const parsed = schema.safeParse({
    billId: formData.get("billId"),
    name: formData.get("name"),
    amount: formData.get("amount"),
    dueDay: formData.get("dueDay"),
    categoryId: categoryRaw || undefined,
    endMonth: endRaw,
  });
  if (!parsed.success) return;

  let categoryId: string | null = null;
  if (parsed.data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, householdId: member.householdId },
    });
    if (!category) return;
    categoryId = category.id;
  }

  await prisma.bill.updateMany({
    where: { id: parsed.data.billId, householdId: member.householdId, archivedAt: null },
    data: {
      name: parsed.data.name,
      amount: parsed.data.amount,
      dueDay: parsed.data.dueDay,
      categoryId,
      endMonth: parsed.data.endMonth || null,
    },
  });
  revalidatePlan();
}

export async function archiveBillAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const billId = String(formData.get("billId") ?? "");
  if (!billId) return;
  await prisma.bill.updateMany({
    where: { id: billId, householdId: member.householdId },
    data: { archivedAt: new Date() },
  });
  revalidatePlan();
}

export async function archiveDebtAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const debtId = String(formData.get("debtId") ?? "");
  if (!debtId) return;
  const debt = await prisma.debt.findFirst({
    where: { id: debtId, householdId: member.householdId },
    include: { repayments: true },
  });
  if (!debt) return;
  const repaid = debt.repayments
    .filter((row) => row.kind !== "INTEREST")
    .reduce((sum, row) => sum + row.amount, 0);
  const interest = debt.repayments
    .filter((row) => row.kind === "INTEREST")
    .reduce((sum, row) => sum + row.amount, 0);
  const remaining = Math.max(0, debt.principal + interest - repaid);
  if (remaining > 0) {
    redirect(`/?error=${encodeURIComponent("Pay the debt down to zero before archiving.")}`);
  }
  await prisma.debt.update({
    where: { id: debt.id },
    data: { amount: 0, note: debt.note ? `${debt.note} · archived` : "archived" },
  });
  revalidatePlan();
}
