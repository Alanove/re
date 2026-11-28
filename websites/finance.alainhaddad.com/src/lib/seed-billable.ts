import { prisma } from "@/lib/db";

/** Default freelance price list (major units converted to minor). */
export const DEFAULT_BILLABLE = [
  { name: "Domain", defaultPrice: 15_00 },
  { name: "Hosting", defaultPrice: 100_00 },
  { name: "Microsoft Email", defaultPrice: 50_00 },
  { name: "Website", defaultPrice: 300_00 },
] as const;

export async function seedBillableCategories(householdId: string) {
  for (const row of DEFAULT_BILLABLE) {
    await prisma.billableCategory.upsert({
      where: { householdId_name: { householdId, name: row.name } },
      create: {
        householdId,
        name: row.name,
        defaultPrice: row.defaultPrice,
      },
      update: {},
    });
  }
}
