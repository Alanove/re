import { prisma } from "@/lib/db";

export const MONEY_PLACE_KINDS = [
  "OWN",
  "BANK",
  "WALLET",
  "CASH",
  "PERSON",
  "OTHER",
] as const;

export type MoneyPlaceKind = (typeof MONEY_PLACE_KINDS)[number];

export type MoneyPlaceBalance = {
  id: string;
  name: string;
  kind: string;
  note: string;
  memberId: string | null;
  openingBalance: number;
  archivedAt: Date | null;
  balance: number;
};

/** Ensure a personal OWN place exists for this member; return it. */
export async function ensureMemberOwnPlace(member: {
  id: string;
  householdId: string;
  displayName: string;
}) {
  const existing = await prisma.moneyPlace.findUnique({
    where: { memberId: member.id },
  });
  if (existing) return existing;

  return prisma.moneyPlace.create({
    data: {
      householdId: member.householdId,
      memberId: member.id,
      name: member.displayName.trim() || "Own account",
      kind: "OWN",
      openingBalance: 0,
    },
  });
}

/** Create OWN places for every member and attach unplaced income/OWN expenses. */
export async function ensureHouseholdMoneyPlaces(householdId: string) {
  const members = await prisma.member.findMany({
    where: { householdId },
    orderBy: { createdAt: "asc" },
  });
  if (members.length === 0) return [];

  const places = [];
  for (const member of members) {
    places.push(await ensureMemberOwnPlace(member));
  }

  const placeByMember = new Map(places.map((place) => [place.memberId!, place.id]));
  const ownerPlaceId = places[0]!.id;

  const orphanIncomes = await prisma.income.findMany({
    where: { householdId, moneyPlaceId: null },
    select: { id: true, memberId: true },
  });
  for (const row of orphanIncomes) {
    await prisma.income.update({
      where: { id: row.id },
      data: { moneyPlaceId: placeByMember.get(row.memberId) ?? ownerPlaceId },
    });
  }

  const orphanExpenses = await prisma.expense.findMany({
    where: { householdId, moneyPlaceId: null, funding: "OWN" },
    select: { id: true, memberId: true },
  });
  for (const row of orphanExpenses) {
    await prisma.expense.update({
      where: { id: row.id },
      data: { moneyPlaceId: placeByMember.get(row.memberId) ?? ownerPlaceId },
    });
  }

  return places;
}

export function computePlaceBalance(input: {
  openingBalance: number;
  incomeTotal: number;
  expenseTotal: number;
  transferInTotal: number;
  transferOutTotal: number;
}): number {
  return (
    input.openingBalance +
    input.incomeTotal -
    input.expenseTotal +
    input.transferInTotal -
    input.transferOutTotal
  );
}

export async function listMoneyPlaceBalances(
  householdId: string,
  opts?: { includeArchived?: boolean }
): Promise<MoneyPlaceBalance[]> {
  await ensureHouseholdMoneyPlaces(householdId);

  const places = await prisma.moneyPlace.findMany({
    where: {
      householdId,
      ...(opts?.includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  const placeIds = places.map((place) => place.id);
  if (placeIds.length === 0) return [];

  const [incomes, expenses, transfersFrom, transfersTo] = await Promise.all([
    prisma.income.groupBy({
      by: ["moneyPlaceId"],
      where: { householdId, moneyPlaceId: { in: placeIds } },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["moneyPlaceId"],
      where: { householdId, moneyPlaceId: { in: placeIds }, funding: "OWN" },
      _sum: { amount: true },
    }),
    prisma.moneyTransfer.groupBy({
      by: ["fromPlaceId"],
      where: { householdId, fromPlaceId: { in: placeIds } },
      _sum: { amount: true },
    }),
    prisma.moneyTransfer.groupBy({
      by: ["toPlaceId"],
      where: { householdId, toPlaceId: { in: placeIds } },
      _sum: { amount: true },
    }),
  ]);

  const incomeMap = new Map(
    incomes.map((row) => [row.moneyPlaceId!, row._sum.amount ?? 0])
  );
  const expenseMap = new Map(
    expenses.map((row) => [row.moneyPlaceId!, row._sum.amount ?? 0])
  );
  const outMap = new Map(
    transfersFrom.map((row) => [row.fromPlaceId, row._sum.amount ?? 0])
  );
  const inMap = new Map(
    transfersTo.map((row) => [row.toPlaceId, row._sum.amount ?? 0])
  );

  const rows = places.map((place) => ({
    id: place.id,
    name: place.name,
    kind: place.kind,
    note: place.note,
    memberId: place.memberId,
    openingBalance: place.openingBalance,
    archivedAt: place.archivedAt,
    balance: computePlaceBalance({
      openingBalance: place.openingBalance,
      incomeTotal: incomeMap.get(place.id) ?? 0,
      expenseTotal: expenseMap.get(place.id) ?? 0,
      transferInTotal: inMap.get(place.id) ?? 0,
      transferOutTotal: outMap.get(place.id) ?? 0,
    }),
  }));

  return rows.sort((a, b) => {
    if (a.kind === "OWN" && b.kind !== "OWN") return -1;
    if (b.kind === "OWN" && a.kind !== "OWN") return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function getMoneyPlaceBalance(
  householdId: string,
  placeId: string
): Promise<number> {
  const rows = await listMoneyPlaceBalances(householdId, { includeArchived: true });
  return rows.find((row) => row.id === placeId)?.balance ?? 0;
}

/** Resolve place for a form: explicit id, else member’s own account. */
export async function resolveMoneyPlaceId(input: {
  householdId: string;
  memberId: string;
  displayName: string;
  moneyPlaceId?: string | null;
}): Promise<{ ok: true; placeId: string } | { ok: false; error: string }> {
  await ensureMemberOwnPlace({
    id: input.memberId,
    householdId: input.householdId,
    displayName: input.displayName,
  });

  const requested = input.moneyPlaceId?.trim();
  if (!requested) {
    const own = await prisma.moneyPlace.findUnique({ where: { memberId: input.memberId } });
    if (!own) return { ok: false, error: "Own account not found." };
    return { ok: true, placeId: own.id };
  }

  const place = await prisma.moneyPlace.findFirst({
    where: { id: requested, householdId: input.householdId, archivedAt: null },
  });
  if (!place) return { ok: false, error: "Money place not found." };
  return { ok: true, placeId: place.id };
}
