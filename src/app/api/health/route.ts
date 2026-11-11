import { getServerEnv } from "@/lib/env";
import { NextResponse } from "next/server";

export async function GET() {
  const env = getServerEnv();
  return NextResponse.json(
    { ok: true, database: env ? "configured" : "missing", demoRates: env?.showDemo === true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
