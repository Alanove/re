import { prisma } from "@/lib/db";

const FAMILY = ["Car", "Fuel", "Groceries", "Home", "Debt repayment"] as const;
const BUSINESS = ["Server", "Domain", "Email", "Other business"] as const;

export const SAVINGS_CATEGORY_NAME = "Savings";

export async function seedHouseholdCategories(householdId: string) {
  for (const name of FAMILY) {
    await prisma.category.upsert({
      where: { householdId_name: { householdId, name } },
      create: {
        householdId,
        name,
        kind: "FAMILY",
        requiresBusiness: false,
      },
      update: {},
    });
  }
  for (const name of BUSINESS) {
    await prisma.category.upsert({
      where: { householdId_name: { householdId, name } },
      create: {
        householdId,
        name,
        kind: "BUSINESS",
        requiresBusiness: true,
      },
      update: {},
    });
  }
  await ensureSavingsCategory(householdId);
}

/** Transfer category for savings deposits/withdrawals; excluded from spending reports. */
export async function ensureSavingsCategory(householdId: string) {
  return prisma.category.upsert({
    where: { householdId_name: { householdId, name: SAVINGS_CATEGORY_NAME } },
    create: {
      householdId,
      name: SAVINGS_CATEGORY_NAME,
      kind: "TRANSFER",
      requiresBusiness: false,
      excludeFromSpending: true,
    },
    update: {
      kind: "TRANSFER",
      excludeFromSpending: true,
    },
  });
}
