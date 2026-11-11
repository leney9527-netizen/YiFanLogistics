import { isLocale, parseIsoDate } from "@/lib/validation";

export const RATE_IMPORT_COLUMNS = [
  "origin_port_code",
  "destination_port_code",
  "carrier_code",
  "carrier_name",
  "service_type",
  "transit_days_min",
  "transit_days_max",
  "transit_is_confirmed",
  "valid_from",
  "valid_to",
  "currency",
  "sell_20gp",
  "cost_20gp",
  "sell_40gp",
  "cost_40gp",
  "sell_40hq",
  "cost_40hq",
  "cutoff_at",
  "cutoff_is_confirmed",
  "etd_at",
  "etd_is_confirmed",
  "notes_zh",
  "notes_en",
  "notes_fr",
] as const;

export type ImportRow = Record<(typeof RATE_IMPORT_COLUMNS)[number], string>;

export type ImportIssue = { row: number; field: string; code: string };

function cell(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function parseBool(value: string): boolean | null {
  if (value === "") return false;
  const normalized = value.toLowerCase();
  if (["true", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "no", "n", "0"].includes(normalized)) return false;
  return null;
}

function parseOptionalInt(value: string): number | null | "invalid" {
  if (value === "") return null;
  if (!/^\d+$/.test(value)) return "invalid";
  return Number(value);
}

function parseOptionalMoney(value: string): string | null | "invalid" {
  if (value === "") return null;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) return "invalid";
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

export function validateImportRow(raw: Record<string, unknown>, rowNumber: number): {
  issues: ImportIssue[];
  value: ImportRow | null;
} {
  const issues: ImportIssue[] = [];
  const value = {} as ImportRow;
  for (const column of RATE_IMPORT_COLUMNS) value[column] = cell(raw[column]);

  if (!/^[A-Z0-9]{4,10}$/.test(value.origin_port_code)) issues.push({ row: rowNumber, field: "origin_port_code", code: "invalid_port" });
  if (!/^[A-Z0-9]{4,10}$/.test(value.destination_port_code)) issues.push({ row: rowNumber, field: "destination_port_code", code: "invalid_port" });
  if (value.origin_port_code === value.destination_port_code) issues.push({ row: rowNumber, field: "destination_port_code", code: "same_port" });
  if (!/^[A-Z0-9]{2,12}$/.test(value.carrier_code)) issues.push({ row: rowNumber, field: "carrier_code", code: "invalid_carrier" });
  if (!value.carrier_name) issues.push({ row: rowNumber, field: "carrier_name", code: "required" });
  if (value.service_type !== "direct" && value.service_type !== "transshipment") {
    issues.push({ row: rowNumber, field: "service_type", code: "invalid_service" });
  }
  const minDays = parseOptionalInt(value.transit_days_min);
  const maxDays = parseOptionalInt(value.transit_days_max);
  if (minDays === "invalid") issues.push({ row: rowNumber, field: "transit_days_min", code: "invalid_number" });
  if (maxDays === "invalid") issues.push({ row: rowNumber, field: "transit_days_max", code: "invalid_number" });
  if (typeof minDays === "number" && typeof maxDays === "number" && maxDays < minDays) {
    issues.push({ row: rowNumber, field: "transit_days_max", code: "range" });
  }
  for (const field of ["transit_is_confirmed", "cutoff_is_confirmed", "etd_is_confirmed"] as const) {
    if (parseBool(value[field]) == null) issues.push({ row: rowNumber, field, code: "invalid_boolean" });
  }
  const validFrom = parseIsoDate(value.valid_from);
  const validTo = parseIsoDate(value.valid_to);
  if (!validFrom) issues.push({ row: rowNumber, field: "valid_from", code: "invalid_date" });
  if (!validTo) issues.push({ row: rowNumber, field: "valid_to", code: "invalid_date" });
  if (validFrom && validTo && validTo < validFrom) issues.push({ row: rowNumber, field: "valid_to", code: "range" });
  if (!/^[A-Z]{3}$/.test(value.currency)) issues.push({ row: rowNumber, field: "currency", code: "invalid_currency" });

  let sellCount = 0;
  for (const field of ["sell_20gp", "cost_20gp", "sell_40gp", "cost_40gp", "sell_40hq", "cost_40hq"] as const) {
    const money = parseOptionalMoney(value[field]);
    if (money === "invalid") issues.push({ row: rowNumber, field, code: "invalid_money" });
    if (field.startsWith("sell_") && typeof money === "string") sellCount += 1;
  }
  if (sellCount === 0) issues.push({ row: rowNumber, field: "sell_20gp", code: "sell_required" });

  for (const field of ["cutoff_at", "etd_at"] as const) {
    if (value[field] && Number.isNaN(Date.parse(value[field]))) {
      issues.push({ row: rowNumber, field, code: "invalid_datetime" });
    }
  }
  const notes = [value.notes_zh, value.notes_en, value.notes_fr];
  const filled = notes.filter(Boolean).length;
  if (filled !== 0 && filled !== 3) issues.push({ row: rowNumber, field: "notes_zh", code: "notes_incomplete" });

  return { issues, value: issues.length ? null : value };
}

export function templateHeaders(): string[] {
  return [...RATE_IMPORT_COLUMNS];
}

export function assertNoLocaleLeak(keys: string[]): boolean {
  return keys.every((key) => isLocale(key) || !key.includes("undefined"));
}
