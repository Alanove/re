function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const encoded = encodeURIComponent(text);
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

function moneyMajor(minor: number, currency: string) {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

export function whatsappRenewalUrl(
  phone: string,
  customerName: string,
  serviceName: string,
  renewalDate: string,
  priceMinor: number,
  currency: string
) {
  return waLink(
    phone,
    `Hi ${customerName}, your ${serviceName} renews on ${renewalDate}. Price: ${moneyMajor(priceMinor, currency)}. Please confirm if you would like to renew.`
  );
}

export function whatsappInvoiceUrl(input: {
  phone: string;
  customerName: string;
  invoiceNumber: string;
  totalMinor: number;
  currency: string;
  lines: { description: string; quantity: number; lineTotal: number }[];
}) {
  const lineText = input.lines
    .map(
      (line) =>
        `• ${line.description} ×${line.quantity}: ${moneyMajor(line.lineTotal, input.currency)}`
    )
    .join("\n");
  return waLink(
    input.phone,
    `Hi ${input.customerName},\n\nInvoice ${input.invoiceNumber}\n${lineText}\n\nTotal: ${moneyMajor(input.totalMinor, input.currency)}\n\nPlease pay when you can. Thank you.`
  );
}

export function whatsappReceiptUrl(input: {
  phone: string;
  customerName: string;
  invoiceNumber: string;
  paidMinor: number;
  totalMinor: number;
  stillToPayMinor: number;
  currency: string;
  summary: string;
}) {
  const remainder =
    input.stillToPayMinor > 0
      ? `\nStill to pay: ${moneyMajor(input.stillToPayMinor, input.currency)}`
      : "\nPaid in full.";
  return waLink(
    input.phone,
    `Hi ${input.customerName},\n\nReceipt for invoice ${input.invoiceNumber}\n${input.summary}${remainder}\n\nThank you.`
  );
}
