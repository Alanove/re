import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/roles";
import { isAdultRole } from "@/lib/roles";

export type AppMember = {
  id: string;
  role: Role;
  displayName: string;
  householdId: string;
  userId: string;
  household: {
    id: string;
    name: string;
    currency: string;
    booksCurrency: string;
    displayCurrency: string;
    entryCurrency: string;
    invoiceTaxBps: number;
    invoiceBrandName: string;
  };
};

export async function getSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function requireUser() {
  const session = await getSessionUser();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireMember(): Promise<{
  session: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
  member: AppMember;
}> {
  const session = await requireUser();
  const member = await prisma.member.findUnique({
    where: { userId: session.user.id },
    include: {
      household: {
        select: {
          id: true,
          name: true,
          currency: true,
          booksCurrency: true,
          displayCurrency: true,
          entryCurrency: true,
          invoiceTaxBps: true,
          invoiceBrandName: true,
        },
      },
    },
  });

  if (!member) {
    redirect("/join");
  }

  return {
    session,
    member: {
      id: member.id,
      role: member.role as Role,
      displayName: member.displayName,
      householdId: member.householdId,
      userId: member.userId,
      household: {
        ...member.household,
        booksCurrency: member.household.booksCurrency || member.household.currency || "USD",
        displayCurrency: member.household.displayCurrency || member.household.currency || "USD",
        entryCurrency: member.household.entryCurrency || member.household.currency || "USD",
        invoiceBrandName: member.household.invoiceBrandName || "Liteweb",
      },
    },
  };
}

export async function requireAdult() {
  const ctx = await requireMember();
  if (!isAdultRole(ctx.member.role)) {
    redirect("/");
  }
  return ctx;
}

export async function requireOwner() {
  const ctx = await requireMember();
  if (ctx.member.role !== "OWNER") {
    redirect("/");
  }
  return ctx;
}
