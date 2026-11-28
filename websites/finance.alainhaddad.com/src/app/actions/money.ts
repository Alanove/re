"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { canAddIncome, canManageDebts, isAdultRole } from "@/lib/roles";
import { requireAdult, requireMember } from "@/lib/session";
import { dueDateForCycle, todayIsoDate } from "@/lib/utils";
import { bpsFromPercent } from "@/lib/debt";
import {
  accrueDebtInterest,
  consolidateHouseholdDebts,
  deleteDebtEntryForHousehold,
  dropDebtEntry,
  ensureDebtRepaymentCategory,
  entryForExpense,
  entryForIncome,
  recordPersonBorrow,
  recordPersonRepay,
} from "@/lib/debt-service";
import { deriveInvoiceStatus } from "@/lib/invoice";
import { toMinorUnits } from "@/lib/money";
import {
  getMoneyPlaceBalance,
  resolveMoneyPlaceId,
} from "@/lib/money-places";
import {
  deleteReceiptFile,
  receiptFileFromFormData,
  saveExpenseReceipt,
  validateReceiptFile,
} from "@/lib/receipts";

export type ActionResult = { ok: true } | { ok: false; error: string };

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

const nonNegativeAmountSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const raw = String(value ?? "0").trim();
  if (!raw) return 0;
  try {
    const minor = toMinorUnits(raw);
    if (minor < 0) {
      ctx.addIssue({ code: "custom", message: "Amount cannot be negative" });
      return z.NEVER;
    }
    return minor;
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid amount" });
    return z.NEVER;
  }
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function revalidateBooks() {
  revalidatePath("/");
  revalidatePath("/activity");
  revalidatePath("/plan", "layout");
  revalidatePath("/reports");
  revalidatePath("/work", "layout");
}

export async function addIncomeAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireMember();
  if (!canAddIncome(member.role)) {
    return { ok: false, error: "Children cannot add income." };
  }

  const schema = z.object({
    amount: amountSchema,
    kind: z.enum(["SALARY", "FREELANCE", "OTHER"]),
    date: dateSchema.default(todayIsoDate()),
    description: z.string().trim().max(200).default(""),
    memberId: z.string().optional(),
    customerId: z.string().optional().or(z.literal("")),
    customerName: z.string().trim().max(120).optional().or(z.literal("")),
    customerPhone: z.string().trim().max(40).optional().or(z.literal("")),
    customerEmail: z.string().trim().max(320).optional().or(z.literal("")),
    moneyPlaceId: z.string().optional().or(z.literal("")),
  });

  const parsed = schema.safeParse({
    amount: formData.get("amount"),
    kind: formData.get("kind"),
    date: formData.get("date") || todayIsoDate(),
    description: formData.get("description") ?? "",
    memberId: formData.get("memberId") || undefined,
    customerId: formData.get("customerId") ?? "",
    customerName: formData.get("customerName") ?? "",
    customerPhone: formData.get("customerPhone") ?? "",
    customerEmail: formData.get("customerEmail") ?? "",
    moneyPlaceId: formData.get("moneyPlaceId") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the income fields." };
  }

  const memberId = parsed.data.memberId || member.id;
  const target = await prisma.member.findFirst({
    where: { id: memberId, householdId: member.householdId },
  });
  if (!target) {
    return { ok: false, error: "Member not found." };
  }

  const place = await resolveMoneyPlaceId({
    householdId: member.householdId,
    memberId: member.id,
    displayName: member.displayName,
    moneyPlaceId: parsed.data.moneyPlaceId,
  });
  if (!place.ok) return place;

  let customerId: string | null = null;
  if (parsed.data.kind === "FREELANCE") {
    let customer = parsed.data.customerId
      ? await prisma.customer.findFirst({
          where: { id: parsed.data.customerId, householdId: member.householdId },
        })
      : null;

    const customerName = parsed.data.customerName?.trim();
    if (!customer && customerName) {
      const existing = await prisma.customer.findMany({
        where: { householdId: member.householdId },
      });
      customer =
        existing.find((row) => row.name.toLowerCase() === customerName.toLowerCase()) ??
        (await prisma.customer.create({
          data: {
            householdId: member.householdId,
            name: customerName,
          },
        }));
    }

    if (!customer) {
      return { ok: false, error: "Pick or type a customer." };
    }

    const phone = parsed.data.customerPhone?.trim() ?? "";
    const email = parsed.data.customerEmail?.trim() ?? "";
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(phone && !customer.phone ? { phone } : {}),
        ...(email && !customer.email ? { email } : {}),
      },
    });

    customerId = customer.id;
  }

  await prisma.income.create({
    data: {
      householdId: member.householdId,
      memberId: target.id,
      moneyPlaceId: place.placeId,
      kind: parsed.data.kind,
      amount: parsed.data.amount,
      date: parsed.data.date,
      description: parsed.data.description,
      customerId,
    },
  });

  revalidateBooks();
  return { ok: true };
}

export async function addExpenseAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireMember();

  const schema = z.object({
    amount: amountSchema,
    date: dateSchema.default(todayIsoDate()),
    description: z.string().trim().max(200).default(""),
    categoryId: z.string().optional().or(z.literal("")),
    categoryName: z.string().trim().max(80).optional().or(z.literal("")),
    businessId: z.string().optional().or(z.literal("")),
    funding: z.enum(["OWN", "CARD", "BORROWED"]),
    creditCardId: z.string().optional().or(z.literal("")),
    debtPerson: z.string().trim().max(80).optional().or(z.literal("")),
    memberId: z.string().optional(),
    moneyPlaceId: z.string().optional().or(z.literal("")),
  });

  const parsed = schema.safeParse({
    amount: formData.get("amount"),
    date: formData.get("date") || todayIsoDate(),
    description: formData.get("description") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    categoryName: formData.get("categoryName") ?? "",
    businessId: formData.get("businessId") ?? "",
    funding: formData.get("funding") || "OWN",
    creditCardId: formData.get("creditCardId") ?? "",
    debtPerson: formData.get("debtPerson") ?? "",
    memberId: formData.get("memberId") || undefined,
    moneyPlaceId: formData.get("moneyPlaceId") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the expense fields." };
  }

  if (!isAdultRole(member.role)) {
    if (parsed.data.funding !== "OWN") {
      return { ok: false, error: "Children can only add own spending." };
    }
  }

  let moneyPlaceId: string | null = null;
  if (parsed.data.funding === "OWN") {
    const place = await resolveMoneyPlaceId({
      householdId: member.householdId,
      memberId: member.id,
      displayName: member.displayName,
      moneyPlaceId: parsed.data.moneyPlaceId,
    });
    if (!place.ok) return place;
    moneyPlaceId = place.placeId;
    const available = await getMoneyPlaceBalance(member.householdId, moneyPlaceId);
    if (parsed.data.amount > available) {
      return { ok: false, error: "Not enough in that place. Use another place, card, or borrow." };
    }
  }

  const memberId = !isAdultRole(member.role)
    ? member.id
    : parsed.data.memberId || member.id;

  const target = await prisma.member.findFirst({
    where: { id: memberId, householdId: member.householdId },
  });
  if (!target) {
    return { ok: false, error: "Member not found." };
  }

  let category = parsed.data.categoryId
    ? await prisma.category.findFirst({
        where: { id: parsed.data.categoryId, householdId: member.householdId },
      })
    : null;

  const categoryName = parsed.data.categoryName?.trim();
  if (!category && categoryName) {
    category = await prisma.category.upsert({
      where: {
        householdId_name: { householdId: member.householdId, name: categoryName },
      },
      create: {
        householdId: member.householdId,
        name: categoryName,
        kind: "FAMILY",
        requiresBusiness: false,
      },
      update: {},
    });
  }

  if (!category) {
    return { ok: false, error: "Pick or type a category." };
  }

  let businessId: string | null = parsed.data.businessId || null;
  if (category.requiresBusiness) {
    if (!businessId) {
      return { ok: false, error: "Pick a business for this category." };
    }
    const business = await prisma.business.findFirst({
      where: { id: businessId, householdId: member.householdId },
    });
    if (!business) {
      return { ok: false, error: "Business not found." };
    }
  } else {
    businessId = businessId || null;
  }

  let creditCardId: string | null = null;
  let cardCycleId: string | null = null;

  if (parsed.data.funding === "CARD") {
    if (!parsed.data.creditCardId) {
      return { ok: false, error: "Pick a card." };
    }
    const card = await prisma.creditCard.findFirst({
      where: { id: parsed.data.creditCardId, householdId: member.householdId },
    });
    if (!card) {
      return { ok: false, error: "Card not found." };
    }
    creditCardId = card.id;
    const dueDate = dueDateForCycle(parsed.data.date, card.payoffDay);
    let cycle = await prisma.cardCycle.findFirst({
      where: {
        creditCardId: card.id,
        dueDate,
        settledAt: null,
      },
    });
    if (!cycle) {
      cycle = await prisma.cardCycle.create({
        data: { creditCardId: card.id, dueDate },
      });
    }
    cardCycleId = cycle.id;
  }

  let borrowedPerson: string | null = null;
  if (parsed.data.funding === "BORROWED") {
    if (!canManageDebts(member.role)) {
      return { ok: false, error: "Children cannot record borrowed money." };
    }
    const person = parsed.data.debtPerson?.trim();
    if (!person) {
      return { ok: false, error: "Name who you borrowed from." };
    }
    borrowedPerson = person;
  }

  const receiptFile = receiptFileFromFormData(formData);
  if (receiptFile) {
    const checked = validateReceiptFile(receiptFile);
    if (!checked.ok) {
      return { ok: false, error: checked.error };
    }
  }

  const expense = await prisma.expense.create({
    data: {
      householdId: member.householdId,
      memberId: target.id,
      moneyPlaceId,
      categoryId: category.id,
      businessId,
      amount: parsed.data.amount,
      date: parsed.data.date,
      description: parsed.data.description,
      funding: parsed.data.funding,
      creditCardId,
      cardCycleId,
      isCardPayoff: false,
    },
  });

  if (borrowedPerson) {
    const borrowed = await recordPersonBorrow({
      householdId: member.householdId,
      memberId: target.id,
      person: borrowedPerson,
      principal: parsed.data.amount,
      feeFixed: 0,
      monthlyInterestBps: 0,
      date: parsed.data.date,
      note: parsed.data.description,
      moneyPlaceId: moneyPlaceId ?? "",
      expenseId: expense.id,
    });
    if (!borrowed.ok) {
      await prisma.expense.delete({ where: { id: expense.id } });
      return borrowed;
    }
  }

  if (receiptFile) {
    try {
      const saved = await saveExpenseReceipt({
        householdId: member.householdId,
        expenseId: expense.id,
        file: receiptFile,
      });
      await prisma.expense.update({
        where: { id: expense.id },
        data: { receiptPath: saved.relativePath, receiptMime: saved.mime },
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not save receipt.",
      };
    }
  }

  revalidateBooks();
  return { ok: true };
}

export async function addBorrowedAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const schema = z.object({
    amount: amountSchema,
    date: dateSchema.default(todayIsoDate()),
    person: z.string().trim().min(1).max(80),
    note: z.string().trim().max(200).default(""),
    feeFixed: nonNegativeAmountSchema.default(0),
    monthlyInterestPercent: z.union([z.string(), z.number()]).optional().default("0"),
  });
  const parsed = schema.safeParse({
    amount: formData.get("amount"),
    date: formData.get("date") || todayIsoDate(),
    person: formData.get("person"),
    note: formData.get("description") ?? formData.get("note") ?? "",
    feeFixed: formData.get("feeFixed") ?? "0",
    monthlyInterestPercent: formData.get("monthlyInterestPercent") ?? "0",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the borrowed fields." };
  }

  let monthlyInterestBps = 0;
  try {
    monthlyInterestBps = bpsFromPercent(parsed.data.monthlyInterestPercent ?? 0);
  } catch {
    return { ok: false, error: "Check the monthly interest percent." };
  }

  const place = await resolveMoneyPlaceId({
    householdId: member.householdId,
    memberId: member.id,
    displayName: member.displayName,
    moneyPlaceId: String(formData.get("moneyPlaceId") ?? ""),
  });
  if (!place.ok) return place;

  const borrowed = await recordPersonBorrow({
    householdId: member.householdId,
    memberId: member.id,
    person: parsed.data.person,
    principal: parsed.data.amount,
    feeFixed: parsed.data.feeFixed,
    monthlyInterestBps,
    date: parsed.data.date,
    note: parsed.data.note,
    moneyPlaceId: place.placeId,
  });
  if (!borrowed.ok) return borrowed;

  revalidateBooks();
  return { ok: true };
}

export async function repayDebtAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const schema = z.object({
    debtId: z.string().min(1),
    amount: amountSchema,
    date: dateSchema.default(todayIsoDate()),
    moneyPlaceId: z.string().optional().or(z.literal("")),
  });
  const parsed = schema.safeParse({
    debtId: formData.get("debtId"),
    amount: formData.get("amount"),
    date: formData.get("date") || todayIsoDate(),
    moneyPlaceId: formData.get("moneyPlaceId") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the repayment." };
  }

  await accrueDebtInterest(parsed.data.debtId);

  const place = await resolveMoneyPlaceId({
    householdId: member.householdId,
    memberId: member.id,
    displayName: member.displayName,
    moneyPlaceId: parsed.data.moneyPlaceId,
  });
  if (!place.ok) return place;
  const available = await getMoneyPlaceBalance(member.householdId, place.placeId);
  if (parsed.data.amount > available) {
    return { ok: false, error: "Not enough in that place. Use card or borrow." };
  }

  const category = await ensureDebtRepaymentCategory(member.householdId);
  const repaid = await recordPersonRepay({
    householdId: member.householdId,
    memberId: member.id,
    debtId: parsed.data.debtId,
    amount: parsed.data.amount,
    date: parsed.data.date,
    moneyPlaceId: place.placeId,
    categoryId: category.id,
  });
  if (!repaid.ok) return repaid;

  revalidateBooks();
  return { ok: true };
}

export async function createBusinessAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return;
  }
  await prisma.business.create({
    data: { householdId: member.householdId, name },
  });
  revalidatePath("/plan", "layout");
  revalidatePath("/");
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const schema = z.object({
    name: z.string().trim().min(1).max(80),
    kind: z.enum(["FAMILY", "BUSINESS"]),
  });
  const parsed = schema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) {
    return;
  }
  try {
    await prisma.category.create({
      data: {
        householdId: member.householdId,
        name: parsed.data.name,
        kind: parsed.data.kind,
        requiresBusiness: parsed.data.kind === "BUSINESS",
      },
    });
  } catch {
    return;
  }
  revalidateBooks();
}

export async function updateIncomeAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireMember();
  if (!canAddIncome(member.role)) {
    return { ok: false, error: "Children cannot edit income." };
  }

  const schema = z.object({
    id: z.string().min(1),
    amount: amountSchema,
    kind: z.enum(["SALARY", "FREELANCE", "OTHER"]),
    date: dateSchema.default(todayIsoDate()),
    description: z.string().trim().max(200).default(""),
    customerId: z.string().optional().or(z.literal("")),
    customerName: z.string().trim().max(120).optional().or(z.literal("")),
    moneyPlaceId: z.string().optional().or(z.literal("")),
  });

  const parsed = schema.safeParse({
    id: formData.get("id"),
    amount: formData.get("amount"),
    kind: formData.get("kind"),
    date: formData.get("date") || todayIsoDate(),
    description: formData.get("description") ?? "",
    customerId: formData.get("customerId") ?? "",
    customerName: formData.get("customerName") ?? "",
    moneyPlaceId: formData.get("moneyPlaceId") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the income fields." };
  }

  const income = await prisma.income.findFirst({
    where: { id: parsed.data.id, householdId: member.householdId },
    include: { payslipReceipt: { select: { id: true } } },
  });
  if (!income) {
    return { ok: false, error: "Income not found." };
  }
  if (income.invoiceId) {
    return { ok: false, error: "Edit this from Work (invoice payment)." };
  }
  if (income.payslipReceipt) {
    return { ok: false, error: "Payslip income can’t be edited here." };
  }
  const linkedBorrow = await entryForIncome(member.householdId, income.id);
  if (linkedBorrow) {
    return {
      ok: false,
      error: "This is tied to a debt. Delete it to undo, or add and settle on Debts.",
    };
  }

  const place = await resolveMoneyPlaceId({
    householdId: member.householdId,
    memberId: member.id,
    displayName: member.displayName,
    moneyPlaceId: parsed.data.moneyPlaceId,
  });
  if (!place.ok) return place;

  let customerId: string | null = null;
  if (parsed.data.kind === "FREELANCE") {
    let customer = parsed.data.customerId
      ? await prisma.customer.findFirst({
          where: { id: parsed.data.customerId, householdId: member.householdId },
        })
      : null;

    const customerName = parsed.data.customerName?.trim();
    if (!customer && customerName) {
      const existing = await prisma.customer.findMany({
        where: { householdId: member.householdId },
      });
      customer =
        existing.find((row) => row.name.toLowerCase() === customerName.toLowerCase()) ??
        (await prisma.customer.create({
          data: { householdId: member.householdId, name: customerName },
        }));
    }
    if (!customer) {
      return { ok: false, error: "Pick or type a customer." };
    }
    customerId = customer.id;
  }

  await prisma.income.update({
    where: { id: income.id },
    data: {
      amount: parsed.data.amount,
      kind: parsed.data.kind,
      date: parsed.data.date,
      description: parsed.data.description,
      customerId,
      moneyPlaceId: place.placeId,
    },
  });

  revalidateBooks();
  return { ok: true };
}

export async function deleteIncomeAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireMember();
  if (!canAddIncome(member.role)) {
    return { ok: false, error: "Children cannot delete income." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { ok: false, error: "Missing income." };
  }

  const income = await prisma.income.findFirst({
    where: { id, householdId: member.householdId },
    include: {
      payslipReceipt: { select: { id: true } },
      invoicePayment: true,
      invoice: { include: { lines: true, payments: true } },
    },
  });
  if (!income) {
    return { ok: false, error: "Income not found." };
  }
  if (income.payslipReceipt) {
    return { ok: false, error: "Payslip income can’t be deleted here." };
  }

  await consolidateHouseholdDebts(member.householdId);
  const linkedBorrow = await entryForIncome(member.householdId, income.id);

  if (income.invoicePayment && income.invoice) {
    const invoiceId = income.invoice.id;
    const remainingPayments = income.invoice.payments.filter(
      (payment) => payment.id !== income.invoicePayment!.id
    );
    const status = deriveInvoiceStatus(
      income.invoice.status,
      income.invoice.lines,
      income.invoice.taxBps,
      remainingPayments
    );

    await prisma.$transaction(async (tx) => {
      await tx.invoicePayment.delete({ where: { id: income.invoicePayment!.id } });
      await tx.income.delete({ where: { id: income.id } });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status },
      });
    });
  } else {
    try {
      await prisma.$transaction(async (tx) => {
        if (linkedBorrow) await dropDebtEntry(tx, linkedBorrow.id);
        await tx.income.delete({ where: { id: income.id } });
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not delete.",
      };
    }
  }

  revalidateBooks();
  return { ok: true };
}

export async function updateExpenseAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireMember();

  const schema = z.object({
    id: z.string().min(1),
    amount: amountSchema,
    date: dateSchema.default(todayIsoDate()),
    description: z.string().trim().max(200).default(""),
    categoryId: z.string().optional().or(z.literal("")),
    categoryName: z.string().trim().max(80).optional().or(z.literal("")),
    businessId: z.string().optional().or(z.literal("")),
    moneyPlaceId: z.string().optional().or(z.literal("")),
  });

  const parsed = schema.safeParse({
    id: formData.get("id"),
    amount: formData.get("amount"),
    date: formData.get("date") || todayIsoDate(),
    description: formData.get("description") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    categoryName: formData.get("categoryName") ?? "",
    businessId: formData.get("businessId") ?? "",
    moneyPlaceId: formData.get("moneyPlaceId") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the expense fields." };
  }

  const expense = await prisma.expense.findFirst({
    where: { id: parsed.data.id, householdId: member.householdId },
  });
  if (!expense) {
    return { ok: false, error: "Expense not found." };
  }
  if (!isAdultRole(member.role) && expense.memberId !== member.id) {
    return { ok: false, error: "You can only edit your own expenses." };
  }
  if (expense.isCardPayoff) {
    return { ok: false, error: "Card payoff can’t be edited here." };
  }
  if (expense.loanPaymentId) {
    return { ok: false, error: "Loan payment can’t be edited here." };
  }
  const linkedDebt = await entryForExpense(member.householdId, expense.id);
  if (expense.debtId || linkedDebt) {
    return {
      ok: false,
      error: "This is tied to a debt. Delete it to undo, or add and settle on Debts.",
    };
  }

  const amountEditable = expense.funding === "OWN";
  const nextAmount = amountEditable ? parsed.data.amount : expense.amount;

  let moneyPlaceId = expense.moneyPlaceId;
  if (expense.funding === "OWN") {
    const place = await resolveMoneyPlaceId({
      householdId: member.householdId,
      memberId: member.id,
      displayName: member.displayName,
      moneyPlaceId: parsed.data.moneyPlaceId,
    });
    if (!place.ok) return place;
    moneyPlaceId = place.placeId;

    if (nextAmount > expense.amount) {
      const available = await getMoneyPlaceBalance(member.householdId, moneyPlaceId);
      const samePlace = expense.moneyPlaceId === moneyPlaceId;
      const headroom = samePlace ? available + expense.amount : available;
      if (nextAmount > headroom) {
        return { ok: false, error: "Not enough in that place for this increase." };
      }
    }
  }

  let category = parsed.data.categoryId
    ? await prisma.category.findFirst({
        where: { id: parsed.data.categoryId, householdId: member.householdId },
      })
    : null;

  const categoryName = parsed.data.categoryName?.trim();
  if (!category && categoryName) {
    category = await prisma.category.upsert({
      where: {
        householdId_name: { householdId: member.householdId, name: categoryName },
      },
      create: {
        householdId: member.householdId,
        name: categoryName,
        kind: "FAMILY",
        requiresBusiness: false,
      },
      update: {},
    });
  }
  if (!category) {
    return { ok: false, error: "Pick or type a category." };
  }

  let businessId: string | null = parsed.data.businessId || null;
  if (category.requiresBusiness) {
    if (!businessId) {
      return { ok: false, error: "Pick a business for this category." };
    }
    const business = await prisma.business.findFirst({
      where: { id: businessId, householdId: member.householdId },
    });
    if (!business) {
      return { ok: false, error: "Business not found." };
    }
  } else {
    businessId = businessId || null;
  }

  const removeReceipt = String(formData.get("removeReceipt") ?? "") === "1";
  const receiptFile = receiptFileFromFormData(formData);
  if (receiptFile) {
    const checked = validateReceiptFile(receiptFile);
    if (!checked.ok) {
      return { ok: false, error: checked.error };
    }
  }

  let receiptPath = expense.receiptPath;
  let receiptMime = expense.receiptMime;

  if (removeReceipt && !receiptFile) {
    await deleteReceiptFile(expense.receiptPath);
    receiptPath = null;
    receiptMime = null;
  } else if (receiptFile) {
    try {
      const saved = await saveExpenseReceipt({
        householdId: member.householdId,
        expenseId: expense.id,
        file: receiptFile,
      });
      if (expense.receiptPath && expense.receiptPath !== saved.relativePath) {
        await deleteReceiptFile(expense.receiptPath);
      }
      receiptPath = saved.relativePath;
      receiptMime = saved.mime;
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not save receipt.",
      };
    }
  }

  await prisma.expense.update({
    where: { id: expense.id },
    data: {
      amount: nextAmount,
      date: parsed.data.date,
      description: parsed.data.description,
      categoryId: category.id,
      businessId,
      moneyPlaceId,
      receiptPath,
      receiptMime,
    },
  });

  revalidateBooks();
  return { ok: true };
}

export async function deleteExpenseAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireMember();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { ok: false, error: "Missing expense." };
  }

  const expense = await prisma.expense.findFirst({
    where: { id, householdId: member.householdId },
  });
  if (!expense) {
    return { ok: false, error: "Expense not found." };
  }
  if (!isAdultRole(member.role) && expense.memberId !== member.id) {
    return { ok: false, error: "You can only delete your own expenses." };
  }
  if (expense.isCardPayoff) {
    return { ok: false, error: "Card payoff can’t be deleted here." };
  }
  if (expense.loanPaymentId) {
    return { ok: false, error: "Loan payment can’t be deleted here." };
  }
  if (expense.billPaymentId) {
    return { ok: false, error: "Bill payment can’t be deleted here." };
  }

  await consolidateHouseholdDebts(member.householdId);
  const linkedDebt = await entryForExpense(member.householdId, expense.id);
  try {
    await prisma.$transaction(async (tx) => {
      if (linkedDebt) await dropDebtEntry(tx, linkedDebt.id);
      await tx.expense.delete({ where: { id: expense.id } });
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not delete.",
    };
  }
  await deleteReceiptFile(expense.receiptPath);

  revalidateBooks();
  return { ok: true };
}

function redirectWithError(formData: FormData, fallback: string, error: string): never {
  const next = String(formData.get("next") ?? fallback);
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : fallback;
  const path = safe.split("?")[0] || fallback;
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

/** Form-compatible wrapper for settle buttons on Home and Plan. */
export async function repayDebtFormAction(formData: FormData): Promise<void> {
  const result = await repayDebtAction(formData);
  if (!result.ok) redirectWithError(formData, "/", result.error);
}

export async function addBorrowedFormAction(formData: FormData): Promise<void> {
  const result = await addBorrowedAction(formData);
  if (!result.ok) redirectWithError(formData, "/", result.error);
}

export async function deleteDebtEntryFormAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) redirectWithError(formData, "/plan/debts", "Missing debt line.");
  const result = await deleteDebtEntryForHousehold(member.householdId, entryId);
  if (!result.ok) redirectWithError(formData, "/plan/debts", result.error);
}
