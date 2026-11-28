import {
  EnsurePayslipButton,
  PayslipLineForm,
  TemplateSettingsForm,
} from "@/components/savings-forms";
import { prisma } from "@/lib/db";
import { formatMoney, fromMinorUnits } from "@/lib/money";
import { requireAdult } from "@/lib/session";

export default async function SettingsPayslipPage() {
  const { member } = await requireAdult();
  const books = member.household.booksCurrency || member.household.currency;

  const [templates, accounts] = await Promise.all([
    prisma.payslipTemplate.findMany({
      where: { householdId: member.householdId },
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
        receipts: { orderBy: { month: "desc" }, take: 6 },
      },
    }),
    prisma.savingsAccount.findMany({
      where: { householdId: member.householdId },
      orderBy: { name: "asc" },
    }),
  ]);

  const template = templates[0] ?? null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Payslip</h1>
        <p className="text-sm text-muted">Salary lines, pension rates, and recent receipts.</p>
      </header>

      <section className="space-y-3">
        {!template ? (
          <div className="rounded-2xl border border-dashed border-line bg-card/60 p-6">
            <p className="font-medium">Add your payslip</p>
            <p className="mt-1 text-sm text-muted">
              Creates Gross / Deductions / Additions lines and a pension pot.
            </p>
            <div className="mt-3">
              <EnsurePayslipButton />
            </div>
          </div>
        ) : (
          <>
            <TemplateSettingsForm
              templateId={template.id}
              name={template.name}
              salaryCurrency={template.salaryCurrency}
              companyBps={template.companyBps}
              srspBps={template.srspBps}
              appearFromDay={template.appearFromDay}
              savingsAccountId={template.savingsAccountId}
              accounts={accounts.map((row) => ({ id: row.id, name: row.name }))}
            />
            {(["GROSS", "DEDUCTION", "ADDITION"] as const).map((section) => (
              <div key={section} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted">{section}</h3>
                {template.lines
                  .filter((line) => line.section === section)
                  .map((line) => (
                    <PayslipLineForm
                      key={line.id}
                      lineId={line.id}
                      label={line.label}
                      amountMajor={String(fromMinorUnits(Number(line.amount)))}
                      startMonth={line.startMonth ?? ""}
                      endMonth={line.endMonth ?? ""}
                      salaryCurrency={template.salaryCurrency}
                    />
                  ))}
              </div>
            ))}
            {template.receipts.length > 0 && (
              <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
                <h3 className="font-medium">Recent receipts</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {template.receipts.map((receipt) => (
                    <li key={receipt.id}>
                      {receipt.month} · net {formatMoney(receipt.netPaidBooks, books)} · SRSP{" "}
                      {formatMoney(receipt.srspBooks, books)} · company{" "}
                      {formatMoney(receipt.companyBooks, books)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
