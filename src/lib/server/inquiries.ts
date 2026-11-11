import "server-only";
import { randomUUID } from "node:crypto";
import { detectFile, MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES, safeFileName } from "@/lib/files";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Actor } from "@/lib/server/session";
import type { Locale } from "@/lib/types";
import { parseIsoDate, parseQuantity } from "@/lib/validation";

export async function createInquiry(input: {
  actor: Actor | null;
  locale: Locale;
  form: FormData;
}): Promise<{ ok: true; number: string; id: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unavailable" };
  const origin = String(input.form.get("origin") ?? "");
  const destination = String(input.form.get("destination") ?? "");
  const container = String(input.form.get("container") ?? "");
  const quantity = parseQuantity(input.form.get("quantity"));
  const contact = String(input.form.get("contactName") ?? "").trim();
  const cargo = String(input.form.get("cargo") ?? "").trim();
  const ready = parseIsoDate(input.form.get("readyDate"));
  if (!contact || !cargo || !quantity) return { ok: false, error: "invalid_input" };
  const phone = String(input.form.get("phone") ?? "").trim();
  const whatsapp = String(input.form.get("whatsapp") ?? "").trim();
  if (!phone && !whatsapp) return { ok: false, error: "invalid_input" };

  const [ports, containers] = await Promise.all([
    admin.from("ports").select("id, code").in("code", [origin, destination]),
    admin.from("container_types").select("id, code").eq("code", container).maybeSingle(),
  ]);
  const originPort = (ports.data ?? []).find((port) => port.code === origin);
  const destinationPort = (ports.data ?? []).find((port) => port.code === destination);
  if (!originPort || !destinationPort || !containers.data) return { ok: false, error: "invalid_input" };

  const files = input.form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length > MAX_UPLOAD_FILES) return { ok: false, error: "file_rejected" };
  const accepted: { file: File; bytes: Uint8Array; type: NonNullable<ReturnType<typeof detectFile>> }[] = [];
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "file_rejected" };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectFile(bytes);
    if (!type) return { ok: false, error: "file_rejected" };
    accepted.push({ file, bytes, type });
  }

  const { data: number, error: numberError } = await admin.rpc("allocate_number", { p_prefix: "YFI" });
  if (numberError || typeof number !== "string") return { ok: false, error: "unavailable" };
  const { data: inquiry, error } = await admin.from("inquiries").insert({
    inquiry_number: number,
    user_id: input.actor?.id ?? null,
    contact_name: contact.slice(0, 80),
    company_name: String(input.form.get("company") ?? "").slice(0, 120),
    phone: phone.slice(0, 40),
    whatsapp: whatsapp.slice(0, 40),
    origin_port_id: originPort.id,
    destination_port_id: destinationPort.id,
    container_type_id: containers.data.id,
    quantity,
    cargo_name: cargo.slice(0, 160),
    pieces: Number(input.form.get("pieces")) || null,
    weight_kg: Number(input.form.get("weight")) || null,
    volume_cbm: Number(input.form.get("volume")) || null,
    special_cargo: String(input.form.get("special") ?? "").slice(0, 300),
    load_address: String(input.form.get("address") ?? "").slice(0, 300),
    ready_date: ready,
    need_trucking: input.form.get("trucking") === "on",
    need_export_customs: input.form.get("exportCustoms") === "on",
    need_dest_customs: input.form.get("destCustoms") === "on",
    need_delivery: input.form.get("delivery") === "on",
    notes: String(input.form.get("notes") ?? "").slice(0, 2000),
    locale: input.locale,
  }).select("id").single();
  if (error || !inquiry) return { ok: false, error: "unavailable" };

  for (const item of accepted) {
    const path = `${inquiry.id}/${randomUUID()}.${item.type.extension}`;
    const uploaded = await admin.storage.from("inquiry-files").upload(path, item.bytes, {
      contentType: item.type.contentType,
      upsert: false,
    });
    if (uploaded.error) return { ok: false, error: "file_rejected" };
    await admin.from("inquiry_files").insert({
      inquiry_id: inquiry.id,
      storage_path: path,
      file_name: safeFileName(item.file.name),
      content_type: item.type.contentType,
      size_bytes: item.bytes.byteLength,
    });
  }
  await admin.from("inquiry_events").insert({ inquiry_id: inquiry.id, to_status: "new", actor_id: input.actor?.id ?? null });
  return { ok: true, number, id: inquiry.id };
}
