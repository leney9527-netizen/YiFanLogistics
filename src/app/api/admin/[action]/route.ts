import { adminWrite, previewImport } from "@/lib/server/admin-write";
import { getActor } from "@/lib/server/session";
import { isStaffRole } from "@/lib/authz";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { assertSameOrigin } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  if (!assertSameOrigin(request)) return jsonError(403, "origin");
  const actor = await getActor();
  if (!actor || !isStaffRole(actor.role)) return jsonError(403, "forbidden");
  const { action } = await context.params;
  if (action === "preview-import") {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(400, "invalid_input");
    const result = await previewImport(actor, file);
    if (!result.ok) return jsonError(400, result.error);
    return jsonOk({ batchId: result.batchId, errorCount: result.errorCount, issues: result.issues });
  }
  const body = await readJson(request).catch(() => null);
  if (!body || typeof body !== "object") return jsonError(400, "invalid_input");
  const result = await adminWrite(actor, action, body as Record<string, unknown>);
  if (!result.ok) return jsonError(result.error === "forbidden" ? 403 : 400, result.error);
  return jsonOk({});
}
