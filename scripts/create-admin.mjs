import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!url || !serviceKey || !email || password.length < 15) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL and an ADMIN_PASSWORD of at least 15 characters.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error || !data.user) {
  console.error(error?.message ?? "Could not create the admin user.");
  process.exit(1);
}
const { error: profileError } = await admin.from("profiles").update({ role: "admin", locale: "zh" }).eq("id", data.user.id);
if (profileError) {
  console.error(profileError.message);
  process.exit(1);
}
console.log(`Admin created: ${data.user.id}`);
