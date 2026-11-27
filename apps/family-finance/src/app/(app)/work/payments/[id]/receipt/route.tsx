import { renderToBuffer } from "@react-pdf/renderer";
import { ReceiptDocument } from "@/lib/invoice-pdf";
import { receiptCopy } from "@/lib/invoice";
import { prisma } from "@/lib/db";
import { requireAdult } from "@/lib/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { member } = await requireAdult();
  const { id } = await context.params;

  const payment = await prisma.invoicePayment.findFirst({
    where: {
      id,
      invoice: { householdId: member.householdId },
    },
    include: {
      invoice: {
        include: {
          customer: true,
          household: true,
          lines: { include: { category: true }, orderBy: { sortOrder: "asc" } },
          payments: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
        },
      },
    },
  });

  if (!payment) {
    return new Response("Not found", { status: 404 });
  }

  const invoice = payment.invoice;
  const brandName = invoice.household.invoiceBrandName || "Liteweb";
  const copy = receiptCopy({
    lines: invoice.lines,
    taxBps: invoice.taxBps,
    payments: invoice.payments,
    paymentId: payment.id,
    currencyLabel: invoice.household.currency,
  });
  if (!copy) {
    return new Response("Not found", { status: 404 });
  }

  const buffer = await renderToBuffer(
    ReceiptDocument({
      receipt: {
        number: invoice.number,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
        customerName: invoice.customer.name,
        brandName,
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
        paymentDate: payment.date,
        paidAmount: copy.paidAmount,
        stillToPay: copy.stillToPay,
        summary: copy.summary,
      },
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${invoice.number}-${payment.date}.pdf"`,
    },
  });
}
