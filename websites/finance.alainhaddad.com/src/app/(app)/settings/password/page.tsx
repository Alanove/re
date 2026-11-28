import { changePasswordAction } from "@/app/actions/auth";
import { ChangePasswordForm } from "@/components/change-password-form";
import { requireMember } from "@/lib/session";

export default async function SettingsPasswordPage() {
  const { session } = await requireMember();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Password</h1>
        <p className="text-sm text-muted">
          Change the password for {session.user.email}. Other devices will be signed out.
        </p>
      </header>

      <ChangePasswordForm action={changePasswordAction} />
    </div>
  );
}
