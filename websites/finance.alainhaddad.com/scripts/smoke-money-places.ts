import { PrismaClient } from "@prisma/client";
import {
  ensureHouseholdMoneyPlaces,
  getMoneyPlaceBalance,
  listMoneyPlaceBalances,
  resolveMoneyPlaceId,
} from "../src/lib/money-places";
import { getHouseholdCash } from "../src/lib/money-service";

const prisma = new PrismaClient();

async function main() {
  const member = await prisma.member.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!member) throw new Error("No member");

  await ensureHouseholdMoneyPlaces(member.householdId);
  const placesBefore = await listMoneyPlaceBalances(member.householdId);
  const own = placesBefore.find((place) => place.memberId === member.id);
  if (!own) throw new Error("Own place missing");
  console.log("own place", own.name, own.balance);

  let bank = placesBefore.find((place) => place.kind === "BANK" && !place.memberId);
  let createdBankId: string | null = null;
  if (!bank) {
    const created = await prisma.moneyPlace.create({
      data: {
        householdId: member.householdId,
        name: "Bank (smoke)",
        kind: "BANK",
        openingBalance: 0,
      },
    });
    createdBankId = created.id;
    bank = (await listMoneyPlaceBalances(member.householdId)).find(
      (place) => place.id === created.id
    )!;
  }
  console.log("bank place", bank.name, bank.balance);

  const resolvedOwn = await resolveMoneyPlaceId({
    householdId: member.householdId,
    memberId: member.id,
    displayName: member.displayName,
    moneyPlaceId: "",
  });
  if (!resolvedOwn.ok || resolvedOwn.placeId !== own.id) {
    throw new Error("Default resolve failed");
  }

  const today = new Date().toISOString().slice(0, 10);
  await prisma.income.create({
    data: {
      householdId: member.householdId,
      memberId: member.id,
      moneyPlaceId: own.id,
      kind: "OTHER",
      amount: 50_000,
      date: today,
      description: "smoke income own",
    },
  });
  const afterIncome = await getMoneyPlaceBalance(member.householdId, own.id);
  if (afterIncome !== own.balance + 50_000) {
    throw new Error(`Income balance mismatch ${afterIncome}`);
  }

  const cat =
    (await prisma.category.findFirst({ where: { householdId: member.householdId } })) ??
    (await prisma.category.create({
      data: {
        householdId: member.householdId,
        name: "Smoke",
        kind: "FAMILY",
        requiresBusiness: false,
      },
    }));

  await prisma.expense.create({
    data: {
      householdId: member.householdId,
      memberId: member.id,
      categoryId: cat.id,
      moneyPlaceId: own.id,
      funding: "OWN",
      amount: 10_000,
      date: today,
      description: "smoke spend own",
    },
  });
  const afterSpendOwn = await getMoneyPlaceBalance(member.householdId, own.id);
  if (afterSpendOwn !== afterIncome - 10_000) {
    throw new Error("Own spend mismatch");
  }

  await prisma.moneyTransfer.create({
    data: {
      householdId: member.householdId,
      memberId: member.id,
      fromPlaceId: own.id,
      toPlaceId: bank.id,
      amount: 20_000,
      date: today,
      note: "smoke transfer",
    },
  });
  const afterTransferOwn = await getMoneyPlaceBalance(member.householdId, own.id);
  const afterTransferBank = await getMoneyPlaceBalance(member.householdId, bank.id);
  if (afterTransferOwn !== afterSpendOwn - 20_000) {
    throw new Error("Transfer out mismatch");
  }
  if (afterTransferBank !== bank.balance + 20_000) {
    throw new Error("Transfer in mismatch");
  }

  await prisma.expense.create({
    data: {
      householdId: member.householdId,
      memberId: member.id,
      categoryId: cat.id,
      moneyPlaceId: bank.id,
      funding: "OWN",
      amount: 5_000,
      date: today,
      description: "smoke spend bank",
    },
  });
  const afterBankSpend = await getMoneyPlaceBalance(member.householdId, bank.id);
  if (afterBankSpend !== afterTransferBank - 5_000) {
    throw new Error("Bank spend mismatch");
  }

  // Payback-style OWN expense (same path as repay)
  await prisma.expense.create({
    data: {
      householdId: member.householdId,
      memberId: member.id,
      categoryId: cat.id,
      moneyPlaceId: own.id,
      funding: "OWN",
      amount: 1_000,
      date: today,
      description: "smoke payback own",
    },
  });
  const afterPayback = await getMoneyPlaceBalance(member.householdId, own.id);
  if (afterPayback !== afterTransferOwn - 1_000) {
    throw new Error("Payback mismatch");
  }

  const cash = await getHouseholdCash(member.householdId);
  const sumPlaces = (await listMoneyPlaceBalances(member.householdId)).reduce(
    (sum, place) => sum + place.balance,
    0
  );
  if (cash !== sumPlaces) {
    throw new Error(`Cash != sum places ${cash} vs ${sumPlaces}`);
  }

  await prisma.expense.deleteMany({ where: { description: { startsWith: "smoke " } } });
  await prisma.income.deleteMany({ where: { description: { startsWith: "smoke " } } });
  await prisma.moneyTransfer.deleteMany({ where: { note: "smoke transfer" } });
  if (createdBankId) {
    await prisma.moneyPlace.delete({ where: { id: createdBankId } });
  }

  console.log("SMOKE OK", { ownDefault: own.id, cashEqualsPlaces: cash === sumPlaces });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
