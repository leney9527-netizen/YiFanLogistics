import { decimal, moneyString } from "@/lib/money";
import type { BillingUnit, CargoType, Locale, Localized, PricingMode } from "@/lib/types";

export type ChargeRule = {
  id: string;
  chargeCode: string;
  name: Localized;
  pricingMode: PricingMode;
  amount: string | null;
  currency: string | null;
  billingUnit: BillingUnit;
  distanceBasis: "one_way" | "round_trip" | null;
  timesMultiplier: string | null;
  originPortId: string | null;
  destinationPortId: string | null;
  routeId: string | null;
  carrierId: string | null;
  containerTypeId: string | null;
  cargoType: "any" | CargoType;
  includedInCode: string | null;
  validFrom: string;
  validTo: string;
  status: string;
  businessConfirmed: boolean;
  visibility: "public" | "demo";
};

export type CatalogItem = {
  code: string;
  name: Localized;
};

export type FxRate = {
  base: string;
  quote: string;
  rate: string;
  source: string;
  effectiveAt: string;
};

export type CalcContext = {
  quantity: number;
  distanceKm: number | null;
  truckCount: number | null;
  readyDate: string;
  today: string;
  showDemo: boolean;
  cargoType: CargoType;
  originPortId: string;
  destinationPortId: string;
  routeId: string;
  carrierId: string;
  containerTypeId: string;
  oceanCurrency: string;
  oceanUnitAmount: string | null;
  oceanName: Localized;
  rules: ChargeRule[];
  catalog: CatalogItem[];
  fxRates: FxRate[];
  referenceCurrency: string;
};

export type LineStatus = "priced" | "unconfirmed" | "included" | "not_offered";

export type CalcLine = {
  code: string;
  name: Localized;
  status: LineStatus;
  currency: string | null;
  amount: string | null;
  reason: string | null;
  billingUnit: BillingUnit | "per_container" | null;
  distanceBasis: "one_way" | "round_trip" | null;
  multiplier: string | null;
  includedInCode: string | null;
};

export type RateUsed = FxRate & { inverted: boolean };

export type Calculation = {
  lines: CalcLine[];
  subtotals: { currency: string; amount: string }[];
  hasUnconfirmed: boolean;
  totalKind: "known_subtotal" | "listed_total";
  reference: {
    currency: string;
    total: string | null;
    missingCurrencies: string[];
    ratesUsed: RateUsed[];
  };
};

export type PublicRate = {
  id: string;
  status: string;
  visibility: "public" | "demo";
  validFrom: string;
  validTo: string;
  selectedSellAmount: string | null;
  transitDaysMin: number | null;
};

export function isRateVisible(
  rate: Pick<PublicRate, "status" | "visibility" | "validFrom" | "validTo">,
  readyDate: string,
  today: string,
  showDemo: boolean,
): boolean {
  if (rate.status !== "published") return false;
  if (rate.visibility === "demo" && !showDemo) return false;
  if (rate.visibility !== "public" && rate.visibility !== "demo") return false;
  if (rate.validTo < today) return false;
  if (readyDate < rate.validFrom || readyDate > rate.validTo) return false;
  return true;
}

export function sortRates<T extends Pick<PublicRate, "selectedSellAmount" | "transitDaysMin">>(
  rates: T[],
  sort: "price" | "transit",
): T[] {
  return [...rates].sort((left, right) => {
    if (sort === "transit") {
      const leftDays = left.transitDaysMin ?? Number.POSITIVE_INFINITY;
      const rightDays = right.transitDaysMin ?? Number.POSITIVE_INFINITY;
      if (leftDays !== rightDays) return leftDays - rightDays;
    }
    const leftPrice = left.selectedSellAmount == null ? Number.POSITIVE_INFINITY : Number(left.selectedSellAmount);
    const rightPrice = right.selectedSellAmount == null ? Number.POSITIVE_INFINITY : Number(right.selectedSellAmount);
    if (leftPrice !== rightPrice) return leftPrice - rightPrice;
    return 0;
  });
}

export function quoteNeedsRevalidation(
  snapshot: { rateVersionId: string; validTo: string },
  live: { id: string; status: string; validTo: string } | null,
  today: string,
): boolean {
  if (!live) return true;
  if (live.id !== snapshot.rateVersionId) return true;
  if (live.status !== "published") return true;
  if (live.validTo < today) return true;
  if (live.validTo !== snapshot.validTo) return true;
  return false;
}

function specificity(rule: ChargeRule): number {
  return [
    rule.originPortId,
    rule.destinationPortId,
    rule.routeId,
    rule.carrierId,
    rule.containerTypeId,
    rule.cargoType === "any" ? null : rule.cargoType,
  ].filter(Boolean).length;
}

export function ruleMatches(rule: ChargeRule, ctx: CalcContext): boolean {
  if (rule.status !== "published") return false;
  if (rule.visibility === "demo" && !ctx.showDemo) return false;
  if (rule.validTo < ctx.today) return false;
  if (ctx.readyDate < rule.validFrom || ctx.readyDate > rule.validTo) return false;
  if (rule.originPortId && rule.originPortId !== ctx.originPortId) return false;
  if (rule.destinationPortId && rule.destinationPortId !== ctx.destinationPortId) return false;
  if (rule.routeId && rule.routeId !== ctx.routeId) return false;
  if (rule.carrierId && rule.carrierId !== ctx.carrierId) return false;
  if (rule.containerTypeId && rule.containerTypeId !== ctx.containerTypeId) return false;
  if (rule.cargoType !== "any" && rule.cargoType !== ctx.cargoType) return false;
  return true;
}

export function pickWinningRules(rules: ChargeRule[], ctx: CalcContext): ChargeRule[] {
  const winners = new Map<string, ChargeRule>();
  for (const rule of rules) {
    if (!ruleMatches(rule, ctx)) continue;
    const current = winners.get(rule.chargeCode);
    if (!current) {
      winners.set(rule.chargeCode, rule);
      continue;
    }
    const score = specificity(rule) - specificity(current);
    if (score > 0 || (score === 0 && rule.validFrom > current.validFrom)) {
      winners.set(rule.chargeCode, rule);
    }
  }
  return [...winners.values()];
}

function unconfirmed(rule: ChargeRule, reason: string): CalcLine {
  return {
    code: rule.chargeCode,
    name: rule.name,
    status: "unconfirmed",
    currency: null,
    amount: null,
    reason,
    billingUnit: rule.billingUnit,
    distanceBasis: rule.distanceBasis,
    multiplier: null,
    includedInCode: rule.includedInCode,
  };
}

function priceRule(rule: ChargeRule, ctx: CalcContext): CalcLine {
  if (rule.pricingMode === "manual") return unconfirmed(rule, "manual");
  if (rule.pricingMode === "included") {
    return {
      code: rule.chargeCode,
      name: rule.name,
      status: "included",
      currency: null,
      amount: null,
      reason: null,
      billingUnit: rule.billingUnit,
      distanceBasis: rule.distanceBasis,
      multiplier: null,
      includedInCode: rule.includedInCode,
    };
  }
  if (!rule.businessConfirmed || rule.amount == null || rule.currency == null) {
    return unconfirmed(rule, "not_confirmed");
  }

  const unit = decimal(rule.amount);
  if (unit.isNegative()) return unconfirmed(rule, "not_confirmed");

  let raw = unit;
  let multiplier = "1";
  if (rule.billingUnit === "per_container") {
    raw = unit.mul(ctx.quantity);
    multiplier = String(ctx.quantity);
  } else if (rule.billingUnit === "per_shipment") {
    raw = unit;
  } else if (rule.billingUnit === "per_truck") {
    if (ctx.truckCount == null) return unconfirmed(rule, "need_trucks");
    raw = unit.mul(ctx.truckCount);
    multiplier = String(ctx.truckCount);
  } else if (rule.billingUnit === "per_time") {
    if (rule.timesMultiplier == null) return unconfirmed(rule, "need_times");
    raw = unit.mul(rule.timesMultiplier);
    multiplier = rule.timesMultiplier;
  } else if (rule.billingUnit === "per_km") {
    if (ctx.distanceKm == null || rule.distanceBasis == null) return unconfirmed(rule, "need_distance");
    const factor = rule.distanceBasis === "round_trip" ? 2 : 1;
    raw = unit.mul(ctx.distanceKm).mul(factor);
    multiplier = String(ctx.distanceKm * factor);
  } else {
    return unconfirmed(rule, "bad_unit");
  }

  return {
    code: rule.chargeCode,
    name: rule.name,
    status: "priced",
    currency: rule.currency,
    amount: moneyString(raw),
    reason: null,
    billingUnit: rule.billingUnit,
    distanceBasis: rule.distanceBasis,
    multiplier,
    includedInCode: null,
  };
}

function convertAmount(amount: string, from: string, to: string, rates: FxRate[]): { amount: string; used: RateUsed } | null {
  if (from === to) {
    return {
      amount,
      used: { base: from, quote: to, rate: "1.00000000", source: "identity", effectiveAt: "", inverted: false },
    };
  }
  const direct = rates.find((rate) => rate.base === from && rate.quote === to);
  if (direct) {
    return { amount: moneyString(decimal(amount).mul(direct.rate)), used: { ...direct, inverted: false } };
  }
  const inverse = rates.find((rate) => rate.base === to && rate.quote === from);
  if (inverse) {
    return { amount: moneyString(decimal(amount).div(inverse.rate)), used: { ...inverse, inverted: true } };
  }
  return null;
}

export function calculateQuote(ctx: CalcContext): Calculation {
  const lines: CalcLine[] = [];
  if (ctx.oceanUnitAmount == null) {
    lines.push({
      code: "OCEAN",
      name: ctx.oceanName,
      status: "unconfirmed",
      currency: null,
      amount: null,
      reason: "no_ocean_rate",
      billingUnit: "per_container",
      distanceBasis: null,
      multiplier: String(ctx.quantity),
      includedInCode: null,
    });
  } else {
    lines.push({
      code: "OCEAN",
      name: ctx.oceanName,
      status: "priced",
      currency: ctx.oceanCurrency,
      amount: moneyString(decimal(ctx.oceanUnitAmount).mul(ctx.quantity)),
      reason: null,
      billingUnit: "per_container",
      distanceBasis: null,
      multiplier: String(ctx.quantity),
      includedInCode: null,
    });
  }

  const present = new Set(lines.map((line) => line.code));
  for (const rule of pickWinningRules(ctx.rules, ctx)) {
    let line = priceRule(rule, ctx);
    if (line.status === "included") {
      const parent = line.includedInCode ?? "OCEAN";
      if (!present.has(parent) && parent !== "OCEAN") {
        line = { ...line, status: "unconfirmed", reason: "included_parent_missing" };
      }
    }
    lines.push(line);
    present.add(line.code);
  }

  for (const item of ctx.catalog) {
    if (present.has(item.code)) continue;
    lines.push({
      code: item.code,
      name: item.name,
      status: "not_offered",
      currency: null,
      amount: null,
      reason: "not_configured",
      billingUnit: null,
      distanceBasis: null,
      multiplier: null,
      includedInCode: null,
    });
  }

  const subtotalMap = new Map<string, ReturnType<typeof decimal>>();
  for (const line of lines) {
    if (line.status !== "priced" || line.amount == null || line.currency == null) continue;
    const current = subtotalMap.get(line.currency) ?? decimal(0);
    subtotalMap.set(line.currency, current.plus(line.amount));
  }
  const subtotals = [...subtotalMap.entries()]
    .map(([currency, amount]) => ({ currency, amount: moneyString(amount) }))
    .sort((left, right) => left.currency.localeCompare(right.currency));

  const hasUnconfirmed = lines.some((line) => line.status === "unconfirmed" || line.status === "not_offered");
  const ratesUsed: RateUsed[] = [];
  const missing = new Set<string>();
  let referenceTotal = decimal(0);
  let referenceComplete = true;
  for (const subtotal of subtotals) {
    const converted = convertAmount(subtotal.amount, subtotal.currency, ctx.referenceCurrency, ctx.fxRates);
    if (!converted) {
      referenceComplete = false;
      missing.add(subtotal.currency);
      continue;
    }
    referenceTotal = referenceTotal.plus(converted.amount);
    if (converted.used.source !== "identity") ratesUsed.push(converted.used);
  }

  return {
    lines,
    subtotals,
    hasUnconfirmed,
    totalKind: hasUnconfirmed ? "known_subtotal" : "listed_total",
    reference: {
      currency: ctx.referenceCurrency,
      total: referenceComplete && subtotals.length > 0 ? moneyString(referenceTotal) : null,
      missingCurrencies: [...missing],
      ratesUsed,
    },
  };
}

const QUOTE_REQUEST_KEYS = [
  "rateVersionId",
  "containerTypeId",
  "quantity",
  "readyDate",
  "distanceKm",
  "truckCount",
  "locale",
] as const;

export function stripQuoteRequest(body: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const key of QUOTE_REQUEST_KEYS) {
    if (key in body) next[key] = body[key];
  }
  return next;
}
