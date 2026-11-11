import { issueCaptcha } from "@/lib/server/captcha-service";
import { allowRate, hashValue } from "@/lib/server/session";
import { clientIp, jsonError, jsonOk } from "@/lib/http";
import { assertSameOrigin } from "@/lib/validation";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError(403, "origin");
  const allowed = await allowRate(`captcha:ip:${hashValue(clientIp(request))}`, 10 * 60, 20);
  if (!allowed) return jsonError(429, "rate_limited");
  const body = await request.json().catch(() => null) as { purpose?: string } | null;
  if (body?.purpose !== "login" && body?.purpose !== "register") return jsonError(400, "invalid_input");
  try {
    const captcha = await issueCaptcha(body.purpose);
    return jsonOk(captcha);
  } catch {
    return jsonError(503, "unavailable");
  }
}
