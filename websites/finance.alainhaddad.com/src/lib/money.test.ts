import assert from "node:assert/strict";
import test from "node:test";
import {
  computeHeadline,
  computeLeft,
  computeOwed,
  forecastAdvice,
  isShort,
  monthsUntil,
  toMinorUnits,
} from "./money.js";

test("Left counts income and own-pocket outflows only", () => {
  const left = computeLeft({
    incomes: [{ amount: 10000 }],
    expenses: [
      { amount: 2000, funding: "OWN", isCardPayoff: false, isLoanPayment: false },
      { amount: 1500, funding: "CARD", isCardPayoff: false, isLoanPayment: false },
      { amount: 500, funding: "BORROWED", isCardPayoff: false, isLoanPayment: false },
      { amount: 3000, funding: "OWN", isCardPayoff: false, isLoanPayment: true },
      { amount: 1500, funding: "OWN", isCardPayoff: true, isLoanPayment: false },
    ],
  });
  // 10000 - 2000 - 3000 - 1500 = 3500; card swipe and borrowed spend do not reduce Left
  assert.equal(left, 3500);
});

test("Owed is open card cycles plus unpaid debt", () => {
  const owed = computeOwed([{ total: 1500 }], [
    { amount: 2000, repaid: 500 },
    { amount: 1000, repaid: 1000 },
  ]);
  assert.equal(owed, 3000);
});

test("headline is Left minus Owed and short when owed or negative left", () => {
  assert.equal(computeHeadline(4000, 1500), 2500);
  assert.equal(isShort(4000, 1500), true);
  assert.equal(isShort(-100, 0), true);
  assert.equal(isShort(4000, 0), false);
});

test("card payoff lowers Left once; swipe does not", () => {
  const beforePayoff = computeLeft({
    incomes: [{ amount: 10000 }],
    expenses: [
      { amount: 2000, funding: "CARD", isCardPayoff: false, isLoanPayment: false },
    ],
  });
  assert.equal(beforePayoff, 10000);

  const afterPayoff = computeLeft({
    incomes: [{ amount: 10000 }],
    expenses: [
      { amount: 2000, funding: "CARD", isCardPayoff: false, isLoanPayment: false },
      { amount: 2000, funding: "OWN", isCardPayoff: true, isLoanPayment: false },
    ],
  });
  assert.equal(afterPayoff, 8000);

  const owedAfterPayoff = computeOwed([], []);
  assert.equal(computeHeadline(afterPayoff, owedAfterPayoff), 8000);
});

test("borrowed cash raises Left via income; repay lowers Left via OWN expense and reduces Owed", () => {
  const afterBorrow = computeLeft({
    incomes: [{ amount: 5000 }, { amount: 1275_00 }],
    expenses: [],
  });
  const owedOpen = computeOwed([], [{ amount: 1300_00, repaid: 0 }]);
  assert.equal(afterBorrow, 5000 + 1275_00);
  assert.equal(computeHeadline(afterBorrow, owedOpen), 5000 + 1275_00 - 1300_00);
  assert.equal(isShort(afterBorrow, owedOpen), true);

  const afterRepay = computeLeft({
    incomes: [{ amount: 5000 }, { amount: 1275_00 }],
    expenses: [{ amount: 500_00, funding: "OWN", isCardPayoff: false, isLoanPayment: false }],
  });
  const owedPartial = computeOwed([], [{ amount: 1300_00, repaid: 500_00 }]);
  assert.equal(afterRepay, 5000 + 1275_00 - 500_00);
  assert.equal(owedPartial, 800_00);
  assert.equal(isShort(afterRepay, owedPartial), true);
});

test("forecast sentence uses set-aside and usual leftover", () => {
  const short = forecastAdvice({
    name: "Kid birthday",
    amount: 200_000,
    month: "2027-02",
    asOfMonth: "2027-02",
    recentLeft: [40_000, 40_000, 40_000],
  });
  // monthsLeft at least 1 when same month
  assert.equal(short.monthsLeft, 1);
  assert.equal(short.setAsidePerMonth, 200_000);
  assert.equal(short.fits, false);
  assert.match(short.sentence, /Set aside 2000 a month until Feb 2027/);
  assert.match(short.sentence, /You are 1600 short each month/);

  const ok = forecastAdvice({
    name: "Kid birthday",
    amount: 200_000,
    month: "2027-02",
    asOfMonth: "2026-02",
    recentLeft: [40_000, 40_000, 40_000],
  });
  assert.equal(ok.monthsLeft, 12);
  assert.equal(ok.setAsidePerMonth, 16_667);
  assert.equal(ok.usualLeftover, 40_000);
  assert.equal(ok.fits, true);
  assert.match(ok.sentence, /Set aside 167 a month until Feb 2027/);
  assert.match(ok.sentence, /You usually have 400 left after bills, so this fits/);
});

test("monthsUntil counts calendar months", () => {
  assert.equal(monthsUntil("2026-01", "2026-01"), 0);
  assert.equal(monthsUntil("2026-01", "2026-02"), 1);
  assert.equal(monthsUntil("2026-11", "2027-02"), 3);
});

test("toMinorUnits converts major units", () => {
  assert.equal(toMinorUnits(12.5), 1250);
  assert.equal(toMinorUnits("10"), 1000);
});
