import Link from "next/link";
import {
  CreateAccountForm,
  DepositForm,
  MetalForm,
  SetTotalForm,
  WithdrawForm,
} from "@/components/savings-forms";
import { SavingsForecast } from "@/components/savings-forecast";
import { prisma } from "@/lib/db";
import { convertMinor } from "@/lib/fx";
import { formatMoney, fromMinorUnits } from "@/lib/money";
import { formatMetalWeight, metalValueBooks, potBalance } from "@/lib/savings";
import { requireAdult } from "@/lib/session";
import { currentMonth } from "@/lib/utils";

function accountBalance(account: {
  kind: string;
  quantityMg: bigint;
  unitPricePerGram: number;
  txns: { amount: number }[];
}): number {
  if (account.kind === "GOLD" || account.kind === "SILVER") {
    return metalValueBooks(account.quantityMg, account.unitPricePerGram);
  }
  return potBalance(account.txns);
}

export default async function SavingsPage() {
  const { member } = await requireAdult();
  const books = member.household.booksCurrency || member.household.currency;
  const month = currentMonth();

  const [accounts, receipt, rates] = await Promise.all([
    prisma.savingsAccount.findMany({
      where: { householdId: member.householdId },
      include: { txns: { orderBy: { createdAt: "desc" } } },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    prisma.payslipReceipt.findFirst({
      where: {
        month,
        template: { householdId: member.householdId },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.fxRate.findMany({ where: { householdId: member.householdId } }),
  ]);

  const fxQuotes = rates.map((row) => ({
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    rate: row.rate,
  }));

  const pots = accounts.map((account) => {
    const balance = accountBalance(account);
    let booksBalance = balance;
    let converted = true;
    if (account.currency.toUpperCase() !== books.toUpperCase()) {
      try {
        booksBalance = convertMinor(balance, account.currency, books, fxQuotes);
      } catch {
        converted = false;
        booksBalance = 0;
      }
    }
    return { account, balance, booksBalance, converted };
  });

  const totalBooks = pots.reduce((sum, row) => sum + (row.converted ? row.booksBalance : 0), 0);
  const unconverted = pots.filter((row) => !row.converted);
  const salaryContribution = receipt ? receipt.srspBooks + receipt.companyBooks : 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Savings</h1>
        <p className="text-sm text-muted">
          Separate from the main cash ledger. Payslip setup is in{" "}
          <Link href="/settings/payslip" className="underline">
            Settings
          </Link>
          .
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <p className="text-sm text-muted">Current savings (in {books})</p>
        <p className="tabular text-3xl font-semibold">{formatMoney(totalBooks, books)}</p>
        {unconverted.length > 0 && (
          <p className="mt-2 text-sm text-muted">
            Missing FX for{" "}
            {[...new Set(unconverted.map((row) => row.account.currency))].join(", ")}. Add rates in
            Settings.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Contributions
        </h2>
        <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
          <p className="font-medium">From salary this month</p>
          {receipt ? (
            <p className="mt-1 tabular text-sm text-muted">
              {formatMoney(salaryContribution, books)} · SRSP{" "}
              {formatMoney(receipt.srspBooks, books)} + company{" "}
              {formatMoney(receipt.companyBooks, books)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              Not marked yet.{" "}
              <Link href="/" className="underline">
                Mark payslip on Home
              </Link>{" "}
              when it arrives.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Pots</h2>
        {pots.length === 0 ? (
          <p className="text-sm text-muted">Add a savings pot</p>
        ) : (
          pots.map(({ account, balance }) => {
            const recentTxns = account.txns.slice(0, 8);
            return (
              <div
                key={account.id}
                className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card"
              >
                <div>
                  <p className="font-medium">
                    {account.name} · {account.kind} · {account.currency}
                  </p>
                  <p className="tabular text-sm text-muted">
                    {formatMoney(balance, account.currency)}
                  </p>
                  {(account.kind === "GOLD" || account.kind === "SILVER") && (
                    <p className="tabular text-sm text-muted">
                      {formatMetalWeight(account.quantityMg)}
                    </p>
                  )}
                </div>
                {account.kind === "GOLD" || account.kind === "SILVER" ? (
                  <MetalForm
                    accountId={account.id}
                    grams={String(Number(account.quantityMg) / 1000)}
                    unitPriceMajor={String(fromMinorUnits(account.unitPricePerGram))}
                  />
                ) : (
                  <>
                    <SetTotalForm accountId={account.id} />
                    <DepositForm accountId={account.id} />
                    <WithdrawForm accountId={account.id} />
                  </>
                )}
                {recentTxns.length > 0 && (
                  <ul className="space-y-1 text-sm text-muted">
                    {recentTxns.map((txn) => (
                      <li key={txn.id}>
                        {txn.date} · {txn.kind} · {formatMoney(txn.amount, account.currency)}
                        {txn.note ? ` · ${txn.note}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
        <CreateAccountForm defaultCurrency={books} />
      </section>

      <SavingsForecast
        startMinor={totalBooks}
        monthlyContributionMinor={salaryContribution}
        currency={books}
      />
    </div>
  );
}
