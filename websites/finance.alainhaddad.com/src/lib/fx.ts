/**
 * FX helpers. Rate means: `rate` units of `fromCurrency` = 1 unit of `toCurrency`
 * (e.g. 89500 LBP = 1 USD). Amounts are integer minor units (2 decimal places).
 */

export type FxQuote = {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
};

export function parseRate(rate: string): number {
  const value = Number(String(rate).replace(/,/g, "").trim());
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid FX rate");
  }
  return value;
}

/** Convert minor units from → to using rate (from per 1 to). */
export function convertMinor(
  amountMinor: number | bigint,
  fromCurrency: string,
  toCurrency: string,
  rates: FxQuote[]
): number {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) {
    return Number(amountMinor);
  }

  const direct = rates.find(
    (row) => row.fromCurrency.toUpperCase() === from && row.toCurrency.toUpperCase() === to
  );
  if (direct) {
    const rate = parseRate(direct.rate);
    const major = Number(amountMinor) / 100;
    return Math.round((major / rate) * 100);
  }

  const inverse = rates.find(
    (row) => row.fromCurrency.toUpperCase() === to && row.toCurrency.toUpperCase() === from
  );
  if (inverse) {
    const rate = parseRate(inverse.rate);
    const major = Number(amountMinor) / 100;
    return Math.round(major * rate * 100);
  }

  throw new Error(`No FX rate for ${from} → ${to}`);
}

/** Round minor units to the nearest whole major unit (e.g. bank whole-dollar credit). */
export function roundMinorToWholeMajor(amountMinor: number | bigint): number {
  return Math.round(Number(amountMinor) / 100) * 100;
}

export function formatMajorFromMinor(amountMinor: number | bigint, maxFractionDigits = 2): string {
  const major = Number(amountMinor) / 100;
  return major.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}
