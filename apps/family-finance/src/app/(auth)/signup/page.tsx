import Link from "next/link";
import { redirect } from "next/navigation";
import { signUpAction } from "@/app/actions/auth";
import { AuthForm, Field } from "@/components/auth-form";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export default async function SignupPage() {
  const session = await getSessionUser();
  if (session?.user) {
    redirect("/");
  }

  const householdCount = await prisma.household.count();
  if (householdCount > 0) {
    redirect("/join");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <div className="rounded-3xl border border-line bg-white p-6 shadow-card">
        <h1 className="text-2xl font-semibold">Create the household</h1>
        <p className="mt-1 text-sm text-muted">
          First signup becomes the owner. Currency defaults to ILS.
        </p>
        <AuthForm action={signUpAction} submitLabel="Create household">
          <Field
            id="householdName"
            name="householdName"
            label="Household name"
            defaultValue="Our household"
          />
          <Field id="name" name="name" label="Your name" required />
          <Field id="email" name="email" label="Email" type="email" required />
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
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-ink underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
