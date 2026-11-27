import { SectionNav } from "@/components/section-nav";
import { requireAdult } from "@/lib/session";

const planLinks = [
  { href: "/plan/bills", label: "Bills" },
  { href: "/plan/loans", label: "Loans" },
  { href: "/plan/cards", label: "Cards" },
  { href: "/plan/debts", label: "Debts" },
  { href: "/plan/forecasts", label: "Forecasts" },
  { href: "/plan/businesses", label: "Businesses" },
  { href: "/plan/categories", label: "Categories" },
];

export default async function PlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdult();

  return (
    <div>
      <SectionNav items={planLinks} />
      {children}
    </div>
  );
}
