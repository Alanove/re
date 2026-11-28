import assert from "node:assert/strict";
import test from "node:test";
import { convertMinor, parseRate, roundMinorToWholeMajor } from "./fx.js";

test("parseRate rejects invalid rates", () => {
  assert.throws(() => parseRate("0"));
  assert.throws(() => parseRate("-1"));
  assert.equal(parseRate("89500"), 89500);
});

test("convert LBP minor to USD minor at 89500", () => {
  const rates = [{ fromCurrency: "LBP", toCurrency: "USD", rate: "89500" }];
  // 376,287,643.00 LBP → minor
  const netLbp = 376_287_643_00;
  const usd = convertMinor(netLbp, "LBP", "USD", rates);
  assert.equal(usd, 420_433);
});

test("round FX books to whole major (bank credit)", () => {
  const rates = [{ fromCurrency: "LBP", toCurrency: "USD", rate: "89500" }];
  const usd = convertMinor(376_287_643_00, "LBP", "USD", rates);
  assert.equal(roundMinorToWholeMajor(usd), 420_400);
});

test("same currency is identity", () => {
  assert.equal(convertMinor(12_345, "USD", "USD", []), 12_345);
});

test("inverse rate USD to LBP", () => {
  const rates = [{ fromCurrency: "LBP", toCurrency: "USD", rate: "89500" }];
  const lbp = convertMinor(100_00, "USD", "LBP", rates);
  assert.equal(lbp, 89500 * 100_00);
});
