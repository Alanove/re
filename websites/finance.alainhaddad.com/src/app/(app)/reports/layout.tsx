import { SectionNav } from "@/components/section-nav";
import { requireAdult } from "@/lib/session";

const reportLinks = [
  { href: "/reports", label: "Overview" },
  { href: "/reports/cashflow", label: "Cashflow" },
  { href: "/reports/income", label: "Income" },
  { href: "/reports/spending", label: "Spending" },
  { href: "/reports/invoices", label: "Invoices" },
  { href: "/reports/savings", label: "Savings" },
  { href: "/reports/obligations", label: "Obligations" },
];

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdult();

  return (
    <div>
      <SectionNav items={reportLinks} />
      {children}
    </div>
  );
}
