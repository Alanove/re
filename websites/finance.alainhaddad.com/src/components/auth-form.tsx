"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  submitLabel: string;
  children?: React.ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-6 space-y-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await action(formData);
          if (!result.ok) {
            setError(result.error ?? "Something went wrong.");
          }
        });
      }}
    >
      {children}
      {error && <p className="text-sm text-short-text">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : submitLabel}
      </Button>
    </form>
  );
}

export function Field({
  id,
  name,
  label,
  type = "text",
  required,
  defaultValue,
  minLength,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  minLength?: number;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        minLength={minLength}
      />
    </div>
  );
}
