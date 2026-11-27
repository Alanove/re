"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteForm({
  action,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string; url?: string }>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-2 rounded-2xl border border-dashed border-line p-4"
      action={(formData) => {
        setError(null);
        setUrl(null);
        startTransition(async () => {
          const result = await action(formData);
          if (!result.ok) {
            setError(result.error ?? "Could not create invite.");
            return;
          }
          setUrl(result.url ?? null);
        });
      }}
    >
      <Label>Create invite link</Label>
      <select name="role" className="h-11 rounded-xl border border-line bg-white px-3" defaultValue="ADULT">
        <option value="ADULT">Adult</option>
        <option value="CHILD">Child</option>
      </select>
      <Input name="email" type="email" placeholder="Optional email note" />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Copyable invite link"}
      </Button>
      {error && <p className="text-sm text-short">{error}</p>}
      {url && (
        <div className="rounded-xl bg-white p-3 text-sm break-all border border-line">
          <p className="font-medium">Invite URL</p>
          <p className="mt-1 text-muted">{url}</p>
        </div>
      )}
    </form>
  );
}
