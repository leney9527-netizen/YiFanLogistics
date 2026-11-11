import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import zh from "../../messages/zh.json";
import { calculateQuote, isRateVisible, quoteNeedsRevalidation, sortRates, stripQuoteRequest, type ChargeRule, type CalcContext } from "@/lib/calc/quote";
import { MemoryCaptchaStore, createCaptchaAnswer, hashCaptchaAnswer, sessionAllowed, verifyCaptcha } from "@/lib/captcha";
import { decimal, moneyString } from "@/lib/money";
import { normalizeEmail, safeNextPath, validatePassword } from "@/lib/validation";
import { validateImportRow } from "@/lib/import/rates";
import { customerPrices, hasCostKey } from "@/lib/rates-map";

const name = { zh: "费用", en: "Charge", fr: "Frais" };
const ocean = { zh: "海运费", en: "Ocean freight", fr: "Fret maritime" };

function rule(overrides: Partial<ChargeRule>): ChargeRule {
  return {
    id: "rule-1",
    chargeCode: "THC",
    name,
    pricingMode: "fixed",
    amount: "100.00",
    currency: "CNY",
    billingUnit: "per_container",
    distanceBasis: null,
    timesMultiplier: null,
    originPortId: null,
    destinationPortId: null,
    routeId: null,
    carrierId: null,
    containerTypeId: null,
    cargoType: "any",
    includedInCode: null,
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    status: "published",
    businessConfirmed: true,
    visibility: "public",
    ...overrides,
  };
}

function context(overrides: Partial<CalcContext> = {}): CalcContext {
  return {
    quantity: 2,
    distanceKm: null,
    truckCount: null,
    readyDate: "2026-11-20",
    today: "2026-11-04",
    showDemo: false,
    cargoType: "general",
    originPortId: "nansha",
    destinationPortId: "abidjan",
    routeId: "route-1",
    carrierId: "carrier-1",
    containerTypeId: "hq",
    oceanCurrency: "USD",
    oceanUnitAmount: "1800.00",
    oceanName: ocean,
    rules: [],
    catalog: [
      { code: "THC", name },
      { code: "TRUCK", name: { zh: "拖车费", en: "Trucking", fr: "Camionnage" } },
      { code: "DEST_CUSTOMS", name: { zh: "目的港清关", en: "Destination customs", fr: "Dédouanement" } },
    ],
    fxRates: [
      { base: "USD", quote: "CNY", rate: "7.20000000", source: "Test source", effectiveAt: "2026-11-01T00:00:00Z" },
    ],
    referenceCurrency: "USD",
    ...overrides,
  };
}

function leafKeys(value: unknown, prefix = ""): string[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

describe("translations", () => {
  it("keeps Chinese, English and French keys aligned", () => {
    const english = leafKeys(en).sort();
    expect(leafKeys(zh).sort()).toEqual(english);
    expect(leafKeys(fr).sort()).toEqual(english);
    expect(english.some((key) => key.endsWith("undefined"))).toBe(false);
  });
});

describe("money", () => {
  it("rounds half up to two decimal places", () => {
    expect(moneyString(decimal("10.005"))).toBe("10.01");
    expect(moneyString(decimal("10.004"))).toBe("10.00");
    expect(moneyString(decimal("1800.105").mul(2))).toBe("3600.21");
  });
});

describe("calculateQuote", () => {
  it("multiplies ocean freight and sums each currency", () => {
    const result = calculateQuote(context({
      rules: [rule({ amount: "500.00", currency: "CNY" })],
    }));
    const oceanLine = result.lines.find((line) => line.code === "OCEAN");
    const thc = result.lines.find((line) => line.code === "THC");
    expect(oceanLine).toMatchObject({ status: "priced", amount: "3600.00", currency: "USD" });
    expect(thc).toMatchObject({ status: "priced", amount: "1000.00", currency: "CNY" });
    expect(result.subtotals).toEqual([
      { currency: "CNY", amount: "1000.00" },
      { currency: "USD", amount: "3600.00" },
    ]);
    expect(result.totalKind).toBe("known_subtotal");
    expect(result.reference.total).toBe("3738.89");
    expect(result.reference.ratesUsed[0]).toMatchObject({ source: "Test source", inverted: true });
  });

  it("does not treat an unconfirmed charge as zero", () => {
    const result = calculateQuote(context({
      rules: [rule({ chargeCode: "TRUCK", pricingMode: "manual", amount: null, currency: null, billingUnit: "per_km", businessConfirmed: false })],
    }));
    const truck = result.lines.find((line) => line.code === "TRUCK");
    expect(truck?.status).toBe("unconfirmed");
    expect(truck?.amount).toBeNull();
    expect(result.subtotals).toEqual([{ currency: "USD", amount: "3600.00" }]);
    expect(result.totalKind).toBe("known_subtotal");
    expect(JSON.stringify(result)).not.toContain("全包");
  });

  it("prices trucking from the configured basis and leaves it open without a distance", () => {
    const priced = calculateQuote(context({
      distanceKm: 10,
      rules: [rule({
        chargeCode: "TRUCK",
        amount: "15.00",
        billingUnit: "per_km",
        distanceBasis: "one_way",
      })],
    }));
    expect(priced.lines.find((line) => line.code === "TRUCK")).toMatchObject({ amount: "150.00" });

    const roundTrip = calculateQuote(context({
      distanceKm: 10,
      rules: [rule({
        id: "rule-round",
        chargeCode: "TRUCK",
        amount: "15.00",
        billingUnit: "per_km",
        distanceBasis: "round_trip",
      })],
    }));
    expect(roundTrip.lines.find((line) => line.code === "TRUCK")).toMatchObject({ amount: "300.00" });

    const missing = calculateQuote(context({
      rules: [rule({
        chargeCode: "TRUCK",
        amount: "15.00",
        billingUnit: "per_km",
        distanceBasis: "one_way",
      })],
    }));
    expect(missing.lines.find((line) => line.code === "TRUCK")).toMatchObject({ status: "unconfirmed", amount: null });
  });

  it("does not add a charge that is included in ocean freight", () => {
    const result = calculateQuote(context({
      rules: [rule({ pricingMode: "included", amount: null, currency: null, includedInCode: "OCEAN", businessConfirmed: false })],
    }));
    expect(result.lines.find((line) => line.code === "THC")?.status).toBe("included");
    expect(result.subtotals).toEqual([{ currency: "USD", amount: "3600.00" }]);
  });

  it("uses the more specific published rule", () => {
    const result = calculateQuote(context({
      rules: [
        rule({ id: "general", amount: "100.00" }),
        rule({ id: "specific", amount: "80.00", originPortId: "nansha" }),
      ],
    }));
    expect(result.lines.find((line) => line.code === "THC")).toMatchObject({ amount: "160.00" });
  });

  it("labels a complete listed calculation without calling it all-in", () => {
    const result = calculateQuote(context({
      catalog: [{ code: "THC", name }],
      rules: [rule({ amount: "500.00" })],
    }));
    expect(result.hasUnconfirmed).toBe(false);
    expect(result.totalKind).toBe("listed_total");
  });
});

describe("rate visibility", () => {
  const rate = {
    id: "rate-1",
    status: "published",
    visibility: "public" as const,
    validFrom: "2026-11-01",
    validTo: "2026-11-30",
    selectedSellAmount: "1800.00",
    transitDaysMin: 28,
  };

  it("hides expired, unpublished and demo rates from the public query", () => {
    expect(isRateVisible(rate, "2026-11-20", "2026-11-04", false)).toBe(true);
    expect(isRateVisible(rate, "2026-12-01", "2026-11-04", false)).toBe(false);
    expect(isRateVisible({ ...rate, validTo: "2026-11-03" }, "2026-11-02", "2026-11-04", false)).toBe(false);
    expect(isRateVisible({ ...rate, status: "draft" }, "2026-11-20", "2026-11-04", false)).toBe(false);
    expect(isRateVisible({ ...rate, visibility: "demo" }, "2026-11-20", "2026-11-04", false)).toBe(false);
    expect(isRateVisible({ ...rate, visibility: "demo" }, "2026-11-20", "2026-11-04", true)).toBe(true);
  });

  it("sorts by price or transit and keeps missing prices last", () => {
    const rows = [
      { ...rate, id: "b", selectedSellAmount: "2000.00", transitDaysMin: 20 },
      { ...rate, id: "a", selectedSellAmount: null, transitDaysMin: 10 },
      { ...rate, id: "c", selectedSellAmount: "1500.00", transitDaysMin: 30 },
    ];
    expect(sortRates(rows, "price").map((item) => item.id)).toEqual(["c", "b", "a"]);
    expect(sortRates(rows, "transit").map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("flags a saved quote when the live rate changes without replacing the snapshot", () => {
    const snapshot = { rateVersionId: "rate-1", validTo: "2026-11-30", total: "3600.00" };
    expect(quoteNeedsRevalidation(snapshot, { id: "rate-1", status: "published", validTo: "2026-11-30" }, "2026-11-04")).toBe(false);
    expect(quoteNeedsRevalidation(snapshot, { id: "rate-1", status: "expired", validTo: "2026-11-30" }, "2026-11-04")).toBe(true);
    expect(quoteNeedsRevalidation(snapshot, { id: "rate-2", status: "published", validTo: "2026-12-31" }, "2026-11-04")).toBe(true);
    expect(snapshot.total).toBe("3600.00");
  });
});

describe("quote request boundary", () => {
  it("drops prices and totals submitted by the client", () => {
    expect(stripQuoteRequest({
      rateVersionId: "rate-1",
      quantity: 2,
      sellAmount: "1",
      total: "1",
      currency: "USD",
      role: "admin",
    })).toEqual({ rateVersionId: "rate-1", quantity: 2 });
  });
});

describe("captcha", () => {
  const pepper = "test-pepper";
  const sessionHash = "session-hash";

  async function issue(store: MemoryCaptchaStore, answer = "AB2CD", purpose: "login" | "register" = "login") {
    const record = {
      id: `id-${store.records.length + 1}`,
      purpose,
      sessionHash,
      answerHash: hashCaptchaAnswer(answer, pepper),
      expiresAt: new Date("2026-11-04T12:05:00Z"),
      consumedAt: null,
    };
    await store.invalidateOpen(sessionHash, purpose);
    await store.insert(record);
    return record;
  }

  it("stores a hash and rejects a wrong, expired, replayed or refreshed answer", async () => {
    const store = new MemoryCaptchaStore();
    const answer = createCaptchaAnswer();
    expect(answer).toHaveLength(5);
    const record = await issue(store, "H7K2M");
    expect(record.answerHash).not.toContain("H7K2M");
    expect(JSON.stringify(store.records)).not.toContain("H7K2M");

    expect(await verifyCaptcha(store, {
      id: record.id, answer: "WRONG", purpose: "login", sessionHash, pepper, now: new Date("2026-11-04T12:00:00Z"),
    })).toEqual({ ok: false, reason: "captcha_invalid" });
    expect(await verifyCaptcha(store, {
      id: record.id, answer: "H7K2M", purpose: "login", sessionHash, pepper, now: new Date("2026-11-04T12:00:00Z"),
    })).toEqual({ ok: false, reason: "captcha_invalid" });

    const second = await issue(store, "H7K2M");
    expect(await verifyCaptcha(store, {
      id: record.id, answer: "H7K2M", purpose: "login", sessionHash, pepper, now: new Date("2026-11-04T12:00:00Z"),
    })).toEqual({ ok: false, reason: "captcha_invalid" });
    expect(await verifyCaptcha(store, {
      id: second.id, answer: "H7K2M", purpose: "register", sessionHash, pepper, now: new Date("2026-11-04T12:00:00Z"),
    })).toEqual({ ok: false, reason: "captcha_invalid" });

    const third = await issue(store, "H7K2M");
    expect(await verifyCaptcha(store, {
      id: third.id, answer: "h7k2m", purpose: "login", sessionHash: "other", pepper, now: new Date("2026-11-04T12:00:00Z"),
    })).toEqual({ ok: false, reason: "captcha_invalid" });

    const fourth = await issue(store, "H7K2M");
    expect(await verifyCaptcha(store, {
      id: fourth.id, answer: "H7K2M", purpose: "login", sessionHash, pepper, now: new Date("2026-11-04T12:06:00Z"),
    })).toEqual({ ok: false, reason: "captcha_expired" });

    const fifth = await issue(store, "H7K2M");
    expect(await verifyCaptcha(store, {
      id: fifth.id, answer: "H7K2M", purpose: "login", sessionHash, pepper, now: new Date("2026-11-04T12:00:00Z"),
    })).toEqual({ ok: true });
  });
});

describe("session revocation", () => {
  it("rejects a revoked session and a token issued before the cutoff", () => {
    expect(sessionAllowed({ iat: 200, tokensValidAfter: 100, revoked: false })).toBe(true);
    expect(sessionAllowed({ iat: 50, tokensValidAfter: 100, revoked: false })).toBe(false);
    expect(sessionAllowed({ iat: 200, tokensValidAfter: 100, revoked: true })).toBe(false);
  });
});

describe("account input", () => {
  it("normalizes email without accepting a malformed address", () => {
    expect(normalizeEmail("  Lee@Example.com ")).toBe("lee@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
  });

  it("requires 15 characters and rejects silent bcrypt truncation", () => {
    expect(validatePassword("short-password")).toBe("too_short");
    expect(validatePassword("a".repeat(15))).toBe("ok");
    expect(validatePassword("测".repeat(15))).toBe("ok");
    expect(validatePassword("a".repeat(73))).toBe("too_long");
  });

  it("only returns an internal path", () => {
    expect(safeNextPath("/zh/account/quotes?id=1", "zh")).toBe("/zh/account/quotes?id=1");
    expect(safeNextPath("https://evil.example/zh", "en")).toBe("/en/account");
    expect(safeNextPath("//evil.example", "fr")).toBe("/fr/account");
    expect(safeNextPath("/admin", "zh")).toBe("/zh/account");
  });
});

describe("customer prices", () => {
  it("keeps sell amounts and drops cost fields", () => {
    const prices = customerPrices([
      { code: "40HQ", sell_amount: "1800.5", cost_amount: "900" },
      { code: "20GP", sell_amount: null, cost_amount: "400" },
    ]);
    expect(prices).toEqual({ "40HQ": "1800.50", "20GP": null });
    expect(hasCostKey(prices)).toBe(false);
    expect(JSON.stringify(prices)).not.toContain("900");
  });
});

describe("rate import", () => {
  it("rejects an incomplete note translation and a row without a sell rate", () => {
    const base = {
      origin_port_code: "CNNSA",
      destination_port_code: "CIABJ",
      carrier_code: "DEMO",
      carrier_name: "示例船公司 A",
      service_type: "direct",
      transit_days_min: "24",
      transit_days_max: "30",
      transit_is_confirmed: "false",
      valid_from: "2026-11-01",
      valid_to: "2026-11-30",
      currency: "USD",
      sell_20gp: "",
      cost_20gp: "900",
      sell_40gp: "",
      cost_40gp: "",
      sell_40hq: "1800",
      cost_40hq: "1200",
      cutoff_at: "",
      cutoff_is_confirmed: "",
      etd_at: "",
      etd_is_confirmed: "",
      notes_zh: "仅供演示",
      notes_en: "",
      notes_fr: "",
    };
    expect(validateImportRow(base, 2).issues.map((issue) => issue.code)).toContain("notes_incomplete");
    const fixed = validateImportRow({ ...base, notes_zh: "", sell_40hq: "" }, 3);
    expect(fixed.issues.map((issue) => issue.code)).toContain("sell_required");
    expect(validateImportRow({ ...base, notes_en: "Demo only", notes_fr: "Démonstration" }, 4).issues).toEqual([]);
  });
});
