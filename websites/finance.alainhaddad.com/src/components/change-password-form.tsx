"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm({
  action,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="grid max-w-lg gap-3 rounded-2xl border border-line bg-card p-4 shadow-card"
      action={(formData) => {
        setError(null);
        setSuccess(false);
        startTransition(async () => {
          const result = await action(formData);
          if (!result.ok) {
            setError(result.error ?? "Could not change the password.");
            return;
          }
          setSuccess(true);
          formRef.current?.reset();
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {error && <p className="text-sm text-short-text">{error}</p>}
      {success && (
        <p className="text-sm text-ink">Password updated. Other signed-in devices were signed out.</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}
