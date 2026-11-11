export function customerPrices(
  rows: { sell_amount: string | number | null; cost_amount?: string | number | null; code: string }[],
): Record<string, string | null> {
  const prices: Record<string, string | null> = {};
  for (const row of rows) {
    prices[row.code] = row.sell_amount == null ? null : Number(row.sell_amount).toFixed(2);
  }
  return prices;
}

export function hasCostKey(value: Record<string, string | null>): boolean {
  return Object.keys(value).some((key) => key.toLowerCase().includes("cost"));
}
