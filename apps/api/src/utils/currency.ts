/** Money is integer cents end to end; floats only appear at the formatting boundary. */

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsd(cents: number): string {
  return usdFormatter.format(cents / 100);
}

export function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}
