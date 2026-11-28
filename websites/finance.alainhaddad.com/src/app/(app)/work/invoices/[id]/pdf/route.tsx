import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument } from "@/lib/invoice-pdf";
import { prisma } from "@/lib/db";
import { requireAdult } from "@/lib/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { member } = await requireAdult();
  const { id } = await context.params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, householdId: member.householdId },
    include: {
      customer: true,
      lines: { include: { category: true }, orderBy: { sortOrder: "asc" } },
      household: true,
    },
  });

  if (!invoice || invoice.status === "VOID") {
    return new Response("Not found", { status: 404 });
  }

  const buffer = await renderToBuffer(
    InvoiceDocument({
      invoice: {
        number: invoice.number,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
        customerName: invoice.customer.name,
        brandName: invoice.household.invoiceBrandName || "Liteweb",
        currency: invoice.household.currency,
        taxBps: invoice.taxBps,
        notes: invoice.notes,
        lines: invoice.lines.map((line) => ({
          description: line.description,
          categoryName: line.category?.name ?? null,
          quantity: line.quantity,
          unitAmount: line.unitAmount,
          discountAmount: line.discountAmount,
        })),
      },
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
    },
  });
}
