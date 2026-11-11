import { createAdminClient } from "@/lib/supabase/admin";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { assertSameOrigin, isLocale } from "@/lib/validation";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError(403, "origin");
  const actor = await getActor();
  if (!actor) return jsonError(401, "forbidden");
  const admin = createAdminClient();
  const body = await readJson(request).catch(() => null) as Record<string, unknown> | null;
  if (!admin || !body) return jsonError(400, "invalid_input");
  const patch: Record<string, string | null> = {};
  if (typeof body.displayName === "string") patch.display_name = body.displayName.slice(0, 80);
  if (typeof body.companyName === "string") patch.company_name = body.companyName.slice(0, 120);
  if (typeof body.phone === "string") patch.phone = body.phone.slice(0, 40);
  if (typeof body.whatsapp === "string") patch.whatsapp = body.whatsapp.slice(0, 40);
  if (isLocale(body.locale)) patch.locale = body.locale;
  const { error } = await admin.from("profiles").update(patch).eq("id", actor.id);
  if (error) return jsonError(503, "unavailable");
  return jsonOk({});
}
