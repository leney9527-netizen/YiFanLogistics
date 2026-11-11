import Decimal from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const MONEY_SCALE = 2;

export function decimal(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

export function roundMoney(value: Decimal): Decimal {
  return value.toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

export function moneyString(value: Decimal): string {
  return roundMoney(value).toFixed(MONEY_SCALE);
}

export function isMoneyString(value: string): boolean {
  return /^(?:0|[1-9]\d*)\.\d{2}$/.test(value);
}
