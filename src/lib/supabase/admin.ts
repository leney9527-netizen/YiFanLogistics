import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient | null {
  const env = getServerEnv();
  if (!env) return null;
  if (!cached) {
    cached = createClient(env.url, env.service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
