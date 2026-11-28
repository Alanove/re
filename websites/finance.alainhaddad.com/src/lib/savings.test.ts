import assert from "node:assert/strict";
import test from "node:test";
import {
  TROY_OZ_GRAMS,
  gramsToMg,
  mgToGrams,
  mgToTroyOz,
  pricePerGramToPerOz,
  pricePerOzToPerGram,
  projectSavingsGrowth,
  troyOzToMg,
} from "./savings.js";

test("1 troy oz rounds to milligrams and back", () => {
  const mg = troyOzToMg(1);
  assert.equal(mg, BigInt(Math.round(TROY_OZ_GRAMS * 1000)));
  const oz = mgToTroyOz(mg);
  assert.ok(Math.abs(oz - 1) < 0.0001);
});

test("6 troy oz round-trips cleanly in display", () => {
  const mg = troyOzToMg(6);
  assert.equal(mgToTroyOz(mg), 6);
});

test("grams ↔ mg", () => {
  assert.equal(gramsToMg(12.5), 12500n);
  assert.equal(mgToGrams(12500n), 12.5);
});

test("price per oz ↔ per gram (books minor)", () => {
  const perOz = 2_450_00; // $2450.00 / oz
  const perGram = pricePerOzToPerGram(perOz);
  assert.equal(perGram, Math.round(perOz / TROY_OZ_GRAMS));
  const back = pricePerGramToPerOz(perGram);
  // Integer minor-unit rounding can drift by up to ~½ troy-oz gram factor.
  assert.ok(Math.abs(back - perOz) <= Math.ceil(TROY_OZ_GRAMS / 2));
});

test("projectSavingsGrowth compounds monthly with contributions", () => {
  // 0% growth: start 1000 + 12 months × 100 = 2200
  assert.equal(
    projectSavingsGrowth({
      startMinor: 1000_00,
      monthlyContributionMinor: 100_00,
      years: 1,
      annualRate: 0,
    }),
    2200_00
  );

  const grown = projectSavingsGrowth({
    startMinor: 10_000_00,
    monthlyContributionMinor: 500_00,
    years: 4,
    annualRate: 0.05,
  });
  assert.ok(grown > 10_000_00 + 500_00 * 48);
});
