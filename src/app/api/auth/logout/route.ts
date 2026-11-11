import { logoutAccount } from "@/lib/server/auth-flow";
import { jsonOk } from "@/lib/http";
import { assertSameOrigin } from "@/lib/validation";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonOk({});
  await logoutAccount();
  return jsonOk({});
}
