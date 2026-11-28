import assert from "node:assert/strict";
import test from "node:test";
import { replayCashLedger, type CashEvent, type CashPlace } from "./cash-ledger.js";

const places: CashPlace[] = [
  { id: "own", openingBalance: 100_00, archived: false },
  { id: "bank", openingBalance: 0, archived: false },
];

function event(partial: CashEvent): CashEvent {
  return partial;
}

test("cash after is stored for income, own expense, and transfer", () => {
  const stamps = replayCashLedger(places, [
    event({
      id: "in",
      kind: "income",
      date: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      amount: 50_00,
      placeId: "own",
    }),
    event({
      id: "out",
      kind: "expense",
      date: "2026-01-02",
      createdAt: "2026-01-02T00:00:00.000Z",
      amount: 20_00,
      placeId: "own",
      funding: "OWN",
    }),
    event({
      id: "move",
      kind: "transfer",
      date: "2026-01-03",
      createdAt: "2026-01-03T00:00:00.000Z",
      amount: 30_00,
      placeId: null,
      fromPlaceId: "own",
      toPlaceId: "bank",
    }),
  ]);

  assert.equal(stamps[0]?.placeBalanceAfter, 150_00);
  assert.equal(stamps[0]?.householdCashAfter, 150_00);
  assert.equal(stamps[1]?.placeBalanceAfter, 130_00);
  assert.equal(stamps[1]?.householdCashAfter, 130_00);
  assert.equal(stamps[2]?.fromPlaceBalanceAfter, 100_00);
  assert.equal(stamps[2]?.toPlaceBalanceAfter, 30_00);
  assert.equal(stamps[2]?.householdCashAfter, 130_00);
});

test("deleting a middle cash move rewrites the later totals", () => {
  const events: CashEvent[] = [
    event({
      id: "in",
      kind: "income",
      date: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      amount: 50_00,
      placeId: "own",
    }),
    event({
      id: "out",
      kind: "expense",
      date: "2026-01-02",
      createdAt: "2026-01-02T00:00:00.000Z",
      amount: 20_00,
      placeId: "own",
      funding: "OWN",
    }),
    event({
      id: "later",
      kind: "income",
      date: "2026-01-04",
      createdAt: "2026-01-04T00:00:00.000Z",
      amount: 10_00,
      placeId: "own",
    }),
  ];
  const full = replayCashLedger(places, events);
  const withoutMiddle = replayCashLedger(
    places,
    events.filter((row) => row.id !== "out")
  );
  assert.equal(full[2]?.householdCashAfter, 140_00);
  assert.equal(withoutMiddle[1]?.householdCashAfter, 160_00);
  assert.equal(withoutMiddle[1]?.id, "later");
});

test("card spend does not change household cash", () => {
  const stamps = replayCashLedger(places, [
    event({
      id: "card",
      kind: "expense",
      date: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      amount: 40_00,
      placeId: null,
      funding: "CARD",
    }),
  ]);
  assert.equal(stamps[0]?.householdCashAfter, 100_00);
  assert.equal(stamps[0]?.placeBalanceAfter, null);
});
