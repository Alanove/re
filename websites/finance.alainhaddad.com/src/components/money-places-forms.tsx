"use client";

import { useState, useTransition } from "react";
import {
  archiveMoneyPlaceAction,
  createMoneyPlaceAction,
  updateMoneyPlaceAction,
} from "@/app/actions/places";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, fromMinorUnits } from "@/lib/money";

type PlaceRow = {
  id: string;
  name: string;
  kind: string;
  note: string;
  memberId: string | null;
  openingBalance: number;
  balance: number;
};

export function MoneyPlacesManager({
  places,
  currency,
}: {
  places: PlaceRow[];
  currency: string;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Balances</h2>
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          {places.map((place) => (
            <PlaceEditor key={place.id} place={place} currency={currency} />
          ))}
        </div>
      </section>
      <CreatePlaceForm />
    </div>
  );
}

function PlaceEditor({ place, currency }: { place: PlaceRow; currency: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isOwn = Boolean(place.memberId);

  return (
    <form
      className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await updateMoneyPlaceAction(formData);
          if (!result.ok) setError(result.error);
        });
      }}
    >
      <input type="hidden" name="placeId" value={place.id} />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{place.kind}</p>
          <p className="text-lg font-semibold">{formatMoney(place.balance, currency)}</p>
        </div>
        {isOwn && <span className="text-xs text-muted">Own account</span>}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`name-${place.id}`}>Name</Label>
        <Input id={`name-${place.id}`} name="name" defaultValue={place.name} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`open-${place.id}`}>Opening balance</Label>
        <Input
          id={`open-${place.id}`}
          name="openingBalance"
          defaultValue={String(fromMinorUnits(place.openingBalance))}
          inputMode="decimal"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`note-${place.id}`}>Note</Label>
        <Input id={`note-${place.id}`} name="note" defaultValue={place.note} />
      </div>
      {error && <p className="text-sm text-short-text">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {!isOwn && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              const formData = new FormData();
              formData.set("placeId", place.id);
              startTransition(async () => {
                const result = await archiveMoneyPlaceAction(formData);
                if (!result.ok) setError(result.error);
              });
            }}
          >
            Archive
          </Button>
        )}
      </div>
    </form>
  );
}

function CreatePlaceForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid max-w-lg gap-3 rounded-2xl border border-dashed border-line p-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createMoneyPlaceAction(formData);
          if (!result.ok) setError(result.error);
        });
      }}
    >
      <h2 className="font-medium">Add place</h2>
      <div className="space-y-1">
        <Label htmlFor="new-place-name">Name</Label>
        <Input id="new-place-name" name="name" placeholder="Bank, Wish, with Mom…" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-place-kind">Type</Label>
        <select
          id="new-place-kind"
          name="kind"
          className="h-11 w-full rounded-xl border border-line bg-card px-3"
          defaultValue="BANK"
        >
          <option value="BANK">Bank</option>
          <option value="WALLET">Wallet</option>
          <option value="CASH">Cash</option>
          <option value="PERSON">With a person</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-place-open">Opening balance</Label>
        <Input id="new-place-open" name="openingBalance" defaultValue="0" inputMode="decimal" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-place-note">Note</Label>
        <Input id="new-place-note" name="note" />
      </div>
      {error && <p className="text-sm text-short-text">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add place"}
      </Button>
    </form>
  );
}
