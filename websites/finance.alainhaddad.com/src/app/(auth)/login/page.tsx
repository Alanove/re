import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAction } from "@/app/actions/auth";
import { AuthForm, Field } from "@/components/auth-form";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export default async function LoginPage() {
  const session = await getSessionUser();
  if (session?.user) {
    redirect("/");
  }

  const householdCount = await prisma.household.count();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <div className="rounded-3xl border border-line bg-card p-6 shadow-card">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Household finance and freelance work.</p>
        <AuthForm action={signInAction} submitLabel="Sign in">
          <Field id="email" name="email" label="Email" type="email" required />
          <Field id="password" name="password" label="Password" type="password" required />
        </AuthForm>
        <p className="mt-4 text-sm text-muted">
          {householdCount === 0 ? (
            <>
              First here?{" "}
              <Link href="/signup" className="font-medium text-ink underline">
                Create the household
              </Link>
            </>
          ) : (
            <>
              Have an invite?{" "}
              <Link href="/join" className="font-medium text-ink underline">
                Join with a link
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
