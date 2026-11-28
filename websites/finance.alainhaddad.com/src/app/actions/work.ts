"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  deriveInvoiceStatus,
  invoiceRemainder,
  lineTotal,
} from "@/lib/invoice";
import { toMinorUnits } from "@/lib/money";
import { resolveMoneyPlaceId } from "@/lib/money-places";
import { requireAdult } from "@/lib/session";
import { todayIsoDate } from "@/lib/utils";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const amountSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  try {
    const minor = toMinorUnits(value);
    if (minor < 0) {
      ctx.addIssue({ code: "custom", message: "Amount must be zero or more" });
      return z.NEVER;
    }
    return minor;
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid amount" });
    return z.NEVER;
  }
});

const positiveAmountSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  try {
    const minor = toMinorUnits(value);
    if (minor <= 0) {
      ctx.addIssue({ code: "custom", message: "Amount must be more than zero" });
      return z.NEVER;
    }
    return minor;
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid amount" });
    return z.NEVER;
  }
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function revalidateWork() {
  revalidatePath("/work", "layout");
  revalidatePath("/");
  revalidatePath("/activity");
  revalidatePath("/reports");
}

function parseLinesFromForm(formData: FormData) {
  const descriptions = formData.getAll("lineDescription").map(String);
  const categoryIds = formData.getAll("lineCategoryId").map(String);
  const quantities = formData.getAll("lineQuantity").map(String);
  const unitAmounts = formData.getAll("lineUnitAmount").map(String);
  const discounts = formData.getAll("lineDiscount").map(String);

  const count = Math.max(
    descriptions.length,
    categoryIds.length,
    quantities.length,
    unitAmounts.length,
    discounts.length
  );

  const lines: {
    description: string;
    categoryId: string | null;
    quantity: number;
    unitAmount: number;
    discountAmount: number;
  }[] = [];

  for (let i = 0; i < count; i += 1) {
    const description = (descriptions[i] ?? "").trim();
    if (!description) {
      continue;
    }
    let unitAmount = 0;
    let discountAmount = 0;
    try {
      unitAmount = toMinorUnits(unitAmounts[i] || "0");
      discountAmount = toMinorUnits(discounts[i] || "0");
    } catch {
      continue;
    }
    const quantity = Math.max(1, Math.floor(Number(quantities[i] || 1)) || 1);
    const categoryId = (categoryIds[i] ?? "").trim() || null;
    const gross = quantity * unitAmount;
    const cappedDiscount = Math.max(0, Math.min(discountAmount, gross));
    lines.push({
      description: description.slice(0, 200),
      categoryId,
      quantity,
      unitAmount: Math.max(0, unitAmount),
      discountAmount: cappedDiscount,
    });
  }

  return lines;
}

async function loadInvoiceForHousehold(invoiceId: string, householdId: string) {
  return prisma.invoice.findFirst({
    where: { id: invoiceId, householdId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
      customer: true,
    },
  });
}

export async function createCustomerAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const schema = z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().max(40).default(""),
    email: z.string().trim().max(320).default(""),
    note: z.string().trim().max(500).default(""),
  });
  const parsed = schema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return;
  }

  await prisma.customer.create({
    data: {
      householdId: member.householdId,
      ...parsed.data,
    },
  });
  revalidateWork();
}

export async function updateCustomerAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const schema = z.object({
    customerId: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().max(40).default(""),
    email: z.string().trim().max(320).default(""),
    note: z.string().trim().max(500).default(""),
  });
  const parsed = schema.safeParse({
    customerId: formData.get("customerId"),
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return;
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, householdId: member.householdId },
  });
  if (!customer) {
    return;
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      note: parsed.data.note,
    },
  });
  revalidateWork();
}

export async function deleteCustomerAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const customerId = String(formData.get("customerId") ?? "");
  if (!customerId) {
    return;
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, householdId: member.householdId },
    include: { _count: { select: { invoices: true } } },
  });
  if (!customer) {
    return;
  }
  // Invoices cascade-delete; refuse so history is not wiped by accident.
  if (customer._count.invoices > 0) {
    return;
  }

  await prisma.customer.delete({ where: { id: customer.id } });
  revalidateWork();
}

export async function createServiceAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const schema = z.object({
    customerId: z.string().min(1),
    kind: z.enum(["DOMAIN", "EMAIL", "HOSTING", "OTHER"]),
    name: z.string().trim().min(1).max(120),
    price: amountSchema,
    renewalDate: dateSchema,
    remindDays: z.coerce.number().int().min(0).max(365).default(14),
  });
  const parsed = schema.safeParse({
    customerId: formData.get("customerId"),
    kind: formData.get("kind"),
    name: formData.get("name"),
    price: formData.get("price"),
    renewalDate: formData.get("renewalDate"),
    remindDays: formData.get("remindDays") || 14,
  });
  if (!parsed.success) {
    return;
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, householdId: member.householdId },
  });
  if (!customer) {
    return;
  }

  await prisma.service.create({
    data: {
      customerId: customer.id,
      kind: parsed.data.kind,
      name: parsed.data.name,
      price: parsed.data.price,
      renewalDate: parsed.data.renewalDate,
      remindDays: parsed.data.remindDays,
    },
  });
  revalidateWork();
}

export async function createBillableCategoryAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const schema = z.object({
    name: z.string().trim().min(1).max(80),
    defaultPrice: amountSchema,
  });
  const parsed = schema.safeParse({
    name: formData.get("name"),
    defaultPrice: formData.get("defaultPrice"),
  });
  if (!parsed.success) {
    return;
  }

  await prisma.billableCategory.upsert({
    where: {
      householdId_name: { householdId: member.householdId, name: parsed.data.name },
    },
    create: {
      householdId: member.householdId,
      name: parsed.data.name,
      defaultPrice: parsed.data.defaultPrice,
    },
    update: { defaultPrice: parsed.data.defaultPrice },
  });
  revalidateWork();
}

export async function updateBillableCategoryAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const schema = z.object({
    id: z.string().min(1),
    defaultPrice: amountSchema,
  });
  const parsed = schema.safeParse({
    id: formData.get("id"),
    defaultPrice: formData.get("defaultPrice"),
  });
  if (!parsed.success) {
    return;
  }

  const category = await prisma.billableCategory.findFirst({
    where: { id: parsed.data.id, householdId: member.householdId },
  });
  if (!category) {
    return;
  }

  await prisma.billableCategory.update({
    where: { id: category.id },
    data: { defaultPrice: parsed.data.defaultPrice },
  });
  revalidateWork();
}

export async function createInvoiceAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const schema = z.object({
    customerId: z.string().min(1),
    businessId: z.string().optional().or(z.literal("")),
    issueDate: dateSchema.default(todayIsoDate()),
    dueDate: dateSchema.default(todayIsoDate()),
    notes: z.string().trim().max(1000).default(""),
  });
  const parsed = schema.safeParse({
    customerId: formData.get("customerId"),
    businessId: formData.get("businessId") ?? "",
    issueDate: formData.get("issueDate") || todayIsoDate(),
    dueDate: formData.get("dueDate") || todayIsoDate(),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the invoice fields." };
  }

  const lines = parseLinesFromForm(formData);
  if (lines.length === 0) {
    return { ok: false, error: "Add at least one line." };
  }
  if (lines.some((line) => lineTotal(line) < 0)) {
    return { ok: false, error: "Line totals look wrong." };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, householdId: member.householdId },
  });
  if (!customer) {
    return { ok: false, error: "Customer not found." };
  }

  const categoryIds = lines.map((line) => line.categoryId).filter(Boolean) as string[];
  if (categoryIds.length > 0) {
    const categories = await prisma.billableCategory.findMany({
      where: { householdId: member.householdId, id: { in: categoryIds } },
      select: { id: true },
    });
    const allowed = new Set(categories.map((row) => row.id));
    for (const line of lines) {
      if (line.categoryId && !allowed.has(line.categoryId)) {
        line.categoryId = null;
      }
    }
  }

  const count = await prisma.invoice.count({ where: { householdId: member.householdId } });
  const number = `INV-${String(count + 1).padStart(4, "0")}`;

  const invoice = await prisma.invoice.create({
    data: {
      householdId: member.householdId,
      customerId: customer.id,
      memberId: member.id,
      businessId: parsed.data.businessId || null,
      number,
      status: "UNPAID",
      issueDate: parsed.data.issueDate,
      dueDate: parsed.data.dueDate,
      taxBps: member.household.invoiceTaxBps,
      notes: parsed.data.notes,
      lines: {
        create: lines.map((line, index) => ({
          description: line.description,
          categoryId: line.categoryId,
          quantity: line.quantity,
          unitAmount: line.unitAmount,
          discountAmount: line.discountAmount,
          sortOrder: index,
        })),
      },
    },
  });

  revalidateWork();
  return { ok: true, id: invoice.id };
}

export async function updateInvoiceAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) {
    return { ok: false, error: "Missing invoice." };
  }

  const invoice = await loadInvoiceForHousehold(invoiceId, member.householdId);
  if (!invoice) {
    return { ok: false, error: "Invoice not found." };
  }
  if (invoice.status === "VOID") {
    return { ok: false, error: "Void invoices cannot be edited." };
  }
  if (invoice.payments.length > 0) {
    return { ok: false, error: "Lines lock after the first payment." };
  }

  const schema = z.object({
    issueDate: dateSchema,
    dueDate: dateSchema,
    notes: z.string().trim().max(1000).default(""),
    businessId: z.string().optional().or(z.literal("")),
  });
  const parsed = schema.safeParse({
    issueDate: formData.get("issueDate") || invoice.issueDate,
    dueDate: formData.get("dueDate") || invoice.dueDate,
    notes: formData.get("notes") ?? invoice.notes,
    businessId: formData.get("businessId") ?? invoice.businessId ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the invoice fields." };
  }

  const lines = parseLinesFromForm(formData);
  if (lines.length === 0) {
    return { ok: false, error: "Add at least one line." };
  }

  await prisma.$transaction([
    prisma.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        issueDate: parsed.data.issueDate,
        dueDate: parsed.data.dueDate,
        notes: parsed.data.notes,
        businessId: parsed.data.businessId || null,
        status: "UNPAID",
        lines: {
          create: lines.map((line, index) => ({
            description: line.description,
            categoryId: line.categoryId,
            quantity: line.quantity,
            unitAmount: line.unitAmount,
            discountAmount: line.discountAmount,
            sortOrder: index,
          })),
        },
      },
    }),
  ]);

  revalidateWork();
  return { ok: true, id: invoice.id };
}

export async function recordInvoicePaymentAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const schema = z.object({
    invoiceId: z.string().min(1),
    amount: positiveAmountSchema,
    date: dateSchema.default(todayIsoDate()),
  });
  const parsed = schema.safeParse({
    invoiceId: formData.get("invoiceId"),
    amount: formData.get("amount"),
    date: formData.get("date") || todayIsoDate(),
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the payment amount and date." };
  }

  const invoice = await loadInvoiceForHousehold(parsed.data.invoiceId, member.householdId);
  if (!invoice) {
    return { ok: false, error: "Invoice not found." };
  }
  if (invoice.status === "VOID") {
    return { ok: false, error: "Void invoices cannot take payments." };
  }

  // Guard against Add-sheet mismatches (customer chip vs leftover invoice id).
  const formCustomerId = String(formData.get("customerId") ?? "").trim();
  if (formCustomerId && formCustomerId !== invoice.customerId) {
    return {
      ok: false,
      error: "That invoice belongs to a different customer. Pick again.",
    };
  }

  const remainder = invoiceRemainder(invoice.lines, invoice.taxBps, invoice.payments);
  if (remainder <= 0) {
    return { ok: false, error: "This invoice is already paid." };
  }
  if (parsed.data.amount > remainder) {
    return { ok: false, error: "Payment cannot exceed the amount still owed." };
  }

  const place = await resolveMoneyPlaceId({
    householdId: member.householdId,
    memberId: member.id,
    displayName: member.displayName,
    moneyPlaceId: String(formData.get("moneyPlaceId") ?? ""),
  });
  if (!place.ok) return place;

  const payment = await prisma.$transaction(async (tx) => {
    const income = await tx.income.create({
      data: {
        householdId: member.householdId,
        memberId: member.id,
        moneyPlaceId: place.placeId,
        kind: "FREELANCE",
        amount: parsed.data.amount,
        date: parsed.data.date,
        description: `Invoice ${invoice.number} payment`,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
      },
    });

    const created = await tx.invoicePayment.create({
      data: {
        invoiceId: invoice.id,
        amount: parsed.data.amount,
        date: parsed.data.date,
        incomeId: income.id,
      },
    });

    const payments = [...invoice.payments, created];
    const status = deriveInvoiceStatus(invoice.status, invoice.lines, invoice.taxBps, payments);
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status },
    });

    return created;
  });

  revalidateWork();
  return { ok: true, id: payment.id };
}

export async function voidInvoiceAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const invoice = await loadInvoiceForHousehold(invoiceId, member.householdId);
  if (!invoice) {
    return;
  }
  if (invoice.payments.length > 0) {
    return;
  }
  if (invoice.status === "VOID") {
    return;
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "VOID" },
  });
  revalidateWork();
}

export async function deleteInvoiceAction(formData: FormData): Promise<void> {
  const { member } = await requireAdult();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const invoice = await loadInvoiceForHousehold(invoiceId, member.householdId);
  if (!invoice) {
    return;
  }
  // Only void or unpaid drafts with no payments — paid history stays.
  if (invoice.payments.length > 0) {
    return;
  }
  if (invoice.status !== "VOID" && invoice.status !== "UNPAID") {
    return;
  }

  await prisma.invoice.delete({ where: { id: invoice.id } });
  revalidateWork();
}
