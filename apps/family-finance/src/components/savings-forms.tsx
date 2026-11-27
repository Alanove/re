"use client";

import { useState, useTransition } from "react";
import {
  createSavingsAccountAction,
  depositToSavingsAction,
  ensureDefaultPayslipTemplateAction,
  recalcSrspAction,
  setSavingsTotalAction,
  updateCurrencySettingsAction,
  updateInvoiceBrandAction,
  updateMetalAction,
  updatePayslipLineAction,
  updatePayslipTemplateAction,
  upsertFxRateAction,
  withdrawFromSavingsAction,
} from "@/app/actions/savings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TROY_OZ_GRAMS, formatTroyOzInput } from "@/lib/savings";

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function run(
    action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>,
    formData: FormData
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
      }
    });
  }
  return { error, pending, run };
}

export function EnsurePayslipButton() {
  const { error, pending, run } = useAction();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() => run(ensureDefaultPayslipTemplateAction, new FormData())}
      >
        {pending ? "Creating…" : "Create payslip template"}
      </Button>
      {error && <p className="text-sm text-short">{error}</p>}
    </div>
  );
}

export function CurrencySettingsForm({
  booksCurrency,
  displayCurrency,
  entryCurrency,
}: {
  booksCurrency: string;
  displayCurrency: string;
  entryCurrency: string;
}) {
  const { error, pending, run } = useAction();
  return (
    <form
      className="grid gap-2 rounded-2xl border border-line bg-white p-4 shadow-card"
      action={(fd) => run(updateCurrencySettingsAction, fd)}
    >
      <h3 className="font-medium">Currencies</h3>
      <Label>Books currency</Label>
      <Input name="booksCurrency" defaultValue={booksCurrency} required />
      <Label>Display currency</Label>
      <Input name="displayCurrency" defaultValue={displayCurrency} required />
      <Label>Entry currency</Label>
      <Input name="entryCurrency" defaultValue={entryCurrency} required />
      <Button type="submit" disabled={pending}>
        Save currencies
      </Button>
      {error && <p className="text-sm text-short">{error}</p>}
    </form>
  );
}

export function InvoiceBrandForm({ invoiceBrandName }: { invoiceBrandName: string }) {
  const { error, pending, run } = useAction();
  return (
    <form
      className="grid gap-2 rounded-2xl border border-line bg-white p-4 shadow-card"
      action={(fd) => run(updateInvoiceBrandAction, fd)}
    >
      <h3 className="font-medium">Brand on PDFs</h3>
      <p className="text-sm text-muted">
        Shown as the company name on invoice and receipt PDFs. Does not change the household name in
        the app.
      </p>
      <Label>Brand name</Label>
      <Input name="invoiceBrandName" defaultValue={invoiceBrandName} required maxLength={80} />
      <Button type="submit" disabled={pending}>
        Save brand name
      </Button>
      {error && <p className="text-sm text-short">{error}</p>}
    </form>
  );
}

export function FxRateForm({
  fromCurrency,
  toCurrency,
  rate,
}: {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
}) {
  const { error, pending, run } = useAction();
  return (
    <form
      className="grid gap-2 rounded-2xl border border-line bg-white p-4 shadow-card"
      action={(fd) => run(upsertFxRateAction, fd)}
    >
      <h3 className="font-medium">FX rate</h3>
      <p className="text-sm text-muted">How many units of From equal 1 unit of To.</p>
      <Label>From</Label>
      <Input name="fromCurrency" defaultValue={fromCurrency} required />
      <Label>To</Label>
      <Input name="toCurrency" defaultValue={toCurrency} required />
      <Label>Rate</Label>
      <Input name="rate" defaultValue={rate} required />
      <Button type="submit" disabled={pending}>
        Save rate
      </Button>
      {error && <p className="text-sm text-short">{error}</p>}
    </form>
  );
}

export function TemplateSettingsForm({
  templateId,
  name,
  salaryCurrency,
  companyBps,
  srspBps,
  appearFromDay,
  savingsAccountId,
  accounts,
}: {
  templateId: string;
  name: string;
  salaryCurrency: string;
  companyBps: number;
  srspBps: number;
  appearFromDay: number;
  savingsAccountId: string | null;
  accounts: { id: string; name: string }[];
}) {
  const { error, pending, run } = useAction();
  return (
    <form
      className="grid gap-2 rounded-2xl border border-line bg-white p-4 shadow-card"
      action={(fd) => run(updatePayslipTemplateAction, fd)}
    >
      <input type="hidden" name="templateId" value={templateId} />
      <h3 className="font-medium">Payslip settings</h3>
      <Label>Name</Label>
      <Input name="name" defaultValue={name} required />
      <Label>Salary currency</Label>
      <Input name="salaryCurrency" defaultValue={salaryCurrency} required />
      <Label>Employee SRSP bps (600 = 6%)</Label>
      <Input name="srspBps" type="number" defaultValue={srspBps} required />
      <Label>Company match bps</Label>
      <Input name="companyBps" type="number" defaultValue={companyBps} required />
      <Label>Show next month from day</Label>
      <Input name="appearFromDay" type="number" min={1} max={28} defaultValue={appearFromDay} required />
      <p className="text-xs text-muted">
        From this day, Home shows next month&apos;s salary and bills (salary often lands early).
      </p>
      <Label>Pension pot</Label>
      <select
        name="savingsAccountId"
        className="h-11 rounded-xl border border-line bg-white px-3"
        defaultValue={savingsAccountId ?? ""}
      >
        <option value="">None</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          Save template
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            const fd = new FormData();
            fd.set("templateId", templateId);
            run(recalcSrspAction, fd);
          }}
        >
          Recalc SRSP from Basic
        </Button>
      </div>
      {error && <p className="text-sm text-short">{error}</p>}
    </form>
  );
}

export function PayslipLineForm({
  lineId,
  label,
  amountMajor,
  startMonth,
  endMonth,
  salaryCurrency,
}: {
  lineId: string;
  label: string;
  amountMajor: string;
  startMonth: string;
  endMonth: string;
  salaryCurrency: string;
}) {
  const { error, pending, run } = useAction();
  return (
    <form
      className="grid gap-2 rounded-xl border border-line bg-white p-3"
      action={(fd) => run(updatePayslipLineAction, fd)}
    >
      <input type="hidden" name="lineId" value={lineId} />
      <p className="text-sm font-medium">
        {label} <span className="text-muted">({salaryCurrency})</span>
      </p>
      <Input name="amount" defaultValue={amountMajor} required />
      <div className="grid grid-cols-2 gap-2">
        <Input name="startMonth" type="month" defaultValue={startMonth} placeholder="Start" />
        <Input name="endMonth" type="month" defaultValue={endMonth} placeholder="End" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Save line
      </Button>
      {error && <p className="text-sm text-short">{error}</p>}
    </form>
  );
}

export function CreateAccountForm({ defaultCurrency = "USD" }: { defaultCurrency?: string }) {
  const { error, pending, run } = useAction();
  return (
    <form
      className="grid gap-2 rounded-2xl border border-dashed border-line p-4"
      action={(fd) => run(createSavingsAccountAction, fd)}
    >
      <Label>New savings account</Label>
      <Input name="name" placeholder="Name" required />
      <select name="kind" className="h-11 rounded-xl border border-line bg-white px-3" defaultValue="CASH">
        <option value="PENSION">Pension</option>
        <option value="GOLD">Gold</option>
        <option value="SILVER">Silver</option>
        <option value="CASH">Cash</option>
      </select>
      <Label>Currency</Label>
      <Input name="currency" defaultValue={defaultCurrency} placeholder="USD" required maxLength={3} />
      <Button type="submit" disabled={pending}>
        Add account
      </Button>
      {error && <p className="text-sm text-short">{error}</p>}
    </form>
  );
}

export function SetTotalForm({ accountId }: { accountId: string }) {
  const { error, pending, run } = useAction();
  return (
    <form className="flex gap-2" action={(fd) => run(setSavingsTotalAction, fd)}>
      <input type="hidden" name="accountId" value={accountId} />
      <Input name="total" placeholder="Set total" required />
      <Button type="submit" size="sm" disabled={pending}>
        Set
      </Button>
      {error && <p className="text-sm text-short">{error}</p>}
    </form>
  );
}

export function MetalForm({
  accountId,
  grams,
  unitPriceMajor,
}: {
  accountId: string;
  grams: string;
  unitPriceMajor: string;
}) {
  const { error, pending, run } = useAction();
  const [unit, setUnit] = useState<"g" | "oz">("g");
  const gramsNum = Number(grams) || 0;
  const pricePerGram = Number(unitPriceMajor) || 0;
  const weightDefault =
    unit === "oz" ? formatTroyOzInput(gramsNum / TROY_OZ_GRAMS) : grams;
  const priceDefault =
    unit === "oz"
      ? String(Number((pricePerGram * TROY_OZ_GRAMS).toFixed(2)))
      : unitPriceMajor;

  return (
    <form className="grid gap-2" action={(fd) => run(updateMetalAction, fd)}>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="weightUnit" value={unit} />
      <Label>Weight unit</Label>
      <select
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={unit}
        onChange={(e) => setUnit(e.target.value === "oz" ? "oz" : "g")}
      >
        <option value="g">Grams</option>
        <option value="oz">Troy ounces</option>
      </select>
      <Label>{unit === "oz" ? "Troy ounces" : "Grams"}</Label>
      <Input key={`weight-${unit}`} name="weight" defaultValue={weightDefault} required />
      <Label>
        {unit === "oz" ? "Price per troy ounce (books currency)" : "Price per gram (books currency)"}
      </Label>
      <Input key={`price-${unit}`} name="unitPrice" defaultValue={priceDefault} required />
      <Button type="submit" size="sm" disabled={pending}>
        Update metal
      </Button>
      {error && <p className="text-sm text-short">{error}</p>}
    </form>
  );
}

export function DepositForm({ accountId }: { accountId: string }) {
  const { error, pending, run } = useAction();
  return (
    <form className="flex gap-2" action={(fd) => run(depositToSavingsAction, fd)}>
      <input type="hidden" name="accountId" value={accountId} />
      <Input name="amount" placeholder="Deposit from cash" required />
      <Button type="submit" size="sm" disabled={pending}>
        Deposit
      </Button>
      {error && <p className="text-sm text-short">{error}</p>}
    </form>
  );
}

export function WithdrawForm({ accountId }: { accountId: string }) {
  const { error, pending, run } = useAction();
  return (
    <form className="flex gap-2" action={(fd) => run(withdrawFromSavingsAction, fd)}>
      <input type="hidden" name="accountId" value={accountId} />
      <Input name="amount" placeholder="Withdraw to cash" required />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Withdraw
      </Button>
      {error && <p className="text-sm text-short">{error}</p>}
    </form>
  );
}
