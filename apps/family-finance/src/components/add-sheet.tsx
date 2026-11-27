"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addBorrowedAction,
  addExpenseAction,
  addIncomeAction,
  repayDebtAction,
} from "@/app/actions/money";
import { recordInvoicePaymentAction } from "@/app/actions/work";
import { CategoryCombobox } from "@/components/category-combobox";
import { CustomerCombobox } from "@/components/customer-combobox";
import { ReceiptCapture } from "@/components/receipt-capture";
import { netReceived } from "@/lib/debt";
import { formatMoney, fromMinorUnits, toMinorUnits } from "@/lib/money";
import type { Role } from "@/lib/roles";
import { canAddIncome, canManageDebts } from "@/lib/roles";

type OpenInvoice = {
  id: string;
  number: string;
  customerId: string;
  remainder: number;
};

type Kind = "income" | "expense" | "borrowed" | "repay";
type IncomeKind = "SALARY" | "FREELANCE" | "OTHER";

const CATEGORY_MEMORY_KEY = "ff-category-by-desc";

function normalizeDesc(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function readCategoryMemory(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CATEGORY_MEMORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function rememberCategory(description: string, categoryId: string) {
  if (typeof window === "undefined") return;
  const key = normalizeDesc(description);
  if (!key || !categoryId) return;
  const map = readCategoryMemory();
  map[key] = categoryId;
  window.localStorage.setItem(CATEGORY_MEMORY_KEY, JSON.stringify(map));
}

export function AddSheet({
  role,
  categories,
  businesses,
  cards,
  members,
  debts,
  onlyAdult,
  currency,
  cashAvailable,
  customers,
  openInvoices = [],
}: {
  role: Role;
  categories: { id: string; name: string; requiresBusiness: boolean }[];
  businesses: { id: string; name: string }[];
  cards: { id: string; name: string }[];
  members: { id: string; displayName: string }[];
  debts: { id: string; person: string; remaining: number }[];
  onlyAdult: boolean;
  currency: string;
  cashAvailable: number;
  customers: { id: string; name: string }[];
  openInvoices?: OpenInvoice[];
}) {
  const [open, setOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const [kind, setKind] = useState<Kind>("expense");
  const [incomeKind, setIncomeKind] = useState<IncomeKind>("SALARY");
  const [funding, setFunding] = useState<"OWN" | "CARD" | "BORROWED">("OWN");
  const [categoryId, setCategoryId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const [receiptCustomerName, setReceiptCustomerName] = useState("");
  const [receiptInvoiceNumber, setReceiptInvoiceNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showMore, setShowMore] = useState(false);
  const [borrowAmount, setBorrowAmount] = useState("");
  const [borrowFee, setBorrowFee] = useState("");
  const [repayDebtId, setRepayDebtId] = useState(debts[0]?.id ?? "");
  const [repayAmount, setRepayAmount] = useState(
    debts[0] ? String(debts[0].remaining / 100) : ""
  );
  const [description, setDescription] = useState("");

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId),
    [categories, categoryId]
  );

  const choices: { id: Kind; label: string; show: boolean }[] = [
    { id: "expense", label: "Expense", show: true },
    { id: "income", label: "Income", show: canAddIncome(role) },
    { id: "borrowed", label: "Borrowed", show: canManageDebts(role) },
    { id: "repay", label: "Paid back", show: canManageDebts(role) },
  ];

  const visibleChoices = choices.filter((choice) => choice.show);

  function switchKind(next: Kind) {
    setKind(next);
    setError(null);
    setShowMore(false);
  }

  const borrowPreview = useMemo(() => {
    try {
      const principal = borrowAmount ? toMinorUnits(borrowAmount) : 0;
      const fee = borrowFee ? toMinorUnits(borrowFee) : 0;
      if (principal <= 0) return null;
      return {
        receive: netReceived(principal, fee),
        owe: principal,
      };
    } catch {
      return null;
    }
  }, [borrowAmount, borrowFee]);

  function reset() {
    setKind("expense");
    setIncomeKind("SALARY");
    setFunding("OWN");
    setCategoryId("");
    setCustomerId("");
    setCustomerName("");
    setInvoiceId("");
    setAmount("");
    setReceiptPaymentId(null);
    setReceiptCustomerName("");
    setReceiptInvoiceNumber("");
    setError(null);
    setShowMore(false);
    setBorrowAmount("");
    setBorrowFee("");
    setRepayDebtId(debts[0]?.id ?? "");
    setRepayAmount(debts[0] ? String(debts[0].remaining / 100) : "");
    setDescription("");
    setSheetKey((value) => value + 1);
  }

  const recentCustomers = customers.slice(0, 6);
  const customerOpenInvoices = useMemo(
    () =>
      incomeKind === "FREELANCE" && customerId
        ? openInvoices.filter((invoice) => invoice.customerId === customerId)
        : [],
    [openInvoices, customerId, incomeKind]
  );
  const selectedInvoice = customerOpenInvoices.find((invoice) => invoice.id === invoiceId);

  function selectCustomer(next: { id: string; name: string }) {
    setCustomerId(next.id);
    setCustomerName(next.name);
    setInvoiceId("");
  }

  function selectInvoice(invoice: OpenInvoice | null) {
    if (!invoice) {
      setInvoiceId("");
      return;
    }
    const owner = customers.find((row) => row.id === invoice.customerId);
    if (owner) {
      setCustomerId(owner.id);
      setCustomerName(owner.name);
    }
    setInvoiceId(invoice.id);
    setAmount(fromMinorUnits(invoice.remainder).toFixed(2));
    if (!description.trim()) {
      setDescription(`Invoice ${invoice.number} payment`);
    }
  }

  function onSubmit(formData: FormData) {
    setError(null);
    if (kind === "expense" && funding === "OWN") {
      try {
        const ownAmount = toMinorUnits(String(formData.get("amount") ?? "0"));
        if (ownAmount > cashAvailable) {
          setError("Not enough cash. Use card or borrow.");
          return;
        }
      } catch {
        // server will validate
      }
    }
    const matchedInvoice =
      kind === "income" && invoiceId
        ? openInvoices.find((row) => row.id === invoiceId) ?? null
        : null;
    if (invoiceId && kind === "income") {
      if (!matchedInvoice || matchedInvoice.customerId !== customerId) {
        setError("Pick an open invoice for this customer.");
        setInvoiceId("");
        return;
      }
    }
    startTransition(async () => {
      let result: { ok: boolean; error?: string; id?: string };
      if (kind === "income" && matchedInvoice) {
        formData.set("invoiceId", matchedInvoice.id);
        formData.set("customerId", matchedInvoice.customerId);
        result = await recordInvoicePaymentAction(formData);
      } else if (kind === "income") {
        result = await addIncomeAction(formData);
      } else if (kind === "expense") {
        result = await addExpenseAction(formData);
        if (result.ok) {
          rememberCategory(
            String(formData.get("description") ?? ""),
            String(formData.get("categoryId") ?? categoryId)
          );
        }
      } else if (kind === "borrowed") {
        result = await addBorrowedAction(formData);
      } else {
        result = await repayDebtAction(formData);
      }
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      if (kind === "income" && matchedInvoice && result.id) {
        const owner = customers.find((row) => row.id === matchedInvoice.customerId);
        setReceiptPaymentId(result.id);
        setReceiptCustomerName(owner?.name ?? customerName);
        setReceiptInvoiceNumber(matchedInvoice.number);
        return;
      }
      setOpen(false);
      reset();
    });
  }

  function onDescriptionChange(value: string) {
    setDescription(value);
    if (kind !== "expense" || categoryId) return;
    const remembered = readCategoryMemory()[normalizeDesc(value)];
    if (remembered && categories.some((row) => row.id === remembered)) {
      setCategoryId(remembered);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" className="-mt-6 h-14 w-14 rounded-full shadow-lg" aria-label="Add">
          <Plus className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        {receiptPaymentId ? (
          <>
            <DialogHeader>
              <DialogTitle>Payment saved</DialogTitle>
              <DialogDescription>
                Receipt for {receiptCustomerName || "customer"}
                {receiptInvoiceNumber ? ` · ${receiptInvoiceNumber}` : ""}. Print the PDF, or
                find it later under Work and Activity.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Button asChild className="w-full">
                <a
                  href={`/work/payments/${receiptPaymentId}/receipt`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Print receipt
                </a>
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
        <DialogHeader>
          <DialogTitle>
            {kind === "expense"
              ? "Add expense"
              : kind === "income"
                ? "Add income"
                : kind === "borrowed"
                  ? "I borrowed"
                  : "I paid something back"}
          </DialogTitle>
          <DialogDescription>
            Description is one line. Extra fields sit under More.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="amount">{kind === "borrowed" ? "Amount owed" : "Amount"}</Label>
            {kind === "borrowed" ? (
              <Input
                id="amount"
                name="amount"
                inputMode="decimal"
                placeholder="0.00"
                required
                autoFocus
                value={borrowAmount}
                onChange={(event) => setBorrowAmount(event.target.value)}
              />
            ) : kind === "repay" ? (
              <Input
                id="amount"
                name="amount"
                inputMode="decimal"
                placeholder="0.00"
                required
                autoFocus
                value={repayAmount}
                onChange={(event) => setRepayAmount(event.target.value)}
              />
            ) : (
              <Input
                key={kind}
                id="amount"
                name="amount"
                inputMode="decimal"
                placeholder="0.00"
                required
                autoFocus
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            )}
            {selectedInvoice ? (
              <p className="text-xs text-muted">
                Still owed on {selectedInvoice.number}:{" "}
                {formatMoney(selectedInvoice.remainder, currency)}. Enter any part or the full
                amount.
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Input
              key={`desc-${kind}`}
              id="description"
              name="description"
              placeholder="One line"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </div>

          {kind === "income" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="kind">Kind</Label>
                <select
                  id="kind"
                  name="kind"
                  className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  value={incomeKind}
                  onChange={(event) => {
                    setIncomeKind(event.target.value as IncomeKind);
                    setInvoiceId("");
                  }}
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
                          onClick={() =>
                            selectCustomer({ id: customer.id, name: customer.name })
                          }
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
                    onChange={selectCustomer}
                  />
                  {customerOpenInvoices.length > 0 ? (
                    <div className="space-y-2 rounded-2xl border border-line bg-surface/60 p-3">
                      <p className="text-sm font-medium">Apply to open invoice</p>
                      <p className="text-xs text-muted">
                        Optional. Pick an invoice to record a full or partial payment.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={invoiceId ? "secondary" : "default"}
                          onClick={() => selectInvoice(null)}
                        >
                          None
                        </Button>
                        {customerOpenInvoices.map((invoice) => (
                          <Button
                            key={invoice.id}
                            type="button"
                            size="sm"
                            variant={invoiceId === invoice.id ? "default" : "secondary"}
                            onClick={() => selectInvoice(invoice)}
                          >
                            {invoice.number} · {formatMoney(invoice.remainder, currency)}
                          </Button>
                        ))}
                      </div>
                      {invoiceId ? (
                        <input type="hidden" name="invoiceId" value={invoiceId} />
                      ) : null}
                    </div>
                  ) : customerId ? (
                    <p className="text-xs text-muted">
                      No open invoices for this customer. Saves as regular freelance income.
                    </p>
                  ) : (
                    <p className="text-xs text-muted">
                      Name is enough to save. Contact details can wait.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {kind === "expense" && (
            <>
              <input type="hidden" name="funding" value={funding} />
              <CategoryCombobox
                key={`category-${sheetKey}`}
                categories={categories}
                valueId={categoryId}
                onChange={(next) => setCategoryId(next.id)}
              />
              <p className="text-xs text-muted">
                Cash available {formatMoney(cashAvailable, currency)}
              </p>
              <ReceiptCapture key={`receipt-${sheetKey}`} />
              <div className="flex flex-wrap gap-2">
                {(["OWN", "CARD", "BORROWED"] as const)
                  .filter((value) => canManageDebts(role) || value === "OWN")
                  .map((value) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={funding === value ? "default" : "secondary"}
                      onClick={() => setFunding(value)}
                    >
                      {value === "OWN" ? "Own money" : value === "CARD" ? "Card" : "Borrowed"}
                    </Button>
                  ))}
              </div>
              {funding === "CARD" && (
                <div className="space-y-1">
                  <Label htmlFor="creditCardId">Card</Label>
                  <select
                    id="creditCardId"
                    name="creditCardId"
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                    required
                    defaultValue={cards[0]?.id}
                  >
                    {cards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {funding === "BORROWED" && (
                <div className="space-y-1">
                  <Label htmlFor="debtPerson">Borrowed from</Label>
                  <Input id="debtPerson" name="debtPerson" required placeholder="Brother" />
                </div>
              )}
              {selectedCategory?.requiresBusiness && (
                <div className="space-y-1">
                  <Label htmlFor="businessId">Business</Label>
                  <select
                    id="businessId"
                    name="businessId"
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                    required
                    defaultValue={businesses[0]?.id}
                  >
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

          {kind === "borrowed" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="person">From</Label>
                <Input id="person" name="person" required placeholder="Person, bank, or entity" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="feeFixed">One-time fee (taken from advance)</Label>
                <Input
                  id="feeFixed"
                  name="feeFixed"
                  inputMode="decimal"
                  placeholder="0"
                  value={borrowFee}
                  onChange={(event) => setBorrowFee(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="monthlyInterestPercent">Monthly interest %</Label>
                <Input
                  id="monthlyInterestPercent"
                  name="monthlyInterestPercent"
                  inputMode="decimal"
                  placeholder="0"
                  defaultValue="0"
                />
              </div>
              {borrowPreview && (
                <p className="rounded-2xl border border-line bg-white p-3 text-sm text-muted">
                  You receive{" "}
                  <span className="font-medium text-ink">
                    {formatMoney(borrowPreview.receive, currency)}
                  </span>
                  {" · "}
                  You owe{" "}
                  <span className="font-medium text-ink">
                    {formatMoney(borrowPreview.owe, currency)}
                  </span>
                </p>
              )}
            </>
          )}

          {kind === "repay" && (
            <div className="space-y-1">
              <Label htmlFor="debtId">Debt</Label>
              <select
                id="debtId"
                name="debtId"
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
                required
                value={repayDebtId}
                onChange={(event) => {
                  const id = event.target.value;
                  setRepayDebtId(id);
                  const debt = debts.find((row) => row.id === id);
                  if (debt) {
                    setRepayAmount(String(debt.remaining / 100));
                  }
                }}
              >
                {debts.map((debt) => (
                  <option key={debt.id} value={debt.id}>
                    {debt.person} · {(debt.remaining / 100).toLocaleString("en-US")} left
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            className="text-sm font-medium text-muted underline"
            onClick={() => setShowMore((value) => !value)}
          >
            {showMore ? "Hide more" : "More"}
          </button>

          {showMore && (
            <div className="space-y-3 rounded-2xl border border-line bg-white p-3">
              <div className="space-y-1">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" />
              </div>
              {kind === "income" && incomeKind === "FREELANCE" && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="customerPhone">Customer phone</Label>
                    <Input
                      id="customerPhone"
                      name="customerPhone"
                      placeholder="Optional"
                      autoComplete="tel"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="customerEmail">Customer email</Label>
                    <Input
                      id="customerEmail"
                      name="customerEmail"
                      type="email"
                      placeholder="Optional — edit later on Work"
                      autoComplete="email"
                    />
                  </div>
                </>
              )}
              {canAddIncome(role) && !onlyAdult && kind !== "repay" && kind !== "borrowed" && (
                <div className="space-y-1">
                  <Label htmlFor="memberId">Member</Label>
                  <select
                    id="memberId"
                    name="memberId"
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                    defaultValue={members[0]?.id}
                  >
                    {members.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {kind === "expense" && !selectedCategory?.requiresBusiness && businesses.length > 0 && (
                <div className="space-y-1">
                  <Label htmlFor="businessIdMore">Business</Label>
                  <select
                    id="businessIdMore"
                    name="businessId"
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                    defaultValue=""
                  >
                    <option value="">None</option>
                    {businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-short">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>

          {visibleChoices.length > 1 && (
            <div className="border-t border-line pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Or record
              </p>
              <div className="flex flex-wrap gap-2">
                {visibleChoices.map((choice) => (
                  <Button
                    key={choice.id}
                    type="button"
                    size="sm"
                    variant={kind === choice.id ? "default" : "secondary"}
                    onClick={() => switchKind(choice.id)}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
