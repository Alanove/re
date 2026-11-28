import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";
import { ensureMemberOwnPlace } from "@/lib/money-places";
import { seedBillableCategories } from "@/lib/seed-billable";
import { seedHouseholdCategories } from "@/lib/seed-categories";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 365,
    updateAge: 60 * 60 * 24 * 7,
  },
  user: {
    additionalFields: {},
  },
  plugins: [nextCookies()],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const householdCount = await prisma.household.count();
          if (householdCount === 0) {
            const household = await prisma.household.create({
              data: {
                name: "Our household",
                currency: "ILS",
                invoiceTaxBps: 0,
                invoiceBrandName: "Liteweb",
                members: {
                  create: {
                    userId: user.id,
                    role: "OWNER",
                    displayName: user.name || user.email.split("@")[0],
                  },
                },
              },
            });
            await seedHouseholdCategories(household.id);
            await seedBillableCategories(household.id);
            const owner = await prisma.member.findFirst({
              where: { householdId: household.id, userId: user.id },
            });
            if (owner) await ensureMemberOwnPlace(owner);
            return;
          }

          // Invited users are linked in the accept-invite action before session use.
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
