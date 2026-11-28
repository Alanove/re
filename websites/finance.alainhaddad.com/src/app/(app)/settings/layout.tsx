import { SectionNav } from "@/components/section-nav";
import { isAdultRole } from "@/lib/roles";
import { requireMember } from "@/lib/session";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { member } = await requireMember();
  const adult = isAdultRole(member.role);

  const links = [
    { href: "/settings/household", label: "Household" },
    { href: "/settings/password", label: "Password" },
    ...(adult
      ? [
          { href: "/settings/money", label: "Money" },
          { href: "/settings/payslip", label: "Payslip" },
          { href: "/settings/invoices", label: "Invoices" },
        ]
      : []),
  ];

  return (
    <div>
      <SectionNav items={links} />
      {children}
    </div>
  );
}
