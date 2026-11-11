import { registerAccount } from "@/lib/server/auth-flow";
import { clientIp, jsonError, jsonOk, readJson } from "@/lib/http";
import { assertSameOrigin, isLocale } from "@/lib/validation";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError(403, "origin");
  const body = await readJson(request).catch(() => null) as Record<string, unknown> | null;
  if (!body) return jsonError(400, "invalid_input");
  const locale = isLocale(body.locale) ? body.locale : "en";
  const result = await registerAccount({
    email: String(body.email ?? ""),
    password: typeof body.password === "string" ? body.password : "",
    confirmPassword: typeof body.confirmPassword === "string" ? body.confirmPassword : "",
    challengeId: String(body.challengeId ?? ""),
    answer: String(body.answer ?? ""),
    locale,
    ip: clientIp(request),
  });
  if (!result.ok) return jsonError(result.error === "rate_limited" ? 429 : result.error === "unavailable" ? 503 : 400, result.error);
  return jsonOk({ next: `/${locale}/account` });
}
