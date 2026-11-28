"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { seedHouseholdCategories } from "@/lib/seed-categories";
import { ensureMemberOwnPlace } from "@/lib/money-places";
import { requireOwner, requireUser } from "@/lib/session";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
  householdName: z.string().trim().min(1).max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
});

const inviteSchema = z.object({
  role: z.enum(["ADULT", "CHILD"]),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
});

const acceptInviteSchema = z.object({
  token: z.string().min(10),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function signUpAction(formData: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    householdName: formData.get("householdName") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the name, email, and password." };
  }

  const householdCount = await prisma.household.count();
  if (householdCount > 0) {
    return { ok: false, error: "This household already exists. Ask for an invite link." };
  }

  try {
    await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    });
  } catch {
    return { ok: false, error: "Could not create the account." };
  }

  if (parsed.data.householdName) {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (user) {
      await prisma.household.updateMany({
        where: { members: { some: { userId: user.id } } },
        data: { name: parsed.data.householdName },
      });
    }
  }

  redirect("/");
}

export async function signInAction(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the email and password." };
  }

  try {
    await auth.api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    });
  } catch {
    return { ok: false, error: "Wrong email or password." };
  }

  redirect("/");
}

export async function signOutAction() {
  await auth.api.signOut({
    headers: await headers(),
  });
  redirect("/login");
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
  });

export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((issue) => issue.path[0] === "confirmPassword");
    return {
      ok: false,
      error: mismatch ? "New passwords do not match." : "Use at least 8 characters for the new password.",
    };
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return { ok: false, error: "Pick a new password that is different from the current one." };
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch {
    return { ok: false, error: "Current password is wrong, or the password could not be updated." };
  }

  return { ok: true };
}

export async function createInviteAction(formData: FormData): Promise<ActionResult & { url?: string }> {
  const { member } = await requireOwner();
  const parsed = inviteSchema.safeParse({
    role: formData.get("role"),
    email: formData.get("email") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Pick adult or child." };
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  await prisma.invite.create({
    data: {
      householdId: member.householdId,
      token,
      role: parsed.data.role,
      email: parsed.data.email || null,
      createdById: member.userId,
      expiresAt,
    },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { ok: true, url: `${base}/join?token=${token}` };
}

export async function acceptInviteAction(formData: FormData): Promise<ActionResult> {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the invite form." };
  }

  const invite = await prisma.invite.findUnique({ where: { token: parsed.data.token } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return { ok: false, error: "This invite is invalid or expired." };
  }

  try {
    await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    });
  } catch {
    return { ok: false, error: "Could not create the account." };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return { ok: false, error: "Account was not created." };
  }

  // If the first-signup hook incorrectly created a household (race), remove this user's membership first.
  await prisma.member.deleteMany({ where: { userId: user.id } });

  const joined = await prisma.$transaction(async (tx) => {
    const created = await tx.member.create({
      data: {
        householdId: invite.householdId,
        userId: user.id,
        role: invite.role,
        displayName: parsed.data.name,
      },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
    return created;
  });

  await ensureMemberOwnPlace(joined);

  await prisma.household.deleteMany({
    where: {
      members: { none: {} },
    },
  });

  redirect("/");
}

export async function ensureSeededCategories(householdId: string) {
  await seedHouseholdCategories(householdId);
}
