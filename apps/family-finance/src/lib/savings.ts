export type SavingsTxnLike = { amount: number };

/** Troy ounce in grams (precious-metals standard). */
export const TROY_OZ_GRAMS = 31.1034768;

export type MetalWeightUnit = "g" | "oz";

export function potBalance(txns: SavingsTxnLike[]): number {
  return txns.reduce((sum, txn) => sum + txn.amount, 0);
}

/** Metal value in books minor units: quantityMg/1000 grams × price per gram. */
export function metalValueBooks(quantityMg: bigint | number, unitPricePerGram: number): number {
  const mg = Number(quantityMg);
  const grams = mg / 1000;
  return Math.round(grams * unitPricePerGram);
}

export function gramsToMg(grams: number): bigint {
  return BigInt(Math.round(grams * 1000));
}

export function mgToGrams(quantityMg: bigint | number): number {
  return Number(quantityMg) / 1000;
}

/** Round troy oz for display/input so mg round-trip does not show 6.000004. */
export function roundTroyOz(ounces: number, decimals = 4): number {
  if (!Number.isFinite(ounces)) return 0;
  const factor = 10 ** decimals;
  return Math.round(ounces * factor) / factor;
}

export function formatTroyOzInput(ounces: number): string {
  const rounded = roundTroyOz(ounces);
  return String(rounded);
}

export function mgToTroyOz(quantityMg: bigint | number): number {
  return roundTroyOz(mgToGrams(quantityMg) / TROY_OZ_GRAMS);
}

export function troyOzToMg(ounces: number): bigint {
  return gramsToMg(ounces * TROY_OZ_GRAMS);
}

/** Convert books-minor price per troy oz → per gram. */
export function pricePerOzToPerGram(pricePerOzMinor: number): number {
  return Math.round(pricePerOzMinor / TROY_OZ_GRAMS);
}

/** Convert books-minor price per gram → per troy oz. */
export function pricePerGramToPerOz(pricePerGramMinor: number): number {
  return Math.round(pricePerGramMinor * TROY_OZ_GRAMS);
}

export function formatMetalWeight(quantityMg: bigint | number): string {
  const grams = mgToGrams(quantityMg);
  const oz = mgToTroyOz(quantityMg);
  const gLabel = grams.toLocaleString("en-US", { maximumFractionDigits: 3 });
  const ozLabel = oz.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return `${gLabel} g · ${ozLabel} oz`;
}

/**
 * Project savings forward with monthly compounding and a fixed monthly contribution.
 * Rates are annual decimals (0.05 = 5%). Amounts are books minor units.
 */
export function projectSavingsGrowth(input: {
  startMinor: number;
  monthlyContributionMinor: number;
  years: number;
  annualRate: number;
}): number {
  const months = Math.max(0, Math.round(input.years * 12));
  const monthlyRate = input.annualRate / 12;
  let balance = Math.max(0, input.startMinor);
  for (let i = 0; i < months; i += 1) {
    balance = Math.round(balance * (1 + monthlyRate)) + Math.max(0, input.monthlyContributionMinor);
  }
  return balance;
}
