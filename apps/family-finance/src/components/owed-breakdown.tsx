"use client";

import { formatMoney } from "@/lib/money";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type OwedItem = {
  key: string;
  label: string;
  detail?: string;
  amount: number;
};

export function OwedBreakdown({
  owed,
  currency,
  items,
}: {
  owed: number;
  currency: string;
  items: OwedItem[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-left text-sm text-muted underline-offset-2 hover:underline"
        >
          Still owe {formatMoney(owed, currency)}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Where this came from</DialogTitle>
          <DialogDescription>
            Open borrows and card balances that make up Still owe.
          </DialogDescription>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="text-sm text-muted">Nothing outstanding.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.key}
                className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-white p-3"
              >
                <div>
                  <p className="font-medium">{item.label}</p>
                  {item.detail ? (
                    <p className="text-sm text-muted">{item.detail}</p>
                  ) : null}
                </div>
                <p className="tabular text-sm font-semibold">
                  {formatMoney(item.amount, currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="tabular text-sm font-medium text-muted">
          Total {formatMoney(owed, currency)}
        </p>
      </DialogContent>
    </Dialog>
  );
}
