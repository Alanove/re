"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { convertMinor, roundMinorToWholeMajor } from "@/lib/fx";
import { toMinorUnits } from "@/lib/money";
import {
  getMoneyPlaceBalance,
  resolveMoneyPlaceId,
} from "@/lib/money-places";
import {
  DEFAULT_PAYSLIP_LINES,
  companyMatchFromBasic,
  companyMatchFromSrsp,
  lineAmount,
  netPaid,
  srspFromBasic,
} from "@/lib/payslip";
import {
  gramsToMg,
  potBalance,
  pricePerOzToPerGram,
  troyOzToMg,
  type MetalWeightUnit,
} from "@/lib/savings";
import { ensureSavingsCategory } from "@/lib/seed-categories";
import { requireAdult } from "@/lib/session";
import { currentMonth, todayIsoDate } from "@/lib/utils";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/savings");
  revalidatePath("/activity");
  revalidatePath("/reports");
  revalidatePath("/settings", "layout");
}

const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/);

export async function updateCurrencySettingsAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const parsed = z
    .object({
      booksCurrency: currencyCode,
      displayCurrency: currencyCode,
      entryCurrency: currencyCode,
    })
    .safeParse({
      booksCurrency: formData.get("booksCurrency"),
      displayCurrency: formData.get("displayCurrency"),
      entryCurrency: formData.get("entryCurrency"),
    });
  if (!parsed.success) {
    return { ok: false, error: "Use 3-letter currency codes." };
  }

  await prisma.household.update({
    where: { id: member.householdId },
    data: {
      booksCurrency: parsed.data.booksCurrency,
      displayCurrency: parsed.data.displayCurrency,
      entryCurrency: parsed.data.entryCurrency,
      currency: parsed.data.booksCurrency,
    },
  });
  revalidateAll();
  return { ok: true };
}

export async function updateInvoiceBrandAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const parsed = z
    .object({
      invoiceBrandName: z.string().trim().min(1).max(80),
    })
    .safeParse({
      invoiceBrandName: formData.get("invoiceBrandName"),
    });
  if (!parsed.success) {
    return { ok: false, error: "Enter a brand name for receipts and invoices." };
  }

  await prisma.household.update({
    where: { id: member.householdId },
    data: { invoiceBrandName: parsed.data.invoiceBrandName },
  });
  revalidatePath("/settings", "layout");
  revalidatePath("/work", "layout");
  return { ok: true };
}

export async function upsertFxRateAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const parsed = z
    .object({
      fromCurrency: currencyCode,
      toCurrency: currencyCode,
      rate: z.string().trim().min(1),
    })
    .safeParse({
      fromCurrency: formData.get("fromCurrency"),
      toCurrency: formData.get("toCurrency"),
      rate: formData.get("rate"),
    });
  if (!parsed.success) {
    return { ok: false, error: "Check the FX fields." };
  }
  const rateNum = Number(parsed.data.rate.replace(/,/g, ""));
  if (!Number.isFinite(rateNum) || rateNum <= 0) {
    return { ok: false, error: "Rate must be a positive number." };
  }

  await prisma.fxRate.upsert({
    where: {
      householdId_fromCurrency_toCurrency: {
        householdId: member.householdId,
        fromCurrency: parsed.data.fromCurrency,
        toCurrency: parsed.data.toCurrency,
      },
    },
    create: {
      householdId: member.householdId,
      fromCurrency: parsed.data.fromCurrency,
      toCurrency: parsed.data.toCurrency,
      rate: String(rateNum),
    },
    update: { rate: String(rateNum) },
  });
  revalidateAll();
  return { ok: true };
}

export async function ensureDefaultPayslipTemplateAction(
  formData?: FormData
): Promise<ActionResult> {
  void formData;
  const { member } = await requireAdult();
  const existing = await prisma.payslipTemplate.findFirst({
    where: { householdId: member.householdId, memberId: member.id },
  });
  if (existing) {
    return { ok: true };
  }

  let pension = await prisma.savingsAccount.findFirst({
    where: { householdId: member.householdId, kind: "PENSION" },
  });
  if (!pension) {
    pension = await prisma.savingsAccount.create({
      data: {
        householdId: member.householdId,
        name: "SRSP / Pension",
        kind: "PENSION",
      },
    });
  }

  await prisma.payslipTemplate.create({
    data: {
      householdId: member.householdId,
      memberId: member.id,
      name: "Payslip",
      salaryCurrency: "LBP",
      companyBps: 600,
      srspBps: 600,
      srspBase: "BASIC",
      appearFromDay: 24,
      savingsAccountId: pension.id,
      lines: {
        create: DEFAULT_PAYSLIP_LINES.map((line) => ({
          section: line.section,
          code: line.code,
          label: line.label,
          amount: BigInt(0),
          sortOrder: line.sortOrder,
        })),
      },
    },
  });

  const household = await prisma.household.findUniqueOrThrow({
    where: { id: member.householdId },
  });
  await prisma.household.update({
    where: { id: household.id },
    data: {
      booksCurrency: household.booksCurrency || "USD",
      displayCurrency: household.displayCurrency || "USD",
      entryCurrency: household.entryCurrency || "USD",
      currency: household.booksCurrency || household.currency || "USD",
    },
  });

  const fx = await prisma.fxRate.findFirst({
    where: {
      householdId: member.householdId,
      fromCurrency: "LBP",
      toCurrency: "USD",
    },
  });
  if (!fx) {
    await prisma.fxRate.create({
      data: {
        householdId: member.householdId,
        fromCurrency: "LBP",
        toCurrency: "USD",
        rate: "89500",
      },
    });
  }

  revalidateAll();
  return { ok: true };
}

export async function updatePayslipLineAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const lineId = String(formData.get("lineId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const startMonth = String(formData.get("startMonth") ?? "").trim() || null;
  const endMonth = String(formData.get("endMonth") ?? "").trim() || null;

  const line = await prisma.payslipLine.findFirst({
    where: { id: lineId, template: { householdId: member.householdId } },
    include: { template: true },
  });
  if (!line) {
    return { ok: false, error: "Line not found." };
  }

  let amount = BigInt(0);
  try {
    amount = BigInt(toMinorUnits(amountRaw));
  } catch {
    return { ok: false, error: "Invalid amount." };
  }

  await prisma.payslipLine.update({
    where: { id: line.id },
    data: {
      amount,
      startMonth,
      endMonth,
    },
  });
  revalidateAll();
  return { ok: true };
}

export async function updatePayslipTemplateAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const templateId = String(formData.get("templateId") ?? "");
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80),
      salaryCurrency: currencyCode,
      companyBps: z.coerce.number().int().min(0).max(10000),
      srspBps: z.coerce.number().int().min(0).max(10000),
      appearFromDay: z.coerce.number().int().min(1).max(28),
      savingsAccountId: z.string().optional().or(z.literal("")),
    })
    .safeParse({
      name: formData.get("name"),
      salaryCurrency: formData.get("salaryCurrency"),
      companyBps: formData.get("companyBps"),
      srspBps: formData.get("srspBps"),
      appearFromDay: formData.get("appearFromDay"),
      savingsAccountId: formData.get("savingsAccountId") ?? "",
    });
  if (!parsed.success) {
    return { ok: false, error: "Check the template settings." };
  }

  const template = await prisma.payslipTemplate.findFirst({
    where: { id: templateId, householdId: member.householdId },
  });
  if (!template) {
    return { ok: false, error: "Template not found." };
  }

  await prisma.payslipTemplate.update({
    where: { id: template.id },
    data: {
      name: parsed.data.name,
      salaryCurrency: parsed.data.salaryCurrency,
      companyBps: parsed.data.companyBps,
      srspBps: parsed.data.srspBps,
      appearFromDay: parsed.data.appearFromDay,
      savingsAccountId: parsed.data.savingsAccountId || null,
    },
  });
  revalidateAll();
  return { ok: true };
}

export async function recalcSrspAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const templateId = String(formData.get("templateId") ?? "");
  const template = await prisma.payslipTemplate.findFirst({
    where: { id: templateId, householdId: member.householdId },
    include: { lines: true },
  });
  if (!template) {
    return { ok: false, error: "Template not found." };
  }
  const basic = template.lines.find((line) => line.code === "BASIC");
  const srsp = template.lines.find((line) => line.code === "SRSP");
  if (!basic || !srsp) {
    return { ok: false, error: "Basic or SRSP line missing." };
  }
  const amount = srspFromBasic(basic.amount, template.srspBps);
  await prisma.payslipLine.update({
    where: { id: srsp.id },
    data: { amount },
  });
  revalidateAll();
  return { ok: true };
}

export async function markPayslipReceivedAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const templateId = String(formData.get("templateId") ?? "");
  const month = String(formData.get("month") ?? currentMonth());

  const template = await prisma.payslipTemplate.findFirst({
    where: { id: templateId, householdId: member.householdId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) {
    return { ok: false, error: "Template not found." };
  }

  const existing = await prisma.payslipReceipt.findUnique({
    where: { templateId_month: { templateId, month } },
  });
  if (existing) {
    return { ok: false, error: "This month is already marked received." };
  }

  const household = await prisma.household.findUniqueOrThrow({
    where: { id: member.householdId },
  });
  const booksCurrency = household.booksCurrency || household.currency || "USD";

  const confirmedLines = template.lines.map((line) => {
    const raw = formData.get(`line_${line.code}`);
    let amount = line.amount;
    if (raw !== null && String(raw).trim() !== "") {
      try {
        amount = BigInt(toMinorUnits(String(raw)));
      } catch {
        amount = line.amount;
      }
    }
    return {
      section: line.section,
      code: line.code,
      label: line.label,
      amount,
      startMonth: line.startMonth,
      endMonth: line.endMonth,
      active: line.active,
    };
  });

  const netSalary = netPaid(confirmedLines, month);
  const srspSalary = lineAmount(confirmedLines, "SRSP", month);
  const basic = lineAmount(confirmedLines, "BASIC", month);
  // Prefer matching the confirmed SRSP line (may differ from BASIC*bps).
  // Fall back to BASIC when there is no employee SRSP rate to scale from.
  const companySalary =
    template.srspBps > 0
      ? companyMatchFromSrsp(srspSalary, template.companyBps, template.srspBps)
      : companyMatchFromBasic(basic, template.companyBps);

  const rates = await prisma.fxRate.findMany({ where: { householdId: member.householdId } });
  const fxQuotes = rates.map((row) => ({
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    rate: row.rate,
  }));

  let netBooks: number;
  let srspBooks: number;
  let companyBooks: number;
  let fxRateUsed = "1";
  try {
    if (template.salaryCurrency.toUpperCase() === booksCurrency.toUpperCase()) {
      netBooks = Number(netSalary);
      srspBooks = Number(srspSalary);
      companyBooks = Number(companySalary);
    } else {
      const quote = rates.find(
        (row) =>
          row.fromCurrency.toUpperCase() === template.salaryCurrency.toUpperCase() &&
          row.toCurrency.toUpperCase() === booksCurrency.toUpperCase()
      );
      fxRateUsed = quote?.rate ?? "1";
      netBooks = roundMinorToWholeMajor(
        convertMinor(netSalary, template.salaryCurrency, booksCurrency, fxQuotes)
      );
      srspBooks = roundMinorToWholeMajor(
        convertMinor(srspSalary, template.salaryCurrency, booksCurrency, fxQuotes)
      );
      companyBooks = roundMinorToWholeMajor(
        convertMinor(companySalary, template.salaryCurrency, booksCurrency, fxQuotes)
      );
    }
  } catch {
    return {
      ok: false,
      error: `Set an FX rate from ${template.salaryCurrency} to ${booksCurrency} first.`,
    };
  }

  if (netBooks < 0) {
    return { ok: false, error: "Net paid cannot be negative." };
  }

  let pensionId = template.savingsAccountId;
  if (!pensionId) {
    const pension = await prisma.savingsAccount.findFirst({
      where: { householdId: member.householdId, kind: "PENSION" },
    });
    pensionId = pension?.id ?? null;
  }
  if (!pensionId && (srspBooks > 0 || companyBooks > 0)) {
    const pension = await prisma.savingsAccount.create({
      data: {
        householdId: member.householdId,
        name: "SRSP / Pension",
        kind: "PENSION",
      },
    });
    pensionId = pension.id;
  }

  // Date cash when it arrives (often ~26th), not the 1st of the settlement month.
  const payDate = todayIsoDate();

  const place = await resolveMoneyPlaceId({
    householdId: member.householdId,
    memberId: member.id,
    displayName: member.displayName,
    moneyPlaceId: String(formData.get("moneyPlaceId") ?? ""),
  });
  if (!place.ok) return place;

  await prisma.$transaction(async (tx) => {
    const income = await tx.income.create({
      data: {
        householdId: member.householdId,
        memberId: template.memberId,
        moneyPlaceId: place.placeId,
        kind: "SALARY",
        amount: netBooks,
        date: payDate,
        description: `${template.name} ${month}`,
      },
    });

    const receipt = await tx.payslipReceipt.create({
      data: {
        templateId: template.id,
        month,
        fxFromCurrency: template.salaryCurrency,
        fxToCurrency: booksCurrency,
        fxRateUsed,
        netPaidSalary: netSalary,
        netPaidBooks: netBooks,
        srspSalary,
        srspBooks,
        companyBooks,
        incomeId: income.id,
        lines: {
          create: confirmedLines.map((line) => ({
            section: line.section,
            code: line.code,
            label: line.label,
            amount: line.amount,
          })),
        },
      },
    });

    if (pensionId && srspBooks > 0) {
      await tx.savingsTxn.create({
        data: {
          accountId: pensionId,
          date: payDate,
          amount: srspBooks,
          kind: "EMPLOYEE_CONTRIB",
          note: `SRSP ${month}`,
          receiptId: receipt.id,
        },
      });
    }
    if (pensionId && companyBooks > 0) {
      await tx.savingsTxn.create({
        data: {
          accountId: pensionId,
          date: payDate,
          amount: companyBooks,
          kind: "COMPANY_CONTRIB",
          note: `Company match ${month}`,
          receiptId: receipt.id,
        },
      });
    }
  });

  revalidateAll();
  return { ok: true };
}

export async function createSavingsAccountAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "CASH");
  const currencyRaw = String(formData.get("currency") ?? member.household.booksCurrency ?? "USD")
    .trim()
    .toUpperCase();
  if (!name) {
    return { ok: false, error: "Name the account." };
  }
  if (!["PENSION", "GOLD", "SILVER", "CASH"].includes(kind)) {
    return { ok: false, error: "Invalid account kind." };
  }
  if (!/^[A-Z]{3}$/.test(currencyRaw)) {
    return { ok: false, error: "Use a 3-letter currency code." };
  }
  await prisma.savingsAccount.create({
    data: {
      householdId: member.householdId,
      name,
      kind,
      currency: currencyRaw,
    },
  });
  revalidateAll();
  return { ok: true };
}

export async function setSavingsTotalAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const accountId = String(formData.get("accountId") ?? "");
  const account = await prisma.savingsAccount.findFirst({
    where: { id: accountId, householdId: member.householdId },
    include: { txns: true },
  });
  if (!account) {
    return { ok: false, error: "Account not found." };
  }
  let target: number;
  try {
    target = toMinorUnits(String(formData.get("total") ?? ""));
  } catch {
    return { ok: false, error: "Invalid total." };
  }
  const current = potBalance(account.txns);
  const delta = target - current;
  if (delta === 0) {
    return { ok: true };
  }
  await prisma.savingsTxn.create({
    data: {
      accountId: account.id,
      date: todayIsoDate(),
      amount: delta,
      kind: "MARKET_ADJUSTMENT",
      note: "Set total",
    },
  });
  revalidateAll();
  return { ok: true };
}

export async function updateMetalAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const accountId = String(formData.get("accountId") ?? "");
  const account = await prisma.savingsAccount.findFirst({
    where: { id: accountId, householdId: member.householdId },
    include: { txns: true },
  });
  if (!account || (account.kind !== "GOLD" && account.kind !== "SILVER")) {
    return { ok: false, error: "Metal account not found." };
  }

  const weightUnitRaw = String(formData.get("weightUnit") ?? "g");
  const weightUnit: MetalWeightUnit = weightUnitRaw === "oz" ? "oz" : "g";
  const weight = Number(String(formData.get("weight") ?? formData.get("grams") ?? "0").replace(/,/g, ""));
  let unitPriceEntered: number;
  try {
    unitPriceEntered = toMinorUnits(
      String(formData.get("unitPrice") ?? formData.get("unitPricePerGram") ?? "0")
    );
  } catch {
    return { ok: false, error: "Invalid unit price." };
  }
  if (!Number.isFinite(weight) || weight < 0) {
    return { ok: false, error: weightUnit === "oz" ? "Invalid troy ounces." : "Invalid grams." };
  }

  const quantityMg = weightUnit === "oz" ? troyOzToMg(weight) : gramsToMg(weight);
  const unitPricePerGram =
    weightUnit === "oz" ? pricePerOzToPerGram(unitPriceEntered) : unitPriceEntered;
  const oldValue = Math.round((Number(account.quantityMg) / 1000) * account.unitPricePerGram);
  const newValue = Math.round((Number(quantityMg) / 1000) * unitPricePerGram);
  const delta = newValue - oldValue;

  await prisma.$transaction(async (tx) => {
    await tx.savingsAccount.update({
      where: { id: account.id },
      data: { quantityMg, unitPricePerGram },
    });
    if (delta !== 0) {
      await tx.savingsTxn.create({
        data: {
          accountId: account.id,
          date: todayIsoDate(),
          amount: delta,
          kind: "MARKET_ADJUSTMENT",
          note: "Metal revaluation",
        },
      });
    }
  });

  revalidateAll();
  return { ok: true };
}

export async function depositToSavingsAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const accountId = String(formData.get("accountId") ?? "");
  const account = await prisma.savingsAccount.findFirst({
    where: { id: accountId, householdId: member.householdId },
  });
  if (!account) {
    return { ok: false, error: "Account not found." };
  }
  let amount: number;
  try {
    amount = toMinorUnits(String(formData.get("amount") ?? ""));
  } catch {
    return { ok: false, error: "Invalid amount." };
  }
  if (amount <= 0) {
    return { ok: false, error: "Amount must be positive." };
  }

  const category = await ensureSavingsCategory(member.householdId);
  const place = await resolveMoneyPlaceId({
    householdId: member.householdId,
    memberId: member.id,
    displayName: member.displayName,
    moneyPlaceId: String(formData.get("moneyPlaceId") ?? ""),
  });
  if (!place.ok) return place;
  const available = await getMoneyPlaceBalance(member.householdId, place.placeId);
  if (amount > available) {
    return { ok: false, error: "Not enough in that place for this deposit." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.savingsTxn.create({
      data: {
        accountId: account.id,
        date: todayIsoDate(),
        amount,
        kind: "DEPOSIT",
        note: "Manual deposit",
      },
    });
    await tx.expense.create({
      data: {
        householdId: member.householdId,
        memberId: member.id,
        moneyPlaceId: place.placeId,
        categoryId: category.id,
        amount,
        date: todayIsoDate(),
        description: `Savings deposit · ${account.name}`,
        funding: "OWN",
        isCardPayoff: false,
      },
    });
  });

  revalidateAll();
  return { ok: true };
}

export async function withdrawFromSavingsAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const accountId = String(formData.get("accountId") ?? "");
  const account = await prisma.savingsAccount.findFirst({
    where: { id: accountId, householdId: member.householdId },
    include: { txns: true },
  });
  if (!account) {
    return { ok: false, error: "Account not found." };
  }
  if (account.kind === "GOLD" || account.kind === "SILVER") {
    return { ok: false, error: "Withdraw cash pots only. Update metal weight instead." };
  }

  let amount: number;
  try {
    amount = toMinorUnits(String(formData.get("amount") ?? ""));
  } catch {
    return { ok: false, error: "Invalid amount." };
  }
  if (amount <= 0) {
    return { ok: false, error: "Amount must be positive." };
  }

  const balance = potBalance(account.txns);
  if (amount > balance) {
    return { ok: false, error: "Not enough in this pot." };
  }

  const place = await resolveMoneyPlaceId({
    householdId: member.householdId,
    memberId: member.id,
    displayName: member.displayName,
    moneyPlaceId: String(formData.get("moneyPlaceId") ?? ""),
  });
  if (!place.ok) return place;

  await prisma.$transaction(async (tx) => {
    await tx.savingsTxn.create({
      data: {
        accountId: account.id,
        date: todayIsoDate(),
        amount: -amount,
        kind: "WITHDRAW",
        note: "Manual withdraw",
      },
    });
    await tx.income.create({
      data: {
        householdId: member.householdId,
        memberId: member.id,
        moneyPlaceId: place.placeId,
        kind: "OTHER",
        amount,
        date: todayIsoDate(),
        description: `Savings withdraw · ${account.name}`,
      },
    });
  });

  revalidateAll();
  return { ok: true };
}
