"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import {
  EditActivityDialog,
  type EditableActivity,
} from "@/components/edit-activity-dialog";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type ActivityListRow = EditableActivity & {
  label: string;
  meta: string;
  positive: boolean;
};

export function ActivityList({
  rows,
  currency,
  categories,
  businesses,
  customers,
}: {
  rows: ActivityListRow[];
  currency: string;
  categories: { id: string; name: string; requiresBusiness: boolean }[];
  businesses: { id: string; name: string }[];
  customers: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState<EditableActivity | null>(null);
  const [open, setOpen] = useState(false);

  function openRow(row: ActivityListRow) {
    if (row.type === "income") {
      setSelected({
        type: "income",
        id: row.id,
        amount: row.amount,
        date: row.date,
        description: row.description,
        kind: row.kind,
        customerId: row.customerId,
        customerName: row.customerName,
        locked: row.locked,
        lockReason: row.lockReason,
        canDelete: row.canDelete,
        paymentId: row.paymentId,
      });
    } else {
      setSelected({
        type: "expense",
        id: row.id,
        amount: row.amount,
        date: row.date,
        description: row.description,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        businessId: row.businessId,
        funding: row.funding,
        amountEditable: row.amountEditable,
        hasReceipt: row.hasReceipt,
        locked: row.locked,
        lockReason: row.lockReason,
        canDelete: row.canDelete,
      });
    }
    setOpen(true);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-card/60 p-6 text-center">
        <p className="font-medium">Nothing here yet</p>
        <p className="mt-1 text-sm text-muted">Use Add to record the first amount.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-2 xl:grid-cols-2">
        {rows.map((row) => (
          <button
            key={`${row.type}-${row.id}`}
            type="button"
            onClick={() => openRow(row)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 text-left shadow-card transition hover:border-ink/40"
          >
            <div>
              <p className="font-medium">
                {row.label}
                {row.type === "expense" && row.hasReceipt ? (
                  <Camera className="ml-1.5 inline h-3.5 w-3.5 text-muted" aria-label="Has receipt" />
                ) : null}
              </p>
              <p className="text-sm text-muted">
                {row.date}
                {row.meta ? ` · ${row.meta}` : ""}
                <span className="text-muted/80"> · Edit</span>
              </p>
            </div>
            <p
              className={cn(
                "tabular text-base font-semibold",
                row.positive ? "text-ok-text" : "text-ink"
              )}
            >
              {row.positive ? "+" : "−"}
              {formatMoney(row.amount, currency)}
            </p>
          </button>
        ))}
      </div>
      <EditActivityDialog
        row={selected}
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        businesses={businesses}
        customers={customers}
        currency={currency}
      />
    </>
  );
}
