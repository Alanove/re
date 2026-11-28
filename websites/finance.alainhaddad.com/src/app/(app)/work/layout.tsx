import { SectionNav } from "@/components/section-nav";
import { requireAdult } from "@/lib/session";

const workLinks = [
  { href: "/work/customers", label: "Customers" },
  { href: "/work/renewals", label: "Renewals" },
  { href: "/work/invoices", label: "Invoices" },
  { href: "/work/settled", label: "Settled" },
  { href: "/work/prices", label: "Prices" },
];

export default async function WorkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdult();

  return (
    <div>
      <SectionNav items={workLinks} />
      {children}
    </div>
  );
}
