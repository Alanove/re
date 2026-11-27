"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInvoiceAction, updateInvoiceAction } from "@/app/actions/work";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, fromMinorUnits } from "@/lib/money";
import { lineTotal } from "@/lib/invoice";
import { todayIsoDate } from "@/lib/utils";

type Category = { id: string; name: string; defaultPrice: number };
type Business = { id: string; name: string };
type Customer = { id: string; name: string };

type BuilderLine = {
  key: string;
  description: string;
  categoryId: string;
  quantity: string;
  unitAmount: string;
  discount: string;
};

function blankLine(
  key: string,
  categories: Category[],
  preset?: Partial<BuilderLine>
): BuilderLine {
  const first = categories[0];
  return {
    key,
    description: preset?.description ?? "",
    categoryId: preset?.categoryId ?? first?.id ?? "",
    quantity: preset?.quantity ?? "1",
    unitAmount:
      preset?.unitAmount ??
      (first ? fromMinorUnits(first.defaultPrice).toFixed(2) : ""),
    discount: preset?.discount ?? "",
  };
}

function parseMajor(value: string): number {
  const n = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.round(n * 100);
}

export function InvoiceBuilder({
  customers,
  businesses,
  categories,
  currency,
  mode = "create",
  invoiceId,
  initialCustomerId,
  initialBusinessId,
  initialIssueDate,
  initialDueDate,
  initialNotes,
  initialLines,
}: {
  customers: Customer[];
  businesses: Business[];
  categories: Category[];
  currency: string;
  mode?: "create" | "edit";
  invoiceId?: string;
  initialCustomerId?: string;
  initialBusinessId?: string;
  initialIssueDate?: string;
  initialDueDate?: string;
  initialNotes?: string;
  initialLines?: {
    description: string;
    categoryId: string | null;
    quantity: number;
    unitAmount: number;
    discountAmount: number;
  }[];
}) {
  const router = useRouter();
  const reactId = useId();
  const [lineSeq, setLineSeq] = useState(
    Math.max(1, initialLines?.length ?? 1)
  );
  const [customerId, setCustomerId] = useState(initialCustomerId || "");
  const [businessId, setBusinessId] = useState(initialBusinessId || "");
  const [issueDate, setIssueDate] = useState(initialIssueDate || todayIsoDate());
  const [dueDate, setDueDate] = useState(initialDueDate || todayIsoDate());
  const [notes, setNotes] = useState(initialNotes || "");
  const [lines, setLines] = useState<BuilderLine[]>(() => {
    if (initialLines && initialLines.length > 0) {
      return initialLines.map((line, index) =>
        blankLine(`${reactId}-${index + 1}`, categories, {
          description: line.description,
          categoryId: line.categoryId || categories[0]?.id || "",
          quantity: String(line.quantity),
          unitAmount: fromMinorUnits(line.unitAmount).toFixed(2),
          discount: line.discountAmount
            ? fromMinorUnits(line.discountAmount).toFixed(2)
            : "",
        })
      );
    }
    return [blankLine(`${reactId}-1`, categories)];
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addLine() {
    const next = lineSeq + 1;
    setLineSeq(next);
    setLines((prev) => [...prev, blankLine(`${reactId}-${next}`, categories)]);
  }

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => {
      const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
      return (
        sum +
        lineTotal({
          quantity: qty,
          unitAmount: parseMajor(line.unitAmount),
          discountAmount: parseMajor(line.discount),
        })
      );
    }, 0);
    return subtotal;
  }, [lines]);

  function updateLine(key: string, patch: Partial<BuilderLine>) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) {
          return line;
        }
        const next = { ...line, ...patch };
        if (patch.categoryId && patch.categoryId !== line.categoryId) {
          const cat = categories.find((row) => row.id === patch.categoryId);
          if (cat) {
            next.unitAmount = fromMinorUnits(cat.defaultPrice).toFixed(2);
          }
        }
        return next;
      })
    );
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result =
        mode === "edit" && invoiceId
          ? await updateInvoiceAction(formData)
          : await createInvoiceAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (mode === "create") {
        const next = lineSeq + 1;
        setLineSeq(next);
        setLines([blankLine(`${reactId}-${next}`, categories)]);
        setNotes("");
        setIssueDate(todayIsoDate());
        setDueDate(todayIsoDate());
      }
      router.refresh();
    });
  }

  if (customers.length === 0) {
    return (
      <p className="text-sm text-muted">Add a customer before creating an invoice.</p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-dashed border-line p-4">
      {mode === "edit" && invoiceId ? (
        <input type="hidden" name="invoiceId" value={invoiceId} />
      ) : null}
      <Label>{mode === "edit" ? "Edit invoice" : "New invoice"}</Label>
      <select
        name="customerId"
        className="h-11 rounded-xl border border-line bg-white px-3"
        value={customerId}
        onChange={(event) => setCustomerId(event.target.value)}
        required
        disabled={mode === "edit"}
      >
        <option value="" disabled>
          Select customer…
        </option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name}
          </option>
        ))}
      </select>
      {businesses.length > 0 ? (
        <select
          name="businessId"
          className="h-11 rounded-xl border border-line bg-white px-3"
          value={businessId}
          onChange={(event) => setBusinessId(event.target.value)}
        >
          <option value="">No business</option>
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Issue date</Label>
          <Input
            name="issueDate"
            type="date"
            value={issueDate}
            onChange={(event) => setIssueDate(event.target.value)}
            required
          />
        </div>
        <div>
          <Label>Due date</Label>
          <Input
            name="dueDate"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            required
          />
        </div>
      </div>
      <Input
        name="notes"
        placeholder="Notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      <div className="space-y-3">
        {lines.map((line, index) => (
          <div key={line.key} className="grid gap-2 rounded-xl border border-line bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Line {index + 1}</p>
              {lines.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setLines((prev) => prev.filter((row) => row.key !== line.key))}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <Input
              name="lineDescription"
              placeholder="Description"
              value={line.description}
              onChange={(event) => updateLine(line.key, { description: event.target.value })}
              required
            />
            <select
              name="lineCategoryId"
              className="h-11 rounded-xl border border-line bg-white px-3"
              value={line.categoryId}
              onChange={(event) => updateLine(line.key, { categoryId: event.target.value })}
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} · {formatMoney(category.defaultPrice, currency)}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Qty</Label>
                <Input
                  name="lineQuantity"
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Input
                  name="lineUnitAmount"
                  inputMode="decimal"
                  value={line.unitAmount}
                  onChange={(event) => updateLine(line.key, { unitAmount: event.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Discount</Label>
                <Input
                  name="lineDiscount"
                  inputMode="decimal"
                  placeholder="0"
                  value={line.discount}
                  onChange={(event) => updateLine(line.key, { discount: event.target.value })}
                />
              </div>
            </div>
            <p className="text-sm text-muted">
              Line total{" "}
              {formatMoney(
                lineTotal({
                  quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)),
                  unitAmount: parseMajor(line.unitAmount),
                  discountAmount: parseMajor(line.discount),
                }),
                currency
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={addLine}>
          Add line
        </Button>
        <p className="text-sm font-medium">Total {formatMoney(totals, currency)}</p>
      </div>

      {error ? <p className="text-sm text-short">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : mode === "edit" ? "Save invoice" : "Create invoice"}
      </Button>
    </form>
  );
}

export function RecordPaymentForm({
  invoiceId,
  remainderMinor,
  currency,
}: {
  invoiceId: string;
  remainderMinor: number;
  currency: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(fromMinorUnits(remainderMinor).toFixed(2));
  const [date, setDate] = useState(todayIsoDate());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-2 grid gap-2 rounded-xl border border-line bg-surface/60 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const { recordInvoicePaymentAction } = await import("@/app/actions/work");
          const result = await recordInvoicePaymentAction(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <p className="text-sm font-medium">Record payment</p>
      <p className="text-xs text-muted">Still owed {formatMoney(remainderMinor, currency)}</p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          name="amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
        <Input
          name="date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </div>
      {error ? <p className="text-sm text-short">{error}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Add payment"}
      </Button>
    </form>
  );
}
