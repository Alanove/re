import { InvoiceBrandForm } from "@/components/savings-forms";
import { requireAdult } from "@/lib/session";

export default async function SettingsInvoicesPage() {
  const { member } = await requireAdult();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Receipts & invoices</h1>
        <p className="text-sm text-muted">Brand name shown on invoice and receipt PDFs.</p>
      </header>

      <section className="space-y-3">
        <InvoiceBrandForm invoiceBrandName={member.household.invoiceBrandName} />
      </section>
    </div>
  );
}
