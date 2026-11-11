export const LOCALES = ["zh", "en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export type Role = "customer" | "sales" | "admin";

export type ServiceType = "direct" | "transshipment";

export type BillingUnit = "per_container" | "per_shipment" | "per_truck" | "per_time" | "per_km";

export type PricingMode = "fixed" | "manual" | "included";

export type CargoType = "general" | "sensitive";

export type Localized = Record<Locale, string>;

export type RateStatus = "draft" | "pending_review" | "published" | "expired" | "superseded" | "archived";

export type InquiryStatus = "new" | "contacted" | "quoted" | "won" | "closed";
