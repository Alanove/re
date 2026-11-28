import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptInviteAction } from "@/app/actions/auth";
import { AuthForm, Field } from "@/components/auth-form";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await getSessionUser();
  if (session?.user) {
    const member = await prisma.member.findUnique({ where: { userId: session.user.id } });
    if (member) {
      redirect("/");
    }
  }

  const params = await searchParams;
  const token = params.token ?? "";
  const invite = token
    ? await prisma.invite.findUnique({
        where: { token },
        include: { household: true },
      })
    : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <div className="rounded-3xl border border-line bg-card p-6 shadow-card">
        <h1 className="text-2xl font-semibold">Join the household</h1>
        <p className="mt-1 text-sm text-muted">
          {invite && !invite.usedAt && invite.expiresAt > new Date()
            ? `Invite to ${invite.household.name} as ${invite.role.toLowerCase()}.`
            : "Paste or open an invite link from the owner."}
        </p>
        <AuthForm action={acceptInviteAction} submitLabel="Join">
          <Field id="token" name="token" label="Invite token" defaultValue={token} required />
          <Field id="name" name="name" label="Your name" required />
          <Field
            id="email"
            name="email"
            label="Email"
            type="email"
            defaultValue={invite?.email ?? ""}
            required
          />
          <Field
            id="password"
            name="password"
            label="Password"
            type="password"
            minLength={8}
            required
          />
        </AuthForm>
        <p className="mt-4 text-sm text-muted">
          <Link href="/login" className="font-medium text-ink underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
