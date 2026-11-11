import "server-only";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { canDraftRates, canManageStaff, canPublishRates } from "@/lib/authz";
import { RATE_IMPORT_COLUMNS, validateImportRow, type ImportIssue } from "@/lib/import/rates";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit, type Actor } from "@/lib/server/session";
import { normalizeEmail, parseIsoDate, validatePassword } from "@/lib/validation";

function money(value: unknown): string | null {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

export async function adminWrite(actor: Actor, action: string, body: Record<string, unknown>) {
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, error: "unavailable" };
  if (action === "save-port") {
    const code = String(body.code ?? "").toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(code)) return { ok: false as const, error: "invalid_input" };
    const { error } = await admin.from("ports").insert({
      code,
      country_code: String(body.country ?? "CN"),
      name_zh: String(body.nameZh ?? ""),
      name_en: String(body.nameEn ?? ""),
      name_fr: String(body.nameFr ?? ""),
      timezone: String(body.timezone ?? "Asia/Shanghai"),
      kind: body.kind === "destination" || body.kind === "both" ? body.kind : "origin",
    });
    if (error) return { ok: false as const, error: "invalid_input" };
    await writeAudit({ actorId: actor.id, action: "port_created", entityType: "port", summary: code });
    return { ok: true as const };
  }
  if (action === "save-carrier") {
    const code = String(body.code ?? "").toUpperCase();
    const name = String(body.name ?? "").trim();
    if (!code || !name) return { ok: false as const, error: "invalid_input" };
    const { error } = await admin.from("carriers").insert({ code, name, name_zh: name, name_en: name, name_fr: name });
    if (error) return { ok: false as const, error: "invalid_input" };
    await writeAudit({ actorId: actor.id, action: "carrier_created", entityType: "carrier", summary: code });
    return { ok: true as const };
  }
  if (action === "save-rate") {
    if (!canDraftRates(actor.role)) return { ok: false as const, error: "forbidden" };
    const validFrom = parseIsoDate(body.validFrom);
    const validTo = parseIsoDate(body.validTo);
    if (!validFrom || !validTo || validTo < validFrom) return { ok: false as const, error: "invalid_input" };
    const sells = { "20GP": money(body.sell20), "40GP": money(body.sell40), "40HQ": money(body.sell40hq) };
    if (!Object.values(sells).some(Boolean)) return { ok: false as const, error: "invalid_input" };
    const id = randomUUID();
    const { error } = await admin.from("freight_rate_versions").insert({
      id,
      series_id: randomUUID(),
      version_no: 1,
      route_id: String(body.routeId),
      carrier_id: String(body.carrierId),
      service_type: body.serviceType === "transshipment" ? "transshipment" : "direct",
      valid_from: validFrom,
      valid_to: validTo,
      currency: String(body.currency ?? "USD").toUpperCase(),
      status: "draft",
      visibility: "public",
      created_by: actor.id,
    });
    if (error) return { ok: false as const, error: "invalid_input" };
    const { data: containers } = await admin.from("container_types").select("id, code");
    const prices = (containers ?? []).flatMap((container) => {
      const sell = sells[container.code as "20GP"];
      if (!sell) return [];
      const cost = container.code === "40HQ" ? money(body.cost40hq) : null;
      return [{ rate_version_id: id, container_type_id: container.id, sell_amount: sell, cost_amount: cost }];
    });
    if (prices.length) await admin.from("freight_rate_prices").insert(prices);
    if (body.publishId && canPublishRates(actor.role)) {
      await admin.from("freight_rate_versions").update({ status: "published", published_at: new Date().toISOString(), published_by: actor.id }).eq("id", String(body.publishId)).in("status", ["draft", "pending_review"]);
    }
    await writeAudit({ actorId: actor.id, action: "rate_drafted", entityType: "rate", entityId: id, summary: "Draft rate created" });
    return { ok: true as const, id };
  }
  if (action === "save-fx") {
    const rate = Number(body.rate);
    if (!Number.isFinite(rate) || rate <= 0) return { ok: false as const, error: "invalid_input" };
    const { error } = await admin.from("exchange_rates").insert({
      base_currency: String(body.base ?? "").toUpperCase(),
      quote_currency: String(body.quote ?? "").toUpperCase(),
      rate,
      source: String(body.source ?? "").slice(0, 160),
      effective_at: new Date().toISOString(),
      created_by: actor.id,
    });
    if (error) return { ok: false as const, error: "invalid_input" };
    await writeAudit({ actorId: actor.id, action: "fx_recorded", entityType: "exchange_rate", summary: `${body.base}/${body.quote}` });
    return { ok: true as const };
  }
  if (action === "update-inquiry") {
    const status = String(body.status ?? "");
    if (!["new", "contacted", "quoted", "won", "closed"].includes(status)) return { ok: false as const, error: "invalid_input" };
    const { data: current } = await admin.from("inquiries").select("status").eq("id", String(body.inquiryId)).maybeSingle();
    if (!current) return { ok: false as const, error: "not_found" };
    const { error } = await admin.from("inquiries").update({ status, assigned_to: actor.id }).eq("id", String(body.inquiryId));
    if (error) return { ok: false as const, error: "unavailable" };
    await admin.from("inquiry_events").insert({ inquiry_id: String(body.inquiryId), actor_id: actor.id, from_status: current.status, to_status: status });
    await writeAudit({ actorId: actor.id, action: "inquiry_updated", entityType: "inquiry", entityId: String(body.inquiryId), summary: status });
    return { ok: true as const };
  }
  if (action === "save-staff") {
    if (!canManageStaff(actor.role)) return { ok: false as const, error: "forbidden" };
    const email = normalizeEmail(body.email);
    if (!email || validatePassword(body.password) !== "ok") return { ok: false as const, error: "invalid_input" };
    const role = body.role === "admin" ? "admin" : "sales";
    const { data, error } = await admin.auth.admin.createUser({ email, password: String(body.password), email_confirm: true });
    if (error || !data.user) return { ok: false as const, error: "register_failed" };
    await admin.from("profiles").update({ role, locale: "zh" }).eq("id", data.user.id);
    await writeAudit({ actorId: actor.id, action: "staff_created", entityType: "profile", entityId: data.user.id, summary: role });
    return { ok: true as const };
  }
  if (action === "save-settings") {
    if (!canManageStaff(actor.role)) return { ok: false as const, error: "forbidden" };
    const patch: Record<string, string | boolean> = {};
    if (typeof body.phone === "string" && body.phone) patch.phone = body.phone;
    if (typeof body.email === "string" && body.email) patch.email = body.email;
    if (typeof body.whatsapp === "string" && body.whatsapp) patch.whatsapp = body.whatsapp;
    patch.require_login_for_prices = body.requireLogin === true || body.requireLogin === "on";
    const { error } = await admin.from("site_settings").update(patch).eq("id", 1);
    if (error) return { ok: false as const, error: "unavailable" };
    await writeAudit({ actorId: actor.id, action: "settings_updated", entityType: "settings", summary: "Company settings updated" });
    return { ok: true as const };
  }
  if (action === "commit-import") {
    if (!canDraftRates(actor.role)) return { ok: false as const, error: "forbidden" };
    const { data: batch } = await admin.from("import_batches").select("id, payload, status, error_count").eq("id", String(body.batchId)).maybeSingle();
    if (!batch || batch.status !== "preview" || batch.error_count > 0) return { ok: false as const, error: "invalid_input" };
    const rows = batch.payload as Record<string, string>[];
    for (const row of rows) {
      await createDraftFromImport(admin, actor, row);
    }
    await admin.from("import_batches").update({ status: "committed", committed_at: new Date().toISOString() }).eq("id", batch.id);
    await writeAudit({ actorId: actor.id, action: "rates_imported", entityType: "import", entityId: batch.id, summary: `${rows.length} draft rows` });
    return { ok: true as const };
  }
  return { ok: false as const, error: "not_found" };
}

async function createDraftFromImport(admin: NonNullable<ReturnType<typeof createAdminClient>>, actor: Actor, row: Record<string, string>) {
  const { data: origin } = await admin.from("ports").select("id").eq("code", row.origin_port_code).maybeSingle();
  const { data: destination } = await admin.from("ports").select("id").eq("code", row.destination_port_code).maybeSingle();
  if (!origin || !destination) return;
  let routeId: string | null = null;
  const existing = await admin.from("routes").select("id").eq("origin_port_id", origin.id).eq("destination_port_id", destination.id).maybeSingle();
  if (existing.data) routeId = existing.data.id;
  else {
    const created = await admin.from("routes").insert({ origin_port_id: origin.id, destination_port_id: destination.id }).select("id").single();
    routeId = created.data?.id ?? null;
  }
  let carrierId: string | null = null;
  const carrier = await admin.from("carriers").select("id").eq("code", row.carrier_code).maybeSingle();
  if (carrier.data) carrierId = carrier.data.id;
  else {
    const created = await admin.from("carriers").insert({
      code: row.carrier_code,
      name: row.carrier_name,
      name_zh: row.carrier_name,
      name_en: row.carrier_name,
      name_fr: row.carrier_name,
    }).select("id").single();
    carrierId = created.data?.id ?? null;
  }
  if (!routeId || !carrierId) return;
  const rateId = randomUUID();
  await admin.from("freight_rate_versions").insert({
    id: rateId,
    series_id: randomUUID(),
    version_no: 1,
    route_id: routeId,
    carrier_id: carrierId,
    service_type: row.service_type,
    transit_days_min: row.transit_days_min ? Number(row.transit_days_min) : null,
    transit_days_max: row.transit_days_max ? Number(row.transit_days_max) : null,
    transit_is_confirmed: row.transit_is_confirmed === "true",
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    currency: row.currency,
    status: "draft",
    visibility: "public",
    notes_zh: row.notes_zh || null,
    notes_en: row.notes_en || null,
    notes_fr: row.notes_fr || null,
    created_by: actor.id,
  });
  const { data: containers } = await admin.from("container_types").select("id, code");
  const prices = (containers ?? []).flatMap((container) => {
    const key = container.code === "20GP" ? "sell_20gp" : container.code === "40GP" ? "sell_40gp" : container.code === "40HQ" ? "sell_40hq" : "";
    const costKey = key.replace("sell_", "cost_");
    if (!key || !row[key]) return [];
    return [{ rate_version_id: rateId, container_type_id: container.id, sell_amount: row[key], cost_amount: row[costKey] || null }];
  });
  if (prices.length) await admin.from("freight_rate_prices").insert(prices);
}

export async function previewImport(actor: Actor, file: File) {
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, error: "unavailable" };
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return { ok: false as const, error: "invalid_input" };
  const header = (sheet.getRow(1).values as unknown[]).slice(1).map((value) => String(value ?? "").trim());
  const issues: ImportIssue[] = RATE_IMPORT_COLUMNS.filter((column) => !header.includes(column)).map((column) => ({ row: 1, field: column, code: "missing_column" }));
  const rows: Record<string, string>[] = [];
  sheet.eachRow((excelRow, index) => {
    if (index === 1) return;
    const record: Record<string, unknown> = {};
    header.forEach((column, columnIndex) => { record[column] = excelRow.getCell(columnIndex + 1).text ?? excelRow.getCell(columnIndex + 1).value; });
    const validated = validateImportRow(record, index);
    issues.push(...validated.issues);
    if (validated.value) rows.push(validated.value);
  });
  const { data, error } = await admin.from("import_batches").insert({
    created_by: actor.id,
    status: "preview",
    filename: file.name.slice(0, 180),
    payload: rows,
    error_count: issues.length,
  }).select("id").single();
  if (error || !data) return { ok: false as const, error: "unavailable" };
  return { ok: true as const, batchId: data.id, errorCount: issues.length, issues: issues.slice(0, 50) };
}
