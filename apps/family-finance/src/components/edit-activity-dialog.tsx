"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  deleteExpenseAction,
  deleteIncomeAction,
  updateExpenseAction,
  updateIncomeAction,
} from "@/app/actions/money";
import { CategoryCombobox } from "@/components/category-combobox";
import { CustomerCombobox } from "@/components/customer-combobox";
import { ReceiptCapture } from "@/components/receipt-capture";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fromMinorUnits } from "@/lib/money";

export type EditableActivity =
  | {
      type: "income";
      id: string;
      amount: number;
      date: string;
      description: string;
      kind: "SALARY" | "FREELANCE" | "OTHER";
      customerId: string | null;
      customerName: string;
      locked: boolean;
      lockReason: string | null;
      canDelete: boolean;
      paymentId?: string | null;
    }
  | {
      type: "expense";
      id: string;
      amount: number;
      date: string;
      description: string;
      categoryId: string;
      categoryName: string;
      businessId: string | null;
      funding: string;
      amountEditable: boolean;
      hasReceipt: boolean;
      locked: boolean;
      lockReason: string | null;
      canDelete: boolean;
    };

type IncomeKind = "SALARY" | "FREELANCE" | "OTHER";

export function EditActivityDialog({
  row,
  open,
  onOpenChange,
  categories,
  businesses,
  customers,
  currency,
}: {
  row: EditableActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string; requiresBusiness: boolean }[];
  businesses: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  currency: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [incomeKind, setIncomeKind] = useState<IncomeKind>("SALARY");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [formKey, setFormKey] = useState(0);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId),
    [categories, categoryId]
  );

  useEffect(() => {
    if (!open || !row) return;
    setError(null);
    setConfirmDelete(false);
    setFormKey((value) => value + 1);
    if (row.type === "income") {
      setIncomeKind(row.kind);
      setCustomerId(row.customerId ?? "");
      setCustomerName(row.customerName);
      setCategoryId("");
    } else {
      setCategoryId(row.categoryId);
      setIncomeKind("SALARY");
      setCustomerId("");
      setCustomerName("");
    }
  }, [open, row]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setError(null);
      setConfirmDelete(false);
    }
    onOpenChange(next);
  }

  function onSubmit(formData: FormData) {
    if (!row || row.locked) return;
    setError(null);
    startTransition(async () => {
      const result =
        row.type === "income"
          ? await updateIncomeAction(formData)
          : await updateExpenseAction(formData);
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      onOpenChange(false);
    });
  }

  function onDelete() {
    if (!row || !row.canDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setError(null);
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("id", row.id);
    startTransition(async () => {
      const result =
        row.type === "income"
          ? await deleteIncomeAction(formData)
          : await deleteExpenseAction(formData);
      if (!result.ok) {
        setError(result.error ?? "Could not delete.");
        setConfirmDelete(false);
        return;
      }
      onOpenChange(false);
    });
  }

  if (!row) return null;

  const recentCustomers = customers.slice(0, 6);
  const amountMajor = String(fromMinorUnits(row.amount));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row.type === "income" ? "Edit income" : "Edit expense"}</DialogTitle>
          <DialogDescription>
            {row.locked
              ? row.lockReason ?? "This entry can’t be edited."
              : "Change the fields and save, or delete this entry."}
          </DialogDescription>
        </DialogHeader>

        {row.locked ? (
          <div className="space-y-3">
            <p className="rounded-2xl border border-line bg-white p-3 text-sm text-muted">
              {row.lockReason}
            </p>
            {row.type === "income" && row.paymentId ? (
              <Button asChild className="w-full">
                <a
                  href={`/work/payments/${row.paymentId}/receipt`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Print receipt
                </a>
              </Button>
            ) : null}
            {error && <p className="text-sm text-short">{error}</p>}
            <div className="flex flex-col gap-2">
              {row.canDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  className="w-full"
                  disabled={pending}
                  onClick={onDelete}
                >
                  {pending
                    ? "Deleting…"
                    : confirmDelete
                      ? "Tap again to confirm delete"
                      : "Delete"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form key={formKey} action={onSubmit} className="space-y-3">
            <input type="hidden" name="id" value={row.id} />
            <div className="space-y-1">
              <Label htmlFor="edit-amount">Amount ({currency})</Label>
              <Input
                id="edit-amount"
                name="amount"
                inputMode="decimal"
                required
                defaultValue={amountMajor}
                readOnly={row.type === "expense" && !row.amountEditable}
                className={
                  row.type === "expense" && !row.amountEditable ? "bg-surface text-muted" : undefined
                }
              />
              {row.type === "expense" && !row.amountEditable && (
                <p className="text-xs text-muted">
                  Amount is fixed for {row.funding.toLowerCase()} expenses.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                name="description"
                defaultValue={row.description}
                placeholder="One line"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-date">Date</Label>
              <Input id="edit-date" name="date" type="date" defaultValue={row.date} required />
            </div>

            {row.type === "income" && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="edit-kind">Kind</Label>
                  <select
                    id="edit-kind"
                    name="kind"
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                    value={incomeKind}
                    onChange={(event) => setIncomeKind(event.target.value as IncomeKind)}
                  >
                    <option value="SALARY">Salary</option>
                    <option value="FREELANCE">Freelance</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                {incomeKind === "FREELANCE" && (
                  <div className="space-y-2">
                    {recentCustomers.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {recentCustomers.map((customer) => (
                          <Button
                            key={customer.id}
                            type="button"
                            size="sm"
                            variant={customerId === customer.id ? "default" : "secondary"}
                            onClick={() => {
                              setCustomerId(customer.id);
                              setCustomerName(customer.name);
                            }}
                          >
                            {customer.name}
                          </Button>
                        ))}
                      </div>
                    )}
                    <CustomerCombobox
                      customers={customers}
                      valueId={customerId}
                      valueName={customerName}
                      onChange={(next) => {
                        setCustomerId(next.id);
                        setCustomerName(next.name);
                      }}
                    />
                  </div>
                )}
              </>
            )}

            {row.type === "expense" && (
              <>
                <CategoryCombobox
                  categories={categories}
                  valueId={categoryId}
                  onChange={(next) => setCategoryId(next.id)}
                />
                <ReceiptCapture
                  existingUrl={row.hasReceipt ? `/api/receipts/${row.id}` : null}
                />
                {(selectedCategory?.requiresBusiness || businesses.length > 0) && (
                  <div className="space-y-1">
                    <Label htmlFor="edit-businessId">Business</Label>
                    <select
                      id="edit-businessId"
                      name="businessId"
                      className="h-11 w-full rounded-xl border border-line bg-white px-3"
                      required={Boolean(selectedCategory?.requiresBusiness)}
                      defaultValue={row.businessId ?? ""}
                    >
                      {!selectedCategory?.requiresBusiness && <option value="">None</option>}
                      {businesses.map((business) => (
                        <option key={business.id} value={business.id}>
                          {business.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {error && <p className="text-sm text-short">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending && !confirmDelete ? "Saving…" : "Save changes"}
            </Button>
            {row.canDelete ? (
              <Button
                type="button"
                variant="danger"
                className="w-full"
                disabled={pending}
                onClick={onDelete}
              >
                {pending && confirmDelete
                  ? "Deleting…"
                  : confirmDelete
                    ? "Tap again to confirm delete"
                    : "Delete"}
              </Button>
            ) : null}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
