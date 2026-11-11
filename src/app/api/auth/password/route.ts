import { changePassword, revokeOtherSessions } from "@/lib/server/auth-flow";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { assertSameOrigin } from "@/lib/validation";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError(403, "origin");
  const body = await readJson(request).catch(() => null) as Record<string, unknown> | null;
  if (!body) return jsonError(400, "invalid_input");
  const result = body.revokeOnly === true
    ? await revokeOtherSessions()
    : await changePassword({
      currentPassword: typeof body.currentPassword === "string" ? body.currentPassword : "",
      newPassword: typeof body.newPassword === "string" ? body.newPassword : "",
      revokeOthers: body.revokeOthers !== false,
    });
  if (!result.ok) return jsonError(result.error === "forbidden" ? 401 : result.error === "unavailable" ? 503 : 400, result.error);
  return jsonOk({});
}
