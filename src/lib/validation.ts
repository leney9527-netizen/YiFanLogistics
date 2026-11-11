import type { Locale } from "@/lib/types";

const LOCALES: Locale[] = ["zh", "en", "fr"];

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (email.includes("..") || email.startsWith(".") || email.includes(".@") || email.includes("@.")) {
    return null;
  }
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

export type PasswordIssue = "ok" | "too_short" | "too_long";

const PASSWORD_MIN_CHARS = 15;
const PASSWORD_MAX_BYTES = 72;

export function validatePassword(input: unknown): PasswordIssue {
  if (typeof input !== "string") return "too_short";
  const chars = Array.from(input).length;
  if (chars < PASSWORD_MIN_CHARS) return "too_short";
  if (Buffer.byteLength(input, "utf8") > PASSWORD_MAX_BYTES) return "too_long";
  return "ok";
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.includes(value as Locale);
}

export function parseQuantity(input: unknown): number | null {
  const value = typeof input === "number" ? input : typeof input === "string" ? Number(input) : NaN;
  if (!Number.isInteger(value) || value < 1 || value > 40) return null;
  return value;
}

export function parseIsoDate(input: unknown): string | null {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const [year, month, day] = input.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return input;
}

export function parseOptionalPositive(input: unknown, max: number): number | null | "invalid" {
  if (input == null || input === "") return null;
  const value = typeof input === "number" ? input : typeof input === "string" ? Number(input) : NaN;
  if (!Number.isFinite(value) || value <= 0 || value > max) return "invalid";
  return value;
}

export function safeNextPath(input: unknown, locale: Locale): string {
  const fallback = `/${locale}/account`;
  if (typeof input !== "string" || input.length === 0 || input.length > 500) return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\") || input.includes("://")) {
    return fallback;
  }
  let url: URL;
  try {
    url = new URL(input, "http://internal.local");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://internal.local") return fallback;
  if (!/^\/(zh|en|fr)(\/|$)/.test(url.pathname)) return fallback;
  return `${url.pathname}${url.search}`;
}

export function assertSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
