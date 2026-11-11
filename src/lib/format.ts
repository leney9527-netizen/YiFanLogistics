import type { Locale } from "@/lib/types";

const INTL_LOCALE: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en-US",
  fr: "fr-FR",
};

export function intlLocale(locale: Locale): string {
  return INTL_LOCALE[locale];
}

export function formatMoney(amount: string, currency: string, locale: Locale): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPortTime(iso: string, timeZone: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const formatted = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(date);
  return formatted;
}

export function formatDate(iso: string, locale: Locale, timeZone = "UTC"): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
