import { createInquiry } from "@/lib/server/inquiries";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/http";
import { assertSameOrigin, isLocale } from "@/lib/validation";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError(403, "origin");
  const form = await request.formData();
  const requestedLocale = form.get("locale");
  const locale = isLocale(requestedLocale) ? requestedLocale : "en";
  const result = await createInquiry({ actor: await getActor(), locale, form });
  if (!result.ok) return jsonError(result.error === "invalid_input" ? 400 : result.error === "file_rejected" ? 400 : 503, result.error);
  return jsonOk({ id: result.id, number: result.number });
}
