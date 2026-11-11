import "server-only";
import {
  calculateQuote,
  isRateVisible,
  quoteNeedsRevalidation,
  sortRates,
  type CalcLine,
  type Calculation,
  type ChargeRule,
} from "@/lib/calc/quote";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import type { Locale, Localized, ServiceType } from "@/lib/types";
import { todayIso } from "@/lib/validation";
import type { Actor } from "@/lib/server/session";
import { customerPrices as mapPrices } from "@/lib/rates-map";

export type PortRecord = {
  id: string;
  code: string;
  name: Localized;
  timezone: string;
  kind: string;
};

export type ContainerRecord = {
  id: string;
  code: string;
  name: Localized;
};

export type RateCard = {
  id: string;
  carrierName: string;
  carrierCode: string;
  serviceType: ServiceType;
  transshipmentNote: Localized;
  transitDaysMin: number | null;
  transitDaysMax: number | null;
  transitIsConfirmed: boolean;
  cutoffAt: string | null;
  cutoffIsConfirmed: boolean;
  etdAt: string | null;
  etdIsConfirmed: boolean;
  validFrom: string;
  validTo: string;
  currency: string;
  prices: Record<string, string | null>;
  selectedCode: string;
  selectedSellAmount: string | null;
  origin: PortRecord;
  destination: PortRecord;
  visibility: "public" | "demo";
  notes: Localized;
};

type PriceRow = { sell_amount: string | number | null; container_types: { code: string } | { code: string }[] | null };

function customerPrices(rows: PriceRow[]): Record<string, string | null> {
  return mapPrices(
    rows.flatMap((row) => {
      const container = Array.isArray(row.container_types) ? row.container_types[0] : row.container_types;
      if (!container?.code) return [];
      return [{ code: container.code, sell_amount: row.sell_amount }];
    }),
  );
}

function localized(row: { name_zh: string; name_en: string; name_fr: string }): Localized {
  return { zh: row.name_zh, en: row.name_en, fr: row.name_fr };
}

function textTrio(row: { notes_zh?: string | null; notes_en?: string | null; notes_fr?: string | null }, prefix: "notes" | "transshipment_note"): Localized {
  const source = row as Record<string, string | null | undefined>;
  return {
    zh: source[`${prefix}_zh`] ?? "",
    en: source[`${prefix}_en`] ?? "",
    fr: source[`${prefix}_fr`] ?? "",
  };
}

export async function loadSearchOptions() {
  const admin = createAdminClient();
  if (!admin) return null;
  const [ports, containers, settings] = await Promise.all([
    admin.from("ports").select("id, code, name_zh, name_en, name_fr, timezone, kind, sort_order").eq("is_active", true).order("sort_order"),
    admin.from("container_types").select("id, code, name_zh, name_en, name_fr, sort_order").eq("is_active", true).order("sort_order"),
    admin.from("site_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (ports.error || containers.error || settings.error || !settings.data) return null;
  return {
    ports: (ports.data ?? []).map((port) => ({
      id: port.id as string,
      code: port.code as string,
      name: localized(port as { name_zh: string; name_en: string; name_fr: string }),
      timezone: port.timezone as string,
      kind: port.kind as string,
    })),
    containers: (containers.data ?? []).map((item) => ({
      id: item.id as string,
      code: item.code as string,
      name: localized(item as { name_zh: string; name_en: string; name_fr: string }),
    })),
    requireLogin: Boolean(settings.data.require_login_for_prices),
    referenceCurrency: settings.data.reference_currency as string,
    settings: settings.data,
  };
}

export async function searchPublicRates(input: {
  originCode: string;
  destinationCode: string;
  containerCode: string;
  readyDate: string;
  sort: "price" | "transit";
  actor: Actor | null;
}): Promise<{ ok: true; cards: RateCard[]; demo: boolean } | { ok: false; error: "unavailable" | "login_required" | "invalid_input" }> {
  const admin = createAdminClient();
  const env = getServerEnv();
  const options = await loadSearchOptions();
  if (!admin || !env || !options) return { ok: false, error: "unavailable" };
  if (options.requireLogin && !input.actor) return { ok: false, error: "login_required" };
  const origin = options.ports.find((port) => port.code === input.originCode && (port.kind === "origin" || port.kind === "both"));
  const destination = options.ports.find((port) => port.code === input.destinationCode && (port.kind === "destination" || port.kind === "both"));
  const container = options.containers.find((item) => item.code === input.containerCode);
  if (!origin || !destination || !container) return { ok: false, error: "invalid_input" };

  const { data: routes, error: routeError } = await admin
    .from("routes")
    .select("id")
    .eq("origin_port_id", origin.id)
    .eq("destination_port_id", destination.id)
    .eq("is_active", true);
  if (routeError) return { ok: false, error: "unavailable" };
  const routeIds = (routes ?? []).map((route) => route.id as string);
  if (routeIds.length === 0) return { ok: true, cards: [], demo: env.showDemo };

  let query = admin
    .from("freight_rate_versions")
    .select("id, carrier_id, route_id, service_type, transshipment_note_zh, transshipment_note_en, transshipment_note_fr, transit_days_min, transit_days_max, transit_is_confirmed, cutoff_at, cutoff_is_confirmed, etd_at, etd_is_confirmed, valid_from, valid_to, currency, status, visibility, notes_zh, notes_en, notes_fr")
    .eq("status", "published")
    .in("route_id", routeIds)
    .lte("valid_from", input.readyDate)
    .gte("valid_to", input.readyDate);
  if (!env.showDemo) query = query.eq("visibility", "public");
  const { data: versions, error } = await query;
  if (error) return { ok: false, error: "unavailable" };
  const today = todayIso();
  const visible = (versions ?? []).filter((version) =>
    isRateVisible(
      {
        status: version.status,
        visibility: version.visibility,
        validFrom: version.valid_from,
        validTo: version.valid_to,
      },
      input.readyDate,
      today,
      env.showDemo,
    ),
  );
  if (visible.length === 0) return { ok: true, cards: [], demo: env.showDemo };

  const ids = visible.map((version) => version.id as string);
  const carrierIds = [...new Set(visible.map((version) => version.carrier_id as string))];
  const [priceResult, carrierResult] = await Promise.all([
    admin.from("freight_rate_prices").select("rate_version_id, sell_amount, container_types(code)").in("rate_version_id", ids),
    admin.from("carriers").select("id, code, name, visibility").in("id", carrierIds),
  ]);
  if (priceResult.error || carrierResult.error) return { ok: false, error: "unavailable" };

  const cards: RateCard[] = visible.flatMap((version) => {
    const carrier = (carrierResult.data ?? []).find((item) => item.id === version.carrier_id);
    if (!carrier) return [];
    if (carrier.visibility === "demo" && !env.showDemo) return [];
    const prices = customerPrices(
      (priceResult.data ?? [])
        .filter((row) => row.rate_version_id === version.id)
        .map((row) => ({ sell_amount: row.sell_amount, container_types: row.container_types as PriceRow["container_types"] })),
    );
    return [{
      id: version.id as string,
      carrierName: carrier.name as string,
      carrierCode: carrier.code as string,
      serviceType: version.service_type as ServiceType,
      transshipmentNote: textTrio(version, "transshipment_note"),
      transitDaysMin: version.transit_days_min,
      transitDaysMax: version.transit_days_max,
      transitIsConfirmed: version.transit_is_confirmed,
      cutoffAt: version.cutoff_at,
      cutoffIsConfirmed: version.cutoff_is_confirmed,
      etdAt: version.etd_at,
      etdIsConfirmed: version.etd_is_confirmed,
      validFrom: version.valid_from,
      validTo: version.valid_to,
      currency: version.currency,
      prices,
      selectedCode: container.code,
      selectedSellAmount: prices[container.code] ?? null,
      origin,
      destination,
      visibility: version.visibility,
      notes: textTrio(version, "notes"),
    }];
  });

  return { ok: true, cards: sortRates(cards, input.sort), demo: env.showDemo };
}

async function loadRules(readyDate: string, showDemo: boolean): Promise<ChargeRule[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  let query = admin
    .from("charge_rules")
    .select("id, pricing_mode, amount, currency, billing_unit, distance_basis, times_multiplier, origin_port_id, destination_port_id, route_id, carrier_id, container_type_id, cargo_type, included_in_item_id, valid_from, valid_to, status, business_confirmed, visibility, charge_items!charge_rules_charge_item_id_fkey(code, name_zh, name_en, name_fr)")
    .eq("status", "published")
    .lte("valid_from", readyDate)
    .gte("valid_to", readyDate);
  if (!showDemo) query = query.eq("visibility", "public");
  const { data, error } = await query;
  if (error || !data) return [];
  const includedIds = [...new Set(data.map((row) => row.included_in_item_id).filter(Boolean))] as string[];
  const included = new Map<string, string>();
  if (includedIds.length) {
    const lookup = await admin.from("charge_items").select("id, code").in("id", includedIds);
    for (const item of lookup.data ?? []) included.set(item.id, item.code);
  }
  return data.flatMap((row) => {
    const item = Array.isArray(row.charge_items) ? row.charge_items[0] : row.charge_items;
    if (!item) return [];
    return [{
      id: row.id,
      chargeCode: item.code,
      name: localized(item),
      pricingMode: row.pricing_mode,
      amount: row.amount == null ? null : String(row.amount),
      currency: row.currency,
      billingUnit: row.billing_unit,
      distanceBasis: row.distance_basis,
      timesMultiplier: row.times_multiplier == null ? null : String(row.times_multiplier),
      originPortId: row.origin_port_id,
      destinationPortId: row.destination_port_id,
      routeId: row.route_id,
      carrierId: row.carrier_id,
      containerTypeId: row.container_type_id,
      cargoType: row.cargo_type,
      includedInCode: row.included_in_item_id ? included.get(row.included_in_item_id) ?? null : null,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      status: row.status,
      businessConfirmed: row.business_confirmed,
      visibility: row.visibility,
    } satisfies ChargeRule];
  });
}

export async function quoteCalculation(input: {
  rateId: string;
  containerCode: string;
  quantity: number;
  readyDate: string;
  distanceKm: number | null;
  truckCount: number | null;
  actor: Actor | null;
}): Promise<{ ok: true; card: RateCard; calculation: Calculation; containerId: string } | { ok: false; error: "unavailable" | "login_required" | "not_found" }> {
  const admin = createAdminClient();
  const env = getServerEnv();
  const options = await loadSearchOptions();
  if (!admin || !env || !options) return { ok: false, error: "unavailable" };
  if (options.requireLogin && !input.actor) return { ok: false, error: "login_required" };
  const container = options.containers.find((item) => item.code === input.containerCode);
  if (!container) return { ok: false, error: "not_found" };

  const { data: version } = await admin
    .from("freight_rate_versions")
    .select("id, carrier_id, route_id, service_type, transshipment_note_zh, transshipment_note_en, transshipment_note_fr, transit_days_min, transit_days_max, transit_is_confirmed, cutoff_at, cutoff_is_confirmed, etd_at, etd_is_confirmed, valid_from, valid_to, currency, status, visibility, notes_zh, notes_en, notes_fr")
    .eq("id", input.rateId)
    .maybeSingle();
  if (!version) return { ok: false, error: "not_found" };
  const today = todayIso();
  if (!isRateVisible({
    status: version.status,
    validFrom: version.valid_from,
    validTo: version.valid_to,
    visibility: version.visibility,
  }, input.readyDate, today, env.showDemo)) return { ok: false, error: "not_found" };

  const { data: route } = await admin.from("routes").select("id, origin_port_id, destination_port_id").eq("id", version.route_id).maybeSingle();
  const { data: carrier } = await admin.from("carriers").select("id, code, name, visibility").eq("id", version.carrier_id).maybeSingle();
  const { data: priceRows } = await admin.from("freight_rate_prices").select("sell_amount, container_types(code)").eq("rate_version_id", version.id);
  if (!route || !carrier) return { ok: false, error: "not_found" };
  const origin = options.ports.find((port) => port.id === route.origin_port_id);
  const destination = options.ports.find((port) => port.id === route.destination_port_id);
  if (!origin || !destination) return { ok: false, error: "not_found" };
  const prices = customerPrices((priceRows ?? []) as PriceRow[]);
  const card: RateCard = {
    id: version.id,
    carrierName: carrier.name,
    carrierCode: carrier.code,
    serviceType: version.service_type,
    transshipmentNote: textTrio(version, "transshipment_note"),
    transitDaysMin: version.transit_days_min,
    transitDaysMax: version.transit_days_max,
    transitIsConfirmed: version.transit_is_confirmed,
    cutoffAt: version.cutoff_at,
    cutoffIsConfirmed: version.cutoff_is_confirmed,
    etdAt: version.etd_at,
    etdIsConfirmed: version.etd_is_confirmed,
    validFrom: version.valid_from,
    validTo: version.valid_to,
    currency: version.currency,
    prices,
    selectedCode: container.code,
    selectedSellAmount: prices[container.code] ?? null,
    origin,
    destination,
    visibility: version.visibility,
    notes: textTrio(version, "notes"),
  };
  const { data: catalogRows } = await admin.from("charge_items").select("code, name_zh, name_en, name_fr, sort_order").eq("is_active", true).order("sort_order");
  const rules = await loadRules(input.readyDate, env.showDemo);
  const calculation = calculateQuote({
    quantity: input.quantity,
    distanceKm: input.distanceKm,
    truckCount: input.truckCount,
    readyDate: input.readyDate,
    today,
    showDemo: env.showDemo,
    cargoType: "general",
    originPortId: origin.id,
    destinationPortId: destination.id,
    routeId: route.id,
    carrierId: carrier.id,
    containerTypeId: container.id,
    oceanCurrency: version.currency,
    oceanUnitAmount: prices[container.code] ?? null,
    oceanName: { zh: "海运费", en: "Ocean freight", fr: "Fret maritime" },
    rules,
    catalog: (catalogRows ?? []).map((item) => ({ code: item.code, name: localized(item) })),
    fxRates: await latestFx(),
    referenceCurrency: options.referenceCurrency,
  });
  return { ok: true, card, calculation, containerId: container.id };
}

async function latestFx() {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("exchange_rates").select("base_currency, quote_currency, rate, source, effective_at").lte("effective_at", new Date().toISOString()).order("effective_at", { ascending: false });
  const seen = new Set<string>();
  const rates = [];
  for (const row of data ?? []) {
    const key = `${row.base_currency}:${row.quote_currency}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rates.push({
      base: row.base_currency as string,
      quote: row.quote_currency as string,
      rate: String(row.rate),
      source: row.source as string,
      effectiveAt: row.effective_at as string,
    });
  }
  return rates;
}

export type QuoteSnapshot = {
  version: 1;
  generatedAt: string;
  locale: Locale;
  quoteNumber: string;
  customer: { id: string; email: string; displayName: string | null; companyName: string | null };
  card: RateCard;
  quantity: number;
  readyDate: string;
  distanceKm: number | null;
  truckCount: number | null;
  calculation: Calculation;
  terms: Localized;
  contact: Record<string, string>;
};

export async function saveQuote(input: {
  actor: Actor;
  rateId: string;
  containerCode: string;
  quantity: number;
  readyDate: string;
  distanceKm: number | null;
  truckCount: number | null;
  locale: Locale;
}): Promise<{ ok: true; id: string; number: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unavailable" };
  const priced = await quoteCalculation({ ...input, actor: input.actor });
  if (!priced.ok) return priced;
  const { data: number, error: numberError } = await admin.rpc("allocate_number", { p_prefix: "YFQ" });
  if (numberError || typeof number !== "string") return { ok: false, error: "unavailable" };
  const settings = (await loadSearchOptions())?.settings;
  const terms = await termsSnapshot();
  const snapshot: QuoteSnapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    locale: input.locale,
    quoteNumber: number,
    customer: {
      id: input.actor.id,
      email: input.actor.email,
      displayName: input.actor.displayName,
      companyName: input.actor.companyName,
    },
    card: priced.card,
    quantity: input.quantity,
    readyDate: input.readyDate,
    distanceKm: input.distanceKm,
    truckCount: input.truckCount,
    calculation: priced.calculation,
    terms,
    contact: {
      phone: settings?.phone ?? "",
      email: settings?.email ?? "",
      whatsapp: settings?.whatsapp ?? "",
      company: settings?.[`company_name_${input.locale}`] ?? "",
    },
  };
  const { data, error } = await admin.from("quotes").insert({
    quote_number: number,
    user_id: input.actor.id,
    locale: input.locale,
    rate_version_id: priced.card.id,
    snapshot,
  }).select("id").single();
  if (error || !data) return { ok: false, error: "unavailable" };
  return { ok: true, id: data.id, number };
}

async function termsSnapshot(): Promise<Localized> {
  const admin = createAdminClient();
  if (!admin) return { zh: "", en: "", fr: "" };
  const { data } = await admin.from("page_blocks").select("title_zh, title_en, title_fr, body_zh, body_en, body_fr, sort_order").eq("page_key", "terms").eq("is_published", true).order("sort_order");
  if (!data?.length) {
    const { defaultTerms } = await import("@/content/defaults");
    return {
      zh: defaultTerms.map((item) => `${item.title.zh}\n${item.body.zh}`).join("\n\n"),
      en: defaultTerms.map((item) => `${item.title.en}\n${item.body.en}`).join("\n\n"),
      fr: defaultTerms.map((item) => `${item.title.fr}\n${item.body.fr}`).join("\n\n"),
    };
  }
  return {
    zh: data.map((item) => `${item.title_zh}\n${item.body_zh}`).join("\n\n"),
    en: data.map((item) => `${item.title_en}\n${item.body_en}`).join("\n\n"),
    fr: data.map((item) => `${item.title_fr}\n${item.body_fr}`).join("\n\n"),
  };
}

export async function listQuotes(actor: Actor) {
  const admin = createAdminClient();
  if (!admin) return [];
  let query = admin.from("quotes").select("id, quote_number, created_at, snapshot, rate_version_id, user_id").order("created_at", { ascending: false });
  if (actor.role === "customer") query = query.eq("user_id", actor.id);
  const { data } = await query.limit(100);
  return data ?? [];
}

export async function readQuote(actor: Actor, id: string) {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("quotes").select("id, quote_number, user_id, snapshot, rate_version_id, created_at").eq("id", id).maybeSingle();
  if (!data) return null;
  if (actor.role === "customer" && data.user_id !== actor.id) return null;
  const { data: live } = await admin.from("freight_rate_versions").select("id, status, valid_to").eq("id", data.rate_version_id).maybeSingle();
  const snapshot = data.snapshot as QuoteSnapshot;
  return {
    ...data,
    snapshot,
    needsRevalidation: quoteNeedsRevalidation(
      { rateVersionId: snapshot.card.id, validTo: snapshot.card.validTo },
      live ? { id: live.id, status: live.status, validTo: live.valid_to } : null,
      todayIso(),
    ),
  };
}

export function lineAmount(line: CalcLine): string | null {
  return line.status === "priced" ? line.amount : null;
}
