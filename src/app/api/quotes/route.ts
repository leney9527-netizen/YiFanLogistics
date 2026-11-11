import { saveQuote } from "@/lib/server/freight";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { assertSameOrigin, isLocale, parseIsoDate, parseOptionalPositive, parseQuantity } from "@/lib/validation";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError(403, "origin");
  const actor = await getActor();
  if (!actor) return jsonError(401, "login_required");
  const body = await readJson(request).catch(() => null) as Record<string, unknown> | null;
  if (!body) return jsonError(400, "invalid_input");
  const quantity = parseQuantity(body.quantity);
  const readyDate = parseIsoDate(body.readyDate);
  const distance = parseOptionalPositive(body.distanceKm, 5000);
  const trucks = parseOptionalPositive(body.truckCount, 40);
  if (!quantity || !readyDate || distance === "invalid" || trucks === "invalid") return jsonError(400, "invalid_input");
  if (typeof body.rateId !== "string" || typeof body.containerCode !== "string") return jsonError(400, "invalid_input");
  const locale = isLocale(body.locale) ? body.locale : actor.locale;
  const saved = await saveQuote({
    actor,
    rateId: body.rateId,
    containerCode: body.containerCode,
    quantity,
    readyDate,
    distanceKm: distance,
    truckCount: trucks == null ? null : Math.round(trucks),
    locale,
  });
  if (!saved.ok) return jsonError(saved.error === "not_found" ? 404 : 503, saved.error);
  return jsonOk({ id: saved.id, number: saved.number });
}
