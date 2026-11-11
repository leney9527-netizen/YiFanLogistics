import { jsonError, jsonOk } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIso } from "@/lib/validation";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError(401, "forbidden");
  }
  const admin = createAdminClient();
  if (!admin) return jsonError(503, "unavailable");
  const today = todayIso();
  const { data, error } = await admin
    .from("freight_rate_versions")
    .update({ status: "expired" })
    .eq("status", "published")
    .lt("valid_to", today)
    .select("id");
  if (error) return jsonError(500, "unavailable");
  return jsonOk({ expired: data?.length ?? 0 });
}
