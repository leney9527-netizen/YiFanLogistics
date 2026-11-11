import "server-only";
import { createHmac } from "node:crypto";
import { sessionAllowed } from "@/lib/captcha";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import type { Locale, Role } from "@/lib/types";
import { isLocale } from "@/lib/validation";

export type Actor = {
  id: string;
  email: string;
  role: Role;
  locale: Locale;
  displayName: string | null;
  companyName: string | null;
  phone: string | null;
  whatsapp: string | null;
  sessionId: string | null;
};

type JwtPayload = { sub?: string; iat?: number; session_id?: string };

function decodeJwt(token: string): JwtPayload | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as JwtPayload;
  } catch {
    return null;
  }
}

export function hashValue(value: string): string {
  const pepper = getServerEnv()?.pepper ?? "missing";
  return createHmac("sha256", pepper).update(value).digest("hex");
}

export async function getActor(): Promise<Actor | null> {
  const supabase = await createSupabaseServerClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return null;
  const payload = decodeJwt(token);
  if (!payload || payload.sub !== userData.user.id || payload.iat == null) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, role, locale, display_name, company_name, phone, whatsapp, tokens_valid_after")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!profile || !isLocale(profile.locale)) return null;
  if (profile.role !== "customer" && profile.role !== "sales" && profile.role !== "admin") return null;

  let revoked = false;
  if (payload.session_id) {
    const { data: row } = await admin
      .from("revoked_sessions")
      .select("session_id")
      .eq("session_id", payload.session_id)
      .maybeSingle();
    revoked = Boolean(row);
  }
  const validAfter = Math.floor(new Date(profile.tokens_valid_after).getTime() / 1000);
  if (!sessionAllowed({ iat: payload.iat, tokensValidAfter: validAfter, revoked })) return null;

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    locale: profile.locale,
    displayName: profile.display_name,
    companyName: profile.company_name,
    phone: profile.phone,
    whatsapp: profile.whatsapp,
    sessionId: payload.session_id ?? null,
  };
}

export async function allowRate(key: string, windowSeconds: number, limit: number): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });
  if (error) return false;
  return data === true;
}

export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  ip?: string;
}) {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from("audit_logs").insert({
    actor_id: input.actorId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    summary: input.summary.slice(0, 300),
    ip_hash: input.ip ? hashValue(input.ip) : null,
  });
}
