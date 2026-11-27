import { createInviteAction, signOutAction } from "@/app/actions/auth";
import { InstallAppSettings } from "@/components/install-app-settings";
import { InviteForm } from "@/components/invite-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/session";

export default async function SettingsHouseholdPage() {
  const { member } = await requireMember();

  const members = await prisma.member.findMany({
    where: { householdId: member.householdId },
    include: { user: true },
    orderBy: { displayName: "asc" },
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Household</h1>
        <p className="text-sm text-muted">
          {member.household.name} · {member.household.currency} · tax{" "}
          {(member.household.invoiceTaxBps / 100).toFixed(2)}%
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">App</h2>
        <InstallAppSettings />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Members</h2>
        {members.map((row) => (
          <div key={row.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <p className="font-medium">{row.displayName}</p>
            <p className="text-sm text-muted">
              {row.role.toLowerCase()} · {row.user.email}
            </p>
          </div>
        ))}
      </section>

      {member.role === "OWNER" && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Invites</h2>
          <InviteForm action={createInviteAction} />
        </section>
      )}

      <form action={signOutAction}>
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </div>
  );
}
