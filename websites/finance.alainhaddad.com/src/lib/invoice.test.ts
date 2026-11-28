import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  customerBalance,
  deriveInvoiceStatus,
  invoiceRemainder,
  invoiceTotal,
  lineTotal,
  receiptCopy,
} from "./invoice.js";

describe("invoice math", () => {
  it("computes line total with discount capped at gross", () => {
    assert.equal(lineTotal({ quantity: 1, unitAmount: 100_00, discountAmount: 10_00 }), 90_00);
    assert.equal(lineTotal({ quantity: 2, unitAmount: 50_00, discountAmount: 200_00 }), 0);
    assert.equal(lineTotal({ quantity: 1, unitAmount: 15_00, discountAmount: 0 }), 15_00);
  });

  it("sums multi-line invoice with tax", () => {
    const lines = [
      { quantity: 1, unitAmount: 15_00, discountAmount: 0 },
      { quantity: 1, unitAmount: 100_00, discountAmount: 0 },
      { quantity: 1, unitAmount: 50_00, discountAmount: 0 },
      { quantity: 1, unitAmount: 300_00, discountAmount: 20_00 },
    ];
    assert.equal(invoiceTotal(lines, 0), 445_00);
    assert.equal(invoiceTotal(lines, 1000), 445_00 + Math.round((445_00 * 1000) / 10000));
  });

  it("tracks remainder and status across payments", () => {
    const lines = [{ quantity: 1, unitAmount: 1000_00, discountAmount: 0 }];
    assert.equal(invoiceRemainder(lines, 0, []), 1000_00);
    assert.equal(deriveInvoiceStatus("UNPAID", lines, 0, []), "UNPAID");

    const first = [{ id: "p1", amount: 400_00, date: "2026-11-01" }];
    assert.equal(invoiceRemainder(lines, 0, first), 600_00);
    assert.equal(deriveInvoiceStatus("UNPAID", lines, 0, first), "PARTIAL");

    const both = [
      { id: "p1", amount: 400_00, date: "2026-11-01" },
      { id: "p2", amount: 600_00, date: "2026-11-10" },
    ];
    assert.equal(invoiceRemainder(lines, 0, both), 0);
    assert.equal(deriveInvoiceStatus("PARTIAL", lines, 0, both), "PAID");
    assert.equal(deriveInvoiceStatus("VOID", lines, 0, []), "VOID");
  });

  it("sums customer balance as negative remainders", () => {
    const balance = customerBalance([
      {
        status: "PARTIAL",
        taxBps: 0,
        lines: [{ quantity: 1, unitAmount: 1000_00, discountAmount: 0 }],
        payments: [{ amount: 400_00, date: "2026-11-01" }],
      },
      {
        status: "UNPAID",
        taxBps: 0,
        lines: [{ quantity: 1, unitAmount: 50_00, discountAmount: 0 }],
        payments: [],
      },
      {
        status: "PAID",
        taxBps: 0,
        lines: [{ quantity: 1, unitAmount: 20_00, discountAmount: 0 }],
        payments: [{ amount: 20_00, date: "2026-11-02" }],
      },
      {
        status: "VOID",
        taxBps: 0,
        lines: [{ quantity: 1, unitAmount: 999_00, discountAmount: 0 }],
        payments: [],
      },
    ]);
    assert.equal(balance, -(600_00 + 50_00));
  });

  it("receipt copy mentions remainder only when still owed", () => {
    const lines = [{ quantity: 1, unitAmount: 1000_00, discountAmount: 0 }];
    const payments = [
      { id: "p1", amount: 400_00, date: "2026-11-01", createdAt: "2026-11-01T10:00:00.000Z" },
      { id: "p2", amount: 600_00, date: "2026-11-10", createdAt: "2026-11-10T10:00:00.000Z" },
    ];

    const partial = receiptCopy({
      lines,
      taxBps: 0,
      payments,
      paymentId: "p1",
      currencyLabel: "USD",
    });
    assert.ok(partial);
    assert.equal(partial.isPartial, true);
    assert.equal(partial.stillToPay, 600_00);
    assert.match(partial.summary, /Still to pay/);

    const full = receiptCopy({
      lines,
      taxBps: 0,
      payments,
      paymentId: "p2",
      currencyLabel: "USD",
    });
    assert.ok(full);
    assert.equal(full.isPartial, false);
    assert.equal(full.stillToPay, 0);
    assert.match(full.summary, /Paid in full/);
    assert.doesNotMatch(full.summary, /Still to pay/);
  });
});
