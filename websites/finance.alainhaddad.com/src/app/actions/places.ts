"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  ensureHouseholdMoneyPlaces,
  ensureMemberOwnPlace,
  getMoneyPlaceBalance,
} from "@/lib/money-places";
import { toMinorUnits } from "@/lib/money";
import { requireAdult, requireMember } from "@/lib/session";
import { todayIsoDate } from "@/lib/utils";

export type ActionResult = { ok: true } | { ok: false; error: string };

const amountSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  try {
    return toMinorUnits(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid amount" });
    return z.NEVER;
  }
});

function revalidatePlaces() {
  revalidatePath("/");
  revalidatePath("/activity");
  revalidatePath("/settings", "layout");
  revalidatePath("/plan", "layout");
}

export async function createMoneyPlaceAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const schema = z.object({
    name: z.string().trim().min(1).max(80),
    kind: z.enum(["BANK", "WALLET", "CASH", "PERSON", "OTHER"]),
    note: z.string().trim().max(200).default(""),
    openingBalance: amountSchema.default(0),
  });
  const parsed = schema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind") || "OTHER",
    note: formData.get("note") ?? "",
    openingBalance: formData.get("openingBalance") || "0",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the place name and opening balance." };
  }

  await prisma.moneyPlace.create({
    data: {
      householdId: member.householdId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      note: parsed.data.note,
      openingBalance: parsed.data.openingBalance,
    },
  });

  revalidatePlaces();
  return { ok: true };
}

export async function updateMoneyPlaceAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const schema = z.object({
    placeId: z.string().min(1),
    name: z.string().trim().min(1).max(80),
    note: z.string().trim().max(200).default(""),
    openingBalance: amountSchema,
  });
  const parsed = schema.safeParse({
    placeId: formData.get("placeId"),
    name: formData.get("name"),
    note: formData.get("note") ?? "",
    openingBalance: formData.get("openingBalance") || "0",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the place fields." };
  }

  const place = await prisma.moneyPlace.findFirst({
    where: { id: parsed.data.placeId, householdId: member.householdId },
  });
  if (!place) return { ok: false, error: "Place not found." };

  await prisma.moneyPlace.update({
    where: { id: place.id },
    data: {
      name: parsed.data.name,
      note: parsed.data.note,
      openingBalance: parsed.data.openingBalance,
    },
  });

  revalidatePlaces();
  return { ok: true };
}

export async function archiveMoneyPlaceAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireAdult();
  const placeId = String(formData.get("placeId") ?? "");
  const place = await prisma.moneyPlace.findFirst({
    where: { id: placeId, householdId: member.householdId },
  });
  if (!place) return { ok: false, error: "Place not found." };
  if (place.memberId) {
    return { ok: false, error: "Personal own accounts can’t be archived." };
  }

  await prisma.moneyPlace.update({
    where: { id: place.id },
    data: { archivedAt: new Date() },
  });
  revalidatePlaces();
  return { ok: true };
}

export async function transferMoneyAction(formData: FormData): Promise<ActionResult> {
  const { member } = await requireMember();
  await ensureMemberOwnPlace(member);

  const schema = z.object({
    fromPlaceId: z.string().min(1),
    toPlaceId: z.string().min(1),
    amount: z.union([z.string(), z.number()]).transform((value, ctx) => {
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
    }),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(todayIsoDate()),
    note: z.string().trim().max(200).default(""),
  });

  const parsed = schema.safeParse({
    fromPlaceId: formData.get("fromPlaceId") || formData.get("moneyPlaceId"),
    toPlaceId: formData.get("toPlaceId"),
    amount: formData.get("amount"),
    date: formData.get("date") || todayIsoDate(),
    note: formData.get("note") ?? formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the transfer fields." };
  }
  if (parsed.data.fromPlaceId === parsed.data.toPlaceId) {
    return { ok: false, error: "Pick two different places." };
  }

  const [from, to] = await Promise.all([
    prisma.moneyPlace.findFirst({
      where: { id: parsed.data.fromPlaceId, householdId: member.householdId, archivedAt: null },
    }),
    prisma.moneyPlace.findFirst({
      where: { id: parsed.data.toPlaceId, householdId: member.householdId, archivedAt: null },
    }),
  ]);
  if (!from || !to) return { ok: false, error: "Place not found." };

  const available = await getMoneyPlaceBalance(member.householdId, from.id);
  if (parsed.data.amount > available) {
    return { ok: false, error: `Not enough in ${from.name}.` };
  }

  await prisma.moneyTransfer.create({
    data: {
      householdId: member.householdId,
      memberId: member.id,
      fromPlaceId: from.id,
      toPlaceId: to.id,
      amount: parsed.data.amount,
      date: parsed.data.date,
      note: parsed.data.note,
    },
  });

  revalidatePlaces();
  return { ok: true };
}

export async function ensurePlacesReadyAction() {
  const { member } = await requireMember();
  await ensureHouseholdMoneyPlaces(member.householdId);
}
