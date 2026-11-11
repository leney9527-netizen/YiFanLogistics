import { NextResponse } from "next/server";

export const PRIVATE_CACHE = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
} as const;

export function jsonError(status: number, code: string) {
  return NextResponse.json({ ok: false, error: { code } }, { status, headers: PRIVATE_CACHE });
}

export function jsonOk(body: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok: true, ...body }, { status, headers: PRIVATE_CACHE });
}

export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 1_000_000) {
    throw new Error("payload_too_large");
  }
  if (!text) return {};
  return JSON.parse(text) as unknown;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
