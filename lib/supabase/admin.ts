import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SUPABASE_URL } from "@/lib/env";

/** Service-role client. Bypasses RLS — only for trusted server jobs (push dispatch, cleanup, account deletion). */
export function createSupabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not configured");
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
