import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkCaptcha } from "@/lib/server/captcha-service";
import { allowRate, getActor, hashValue, writeAudit } from "@/lib/server/session";
import type { Locale } from "@/lib/types";
import { isLocale, normalizeEmail, validatePassword } from "@/lib/validation";

type AuthResult = { ok: true; locale: Locale } | { ok: false; error: string };

async function clearance(email: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("login_clearances")
    .insert({
      email_normalized: email,
      expires_at: new Date(Date.now() + 20_000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id as string;
}

async function dropClearance(id: string) {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from("login_clearances").delete().eq("id", id).is("consumed_at", null);
}

async function signInCleared(email: string, password: string, locale: Locale, ip: string): Promise<AuthResult> {
  const gate = await clearance(email);
  if (!gate) return { ok: false, error: "unavailable" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await dropClearance(gate);
    await writeAudit({ action: "login_failed", entityType: "auth", summary: "Rejected sign-in", ip });
    return { ok: false, error: "credentials" };
  }
  const admin = createAdminClient();
  if (admin && isLocale(locale)) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await admin.from("profiles").update({ locale }).eq("id", userData.user.id);
    }
  }
  return { ok: true, locale };
}

export async function loginAccount(input: {
  email: string;
  password: string;
  challengeId: string;
  answer: string;
  locale: Locale;
  ip: string;
}): Promise<AuthResult> {
  const ipOk = await allowRate(`login:ip:${hashValue(input.ip)}`, 15 * 60, 10);
  if (!ipOk) return { ok: false, error: "rate_limited" };
  const captcha = await checkCaptcha({ id: input.challengeId, answer: input.answer, purpose: "login" });
  if (!captcha.ok) return { ok: false, error: captcha.reason === "captcha_expired" ? "captcha_expired" : "captcha_invalid" };
  const email = normalizeEmail(input.email);
  if (!email || typeof input.password !== "string" || input.password.length === 0) {
    return { ok: false, error: "credentials" };
  }
  const emailOk = await allowRate(`login:email:${hashValue(email)}`, 15 * 60, 10);
  if (!emailOk) return { ok: false, error: "rate_limited" };
  return signInCleared(email, input.password, input.locale, input.ip);
}

export async function registerAccount(input: {
  email: string;
  password: string;
  confirmPassword: string;
  challengeId: string;
  answer: string;
  locale: Locale;
  ip: string;
}): Promise<AuthResult> {
  const ipOk = await allowRate(`register:ip:${hashValue(input.ip)}`, 60 * 60, 5);
  if (!ipOk) return { ok: false, error: "rate_limited" };
  const captcha = await checkCaptcha({ id: input.challengeId, answer: input.answer, purpose: "register" });
  if (!captcha.ok) return { ok: false, error: captcha.reason === "captcha_expired" ? "captcha_expired" : "captcha_invalid" };
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "email_invalid" };
  const passwordIssue = validatePassword(input.password);
  if (passwordIssue === "too_short") return { ok: false, error: "password_short" };
  if (passwordIssue === "too_long") return { ok: false, error: "password_long" };
  if (input.password !== input.confirmPassword) return { ok: false, error: "password_mismatch" };
  const emailOk = await allowRate(`register:email:${hashValue(email)}`, 60 * 60, 5);
  if (!emailOk) return { ok: false, error: "rate_limited" };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unavailable" };
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    await writeAudit({ action: "register_failed", entityType: "auth", summary: "Registration was not completed", ip: input.ip });
    return { ok: false, error: "register_failed" };
  }
  await admin.from("profiles").update({ locale: input.locale, role: "customer", email_ownership_verified: false }).eq("id", data.user.id);
  return signInCleared(email, input.password, input.locale, input.ip);
}

export async function logoutAccount() {
  const actor = await getActor();
  const supabase = await createSupabaseServerClient();
  const admin = createAdminClient();
  if (actor?.sessionId && admin) {
    await admin.from("revoked_sessions").upsert({ session_id: actor.sessionId, user_id: actor.id });
  }
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  if (actor) await writeAudit({ actorId: actor.id, action: "logout", entityType: "auth", summary: "Signed out of the current session" });
}

export async function changePassword(input: { currentPassword: string; newPassword: string; revokeOthers: boolean }) {
  const actor = await getActor();
  if (!actor) return { ok: false as const, error: "forbidden" };
  const passwordIssue = validatePassword(input.newPassword);
  if (passwordIssue === "too_short") return { ok: false as const, error: "password_short" };
  if (passwordIssue === "too_long") return { ok: false as const, error: "password_long" };
  const gate = await clearance(actor.email);
  if (!gate) return { ok: false as const, error: "unavailable" };
  const supabase = await createSupabaseServerClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false as const, error: "unavailable" };
  const { error } = await supabase.auth.signInWithPassword({ email: actor.email, password: input.currentPassword });
  if (error) {
    await dropClearance(gate);
    return { ok: false as const, error: "credentials" };
  }
  const { error: updateError } = await supabase.auth.updateUser({ password: input.newPassword });
  if (updateError) return { ok: false as const, error: "unavailable" };
  if (input.revokeOthers) {
    await admin.from("profiles").update({ tokens_valid_after: new Date().toISOString() }).eq("id", actor.id);
    await supabase.auth.refreshSession();
    await supabase.auth.signOut({ scope: "others" });
  }
  await writeAudit({ actorId: actor.id, action: "password_changed", entityType: "profile", entityId: actor.id, summary: "Password changed" });
  return { ok: true as const };
}

export async function revokeOtherSessions() {
  const actor = await getActor();
  const supabase = await createSupabaseServerClient();
  const admin = createAdminClient();
  if (!actor || !supabase || !admin) return { ok: false as const, error: "forbidden" };
  await admin.from("profiles").update({ tokens_valid_after: new Date().toISOString() }).eq("id", actor.id);
  await supabase.auth.refreshSession();
  await supabase.auth.signOut({ scope: "others" });
  await writeAudit({ actorId: actor.id, action: "sessions_revoked", entityType: "profile", entityId: actor.id, summary: "Other sessions revoked" });
  return { ok: true as const };
}
