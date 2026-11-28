import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/db";
import { invoiceRemainder } from "@/lib/invoice";
import { listMoneyPlaceBalances } from "@/lib/money-places";
import { getHouseholdCash, openDebts } from "@/lib/money-service";
import { seedHouseholdCategories } from "@/lib/seed-categories";
import { requireMember } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { member } = await requireMember();
  await seedHouseholdCategories(member.householdId);

  const [
    categories,
    businesses,
    cards,
    members,
    debts,
    cashAvailable,
    customers,
    openInvoiceRows,
    moneyPlaces,
    debtNames,
  ] = await Promise.all([
      prisma.category.findMany({
        where: { householdId: member.householdId, excludeFromSpending: false },
        orderBy: { name: "asc" },
      }),
      prisma.business.findMany({
        where: { householdId: member.householdId },
        orderBy: { name: "asc" },
      }),
      prisma.creditCard.findMany({
        where: { householdId: member.householdId, archivedAt: null },
        orderBy: { name: "asc" },
      }),
      prisma.member.findMany({
        where: { householdId: member.householdId },
        orderBy: { displayName: "asc" },
      }),
      openDebts(member.householdId),
      getHouseholdCash(member.householdId),
      prisma.customer.findMany({
        where: { householdId: member.householdId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true },
      }),
      prisma.invoice.findMany({
        where: {
          householdId: member.householdId,
          status: { in: ["UNPAID", "PARTIAL"] },
        },
        include: {
          lines: true,
          payments: true,
        },
        orderBy: { issueDate: "desc" },
      }),
      listMoneyPlaceBalances(member.householdId),
      prisma.debt.findMany({
        where: { householdId: member.householdId },
        select: { person: true },
        orderBy: { person: "asc" },
      }),
    ]);

  const defaultPlaceId =
    moneyPlaces.find((place) => place.memberId === member.id)?.id ?? moneyPlaces[0]?.id;

  const adults = members.filter((row) => row.role === "OWNER" || row.role === "ADULT");
  const openInvoices = openInvoiceRows
    .map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      customerId: invoice.customerId,
      remainder: invoiceRemainder(invoice.lines, invoice.taxBps, invoice.payments),
    }))
    .filter((invoice) => invoice.remainder > 0);

  return (
    <AppShell
      role={member.role}
      addContext={{
        categories: categories.map((row) => ({
          id: row.id,
          name: row.name,
          requiresBusiness: row.requiresBusiness,
        })),
        businesses: businesses.map((row) => ({ id: row.id, name: row.name })),
        cards: cards.map((row) => ({ id: row.id, name: row.name })),
        members: members.map((row) => ({ id: row.id, displayName: row.displayName })),
        debts: debts.map((row) => ({
          id: row.id,
          person: row.person,
          remaining: row.left,
        })),
        people: [...new Set(debtNames.map((row) => row.person.trim()).filter(Boolean))],
        onlyAdult: adults.length <= 1,
        currency: member.household.booksCurrency || member.household.currency,
        cashAvailable,
        customers,
        openInvoices,
        moneyPlaces: moneyPlaces.map((place) => ({
          id: place.id,
          name: place.name,
          balance: place.balance,
          memberId: place.memberId,
        })),
        defaultPlaceId,
      }}
    >
      {children}
    </AppShell>
  );
}
