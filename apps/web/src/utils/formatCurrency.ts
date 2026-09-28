const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdPrecise = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

export function formatCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return usd.format(cents / 100);
}

export function formatCurrencyExact(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return usdPrecise.format(cents / 100);
}
